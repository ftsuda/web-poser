import { describe, expect, it } from 'vitest'
import { presetKeyFromName, savedPoseToPresetCode } from '../poseCodegen'
import { getHandJointNames, resolveHandPreset, type HandPresetKey } from '../handPresets'
import {
  NEUTRAL_ELBOW_TWIST,
  POSE_PRESET_KEYS,
  STANDING_HIP_HEIGHT_M,
  resolvePosePreset,
  resolvePosePresetPlacement,
  type PosePresetKey,
} from '../posePresets'
import { SIDES } from '../poseMirror'
import { JOINT_NAMES, ROOT_JOINT_NAME, type JointRotation } from '../skeleton'
import type { SavedPose } from '../poseLibrary'

/** A pose salva que o app produziria depois de aplicar `key` e salvar na biblioteca. */
function salvaDe(key: PosePresetKey, name = key): SavedPose {
  const placement = resolvePosePresetPlacement(key)
  return {
    id: `pose-${key}`,
    name,
    pose: resolvePosePreset(key),
    rotation: placement.rotation,
    groundOffsetM: placement.groundOffsetM,
    preservesHeading: placement.preservesHeading,
  }
}

interface Definicao {
  pose: Record<string, Partial<JointRotation>>
  rotation?: Partial<JointRotation>
  hipHeightM?: number
  hands?: HandPresetKey | Partial<Record<'L' | 'R', HandPresetKey>>
}

/** Lê de volta o bloco gerado como objeto — o mesmo que colar no arquivo faria. */
function definicaoDe(code: string, key: string): Definicao {
  return (new Function(`return {${code}}`)() as Record<string, Definicao>)[key]
}

/**
 * Reconstrói a pose completa a partir do bloco gerado, seguindo as regras
 * DOCUMENTADAS do preset (zeros implícitos, torção neutra do cotovelo, pose de
 * mão). É uma implementação independente de `resolvePosePreset` — é isso que
 * faz o teste valer alguma coisa: se as duas concordarem, a tradução não
 * perdeu nada pelo caminho.
 */
function expandir(def: Definicao): Record<string, JointRotation> {
  const pose: Record<string, JointRotation> = {}
  for (const jointName of JOINT_NAMES) {
    if (jointName === ROOT_JOINT_NAME) continue
    pose[jointName] = { x: 0, y: NEUTRAL_ELBOW_TWIST[jointName] ?? 0, z: 0 }
  }

  for (const side of SIDES) {
    const key = typeof def.hands === 'string' ? def.hands : def.hands?.[side]
    const mao = resolveHandPreset(key ?? 'open', side)
    for (const [jointName, rotation] of Object.entries(mao)) pose[jointName] = { ...rotation }
  }

  for (const [jointName, campos] of Object.entries(def.pose)) {
    pose[jointName] = { ...pose[jointName], ...campos }
  }
  return pose
}

describe('presetKeyFromName', () => {
  it('vira identificador camelCase, sem acento nem pontuação', () => {
    expect(presetKeyFromName('Pose do Herói')).toBe('poseDoHeroi')
    expect(presetKeyFromName('mão na cintura')).toBe('maoNaCintura')
    expect(presetKeyFromName('Salto 2')).toBe('salto2')
  })

  it('nome que não rende identificador cai num padrão em vez de gerar código quebrado', () => {
    expect(presetKeyFromName('   ')).toBe('novaPose')
    expect(presetKeyFromName('3 pontos')).toBe('pose3Pontos')
  })
})

describe('savedPoseToPresetCode — ida e volta', () => {
  /**
   * O teste que sustenta a ferramenta: para TODAS as 71 poses do catálogo,
   * gerar o bloco a partir da pose resolvida e reexpandi-lo devolve a mesma
   * pose, junta por junta e eixo por eixo. A tolerância é o próprio passo de
   * arredondamento do gerador (0,1°).
   */
  it.each(POSE_PRESET_KEYS)('%s: o bloco gerado reconstrói a pose original', (key) => {
    const salva = salvaDe(key)
    const { code, key: chave } = savedPoseToPresetCode(salva)
    const reconstruida = expandir(definicaoDe(code, chave))

    for (const jointName of Object.keys(salva.pose)) {
      for (const eixo of ['x', 'y', 'z'] as const) {
        expect(`${jointName}.${eixo}=${reconstruida[jointName][eixo].toFixed(1)}`).toBe(
          `${jointName}.${eixo}=${salva.pose[jointName][eixo].toFixed(1)}`,
        )
      }
    }
  })

  it.each(POSE_PRESET_KEYS)('%s: colocação e direção sobrevivem à ida e volta', (key) => {
    const salva = salvaDe(key)
    const def = definicaoDe(savedPoseToPresetCode(salva).code, savedPoseToPresetCode(salva).key)

    // `rotation` presente ou ausente é o que decide `preservesHeading`.
    expect(def.rotation === undefined).toBe(salva.preservesHeading)
    expect((def.hipHeightM ?? STANDING_HIP_HEIGHT_M) - STANDING_HIP_HEIGHT_M).toBeCloseTo(salva.groundOffsetM, 3)
  })
})

describe('savedPoseToPresetCode — o que ele escreve', () => {
  it('escreve só o que se afasta da pose neutra, no formato do arquivo', () => {
    const { code, key } = savedPoseToPresetCode(salvaDe('fighting'))
    const def = definicaoDe(code, key)

    expect(key).toBe('fighting')
    expect(def.pose['hip.L']).toEqual({ x: -22, z: 10 })
    expect(def.hipHeightM).toBe(0.88)
    expect(def.hands).toBe('fist')
    // Nenhum eixo zerado sobrevive — é o que torna o bloco legível.
    for (const campos of Object.values(def.pose)) {
      for (const valor of Object.values(campos)) expect(valor).not.toBe(0)
    }
  })

  /**
   * `elbow.*.y` ausente significa a torção neutra do antebraço (±90, #25), não
   * zero. Copiar o valor cru do JSON apagaria a convenção do arquivo.
   */
  it('omite a torção neutra do cotovelo, e só a escreve quando a pose a contraria', () => {
    const { code, key } = savedPoseToPresetCode(salvaDe('fighting'))
    expect(definicaoDe(code, key).pose['elbow.L']?.y).toBeUndefined()

    const torcida = salvaDe('fighting')
    torcida.pose['elbow.L'] = { ...torcida.pose['elbow.L'], y: 20 }
    const outra = savedPoseToPresetCode(torcida)
    expect(definicaoDe(outra.code, outra.key).pose['elbow.L']?.y).toBe(20)
  })

  it('a pose em pé não declara colocação nem mãos — tudo nela é o padrão', () => {
    const { code, key } = savedPoseToPresetCode(salvaDe('standing'))
    const def = definicaoDe(code, key)

    expect(def.rotation).toBeUndefined()
    expect(def.hipHeightM).toBeUndefined()
    expect(def.hands).toBeUndefined()
    expect(def.pose).toEqual({})
  })

  it('as juntas da mão saem da pose e viram uma pose de mão declarada', () => {
    const { code, key } = savedPoseToPresetCode(salvaDe('pointForward'))
    const def = definicaoDe(code, key)

    for (const side of SIDES) {
      for (const jointName of getHandJointNames(side)) expect(def.pose[jointName]).toBeUndefined()
    }
    // Apontar usa o indicador só na mão do gesto (#45): lados diferentes.
    expect(def.hands).toEqual({ L: 'open', R: 'point' })
  })

  it('mão que não bate com pose pronta é escrita junta a junta, com aviso', () => {
    const salva = salvaDe('standing')
    // Uma curvatura de dedo que nenhuma pose de mão pronta tem.
    salva.pose['indexMid.R'] = { ...salva.pose['indexMid.R'], x: -33 }
    const { code, key, avisos } = savedPoseToPresetCode(salva)

    expect(definicaoDe(code, key).pose['indexMid.R']).toEqual({ x: -33 })
    expect(avisos.some((a) => a.includes('mão R'))).toBe(true)
  })
})

describe('savedPoseToPresetCode — avisos', () => {
  it('pose no ar avisa que está acima do assentamento calculado', () => {
    const { avisos } = savedPoseToPresetCode(salvaDe('superman'))
    expect(avisos.some((a) => a.includes('ACIMA do assentamento'))).toBe(true)
  })

  it('pose que atravessa o chão avisa qual teste vai reprovar', () => {
    const afundada = salvaDe('standing')
    afundada.groundOffsetM = -0.2
    const { avisos } = savedPoseToPresetCode(afundada)

    expect(avisos.some((a) => a.includes('abaixo do chão'))).toBe(true)
    expect(avisos.some((a) => a.includes('ABAIXO do assentamento'))).toBe(true)
  })

  it('pose bem assentada não gera aviso nenhum', () => {
    expect(savedPoseToPresetCode(salvaDe('fighting')).avisos).toEqual([])
  })
})

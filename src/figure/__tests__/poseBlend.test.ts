import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { blendPoses, figureBlendState, resolveBlendTarget } from '../poseBlend'
import { resolvePosePreset, resolvePosePresetPlacement, type PosePresetKey } from '../posePresets'
import { buildJointFrames } from '../jointFrames'
import { clampJointRotation, getHeightScale, getJoint, JOINT_NAMES, ROOT_JOINT_NAME } from '../skeleton'
import type { Figure } from '../../store/figuresStore'

function figure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [1, 0, -2],
    rotation: { x: 0, y: 0, z: 0 },
    pose: resolvePosePreset('tpose'),
    ...overrides,
  }
}

function presetSource(key: PosePresetKey) {
  return { pose: resolvePosePreset(key), ...resolvePosePresetPlacement(key) }
}

describe('blendPoses', () => {
  const base = figureBlendState(figure())
  const target = resolveBlendTarget(figure(), presetSource('running'))

  it('nas pontas devolve exatamente cada uma das poses', () => {
    expect(blendPoses(base, target, 0)).toBe(base)
    expect(blendPoses(base, target, 1)).toBe(target)
  })

  it('grampeia a mistura fora de [0, 1] nas pontas, em vez de extrapolar a pose', () => {
    expect(blendPoses(base, target, -0.5)).toBe(base)
    expect(blendPoses(base, target, 7)).toBe(target)
  })

  it('no meio, cada eixo fica na média das duas poses', () => {
    const meio = blendPoses(base, target, 0.5)
    for (const jointName of ['hip.L', 'shoulder.R', 'elbow.L'] as const) {
      expect(meio.pose[jointName].x).toBeCloseTo((base.pose[jointName].x + target.pose[jointName].x) / 2, 6)
      expect(meio.pose[jointName].z).toBeCloseTo((base.pose[jointName].z + target.pose[jointName].z) / 2, 6)
    }
  })

  it('a mistura é monótona: 25% fica entre 0% e 50%', () => {
    const q = blendPoses(base, target, 0.25).pose['shoulder.L'].z
    const zero = base.pose['shoulder.L'].z
    const meio = blendPoses(base, target, 0.5).pose['shoulder.L'].z
    expect(Math.min(zero, meio)).toBeLessThanOrEqual(q)
    expect(q).toBeLessThanOrEqual(Math.max(zero, meio))
  })

  it('nunca inclui a root na pose interna', () => {
    const misturada = blendPoses(
      { ...base, pose: { ...base.pose, [ROOT_JOINT_NAME]: { x: 10, y: 10, z: 10 } } },
      target,
      0.5,
    )
    expect(misturada.pose[ROOT_JOINT_NAME]).toBeUndefined()
  })

  /**
   * A propriedade central da escolha por EIXO (DECISOES.md #43): entre duas
   * poses válidas, toda mistura é válida — os limites são faixas por eixo, e
   * uma faixa é convexa. Sem isso o clamp entraria em ação no meio do
   * caminho e a pose "pularia".
   */
  it('nenhuma junta sai dos limites em nenhum ponto da mistura', () => {
    const pares: Array<[PosePresetKey, PosePresetKey]> = [
      ['tpose', 'running'],
      ['tpose', 'fetal'],
      ['handsOnHips', 'celebrating'],
      ['clinch', 'touchToes'],
      ['model', 'kickGiving'],
      ['squat', 'superman'],
    ]

    for (const [de, para] of pares) {
      const partida = figureBlendState(figure({ pose: resolvePosePreset(de) }))
      const chegada = resolveBlendTarget(figure(), presetSource(para))
      for (let i = 0; i <= 20; i += 1) {
        const misturada = blendPoses(partida, chegada, i / 20)
        for (const [jointName, rotation] of Object.entries(misturada.pose)) {
          expect(clampJointRotation(jointName, rotation)).toEqual(rotation)
        }
      }
    }
  })

  /**
   * O contra-exemplo que decidiu o método: interpolar por quatérnio no
   * `elbow.R` deste par cai numa representação de Euler equivalente porém
   * fora da faixa da junta (x = +99° com limite [-150, 0]) — o clamp então
   * estica o braço no meio da mistura. Por eixo, o mesmo ponto fica dentro.
   */
  it('o caso que reprovou o quatérnio: por eixo o cotovelo fica na faixa, por quatérnio não', () => {
    const de = resolvePosePreset('clinch')['elbow.R']
    const para = resolvePosePreset('touchToes')['elbow.R']
    const limite = getJoint('elbow.R').limits.x!

    const porEixo = blendPoses(
      figureBlendState(figure({ pose: resolvePosePreset('clinch') })),
      resolveBlendTarget(figure(), presetSource('touchToes')),
      0.2,
    ).pose['elbow.R']
    expect(porEixo.x).toBeGreaterThanOrEqual(limite.min)
    expect(porEixo.x).toBeLessThanOrEqual(limite.max)

    const euler = (r: typeof de) =>
      new THREE.Euler(
        THREE.MathUtils.degToRad(r.x),
        THREE.MathUtils.degToRad(r.y),
        THREE.MathUtils.degToRad(r.z),
        'XYZ',
      )
    const porQuaternio = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion()
        .setFromEuler(euler(de))
        .slerp(new THREE.Quaternion().setFromEuler(euler(para)), 0.2),
      'XYZ',
    )
    expect(THREE.MathUtils.radToDeg(porQuaternio.x)).toBeGreaterThan(limite.max)
  })

  it('interpola também a altura do quadril e a inclinação do boneco', () => {
    const deitado = resolveBlendTarget(figure(), presetSource('lyingSpreadSupine'))
    const meio = blendPoses(base, deitado, 0.5)

    // A inclinação é exatamente o meio do caminho.
    expect(meio.rotation.x).toBeCloseTo(-45, 6)
    // A altura desce em direção ao chão, mas não pela metade exata: a correção
    // de chão levanta o que a interpolação linear enterraria (ver o bloco
    // "a mistura não enterra o boneco no chão").
    expect(meio.positionY).toBeLessThan(0)
    expect(meio.positionY).toBeGreaterThan(deitado.positionY / 2)
  })

  /** O root gira livre: de 170° para -170° o caminho é 20°, não 340°. */
  it('gira o boneco pelo menor arco', () => {
    const partida = figureBlendState(figure({ rotation: { x: 0, y: 170, z: 0 } }))
    const chegada = { ...partida, rotation: { x: 0, y: -170, z: 0 } }

    expect(blendPoses(partida, chegada, 0.5).rotation.y).toBe(180)
    expect(blendPoses(partida, chegada, 0.25).rotation.y).toBeCloseTo(175, 6)
  })

  /**
   * A MESMA orientação tem dois Euler XYZ — (x, y, z) e (x+180, 180−y, z+180).
   * O slider guarda o primeiro; o gizmo (que escreve quaternion e deixa o three
   * decompor) guarda o segundo. Misturar um com o outro eixo a eixo derruba o
   * boneco no meio do caminho: o conserto é reescrever a CHEGADA no ramo da
   * PARTIDA antes de interpolar (#116).
   */
  it('a mistura da raiz não depende de qual dos dois Euler equivalentes veio guardado', () => {
    const partida = figureBlendState(figure({ rotation: { x: 0, y: 180, z: 0 } }))
    // Boneco virado para -135°, do jeito que o GIZMO grava.
    const porGizmo = { ...partida, rotation: { x: -180, y: -45, z: -180 } }
    const porSlider = { ...partida, rotation: { x: 0, y: -135, z: 0 } }

    const meio = blendPoses(partida, porGizmo, 0.5)
    expect(meio.rotation).toEqual(blendPoses(partida, porSlider, 0.5).rotation)
    // 45° para frente, atravessando o limite — sem tombo em X e Z.
    expect(meio.rotation).toEqual({ x: 0, y: -157.5, z: 0 })
  })

  it('mistura em 0% e 100% continua devolvendo as pontas intactas', () => {
    const partida = figureBlendState(figure({ rotation: { x: 0, y: 180, z: 0 } }))
    const chegada = { ...partida, rotation: { x: -180, y: -45, z: -180 } }

    expect(blendPoses(partida, chegada, 0)).toBe(partida)
    expect(blendPoses(partida, chegada, 1)).toBe(chegada)
  })
})

/**
 * Correção de chão (DECISOES.md #43). A altura do quadril interpola em linha
 * reta, mas a geometria das pernas não: sem correção, o boneco afunda até
 * 17 cm no meio do caminho de "em pé" para "ajoelhado" — e o meio do caminho é
 * justamente o produto desta funcionalidade.
 */
describe('a mistura não enterra o boneco no chão', () => {
  function menorJunta(state: ReturnType<typeof blendPoses>): number {
    const { joints } = buildJointFrames(
      figure({ pose: state.pose, rotation: state.rotation, position: [0, state.positionY, 0] }),
    )
    let menor = Infinity
    const mundo = new THREE.Vector3()
    for (const group of joints.values()) {
      group.getWorldPosition(mundo)
      menor = Math.min(menor, mundo.y)
    }
    return menor
  }

  it('nenhuma junta atravessa o chão em nenhum ponto do caminho', () => {
    const pares: Array<[PosePresetKey, PosePresetKey]> = [
      ['standing', 'sitting'],
      ['standing', 'kneelingBoth'],
      ['standing', 'squat'],
      ['tpose', 'fetal'],
      ['tpose', 'lyingSpreadSupine'],
    ]

    for (const [de, para] of pares) {
      const placement = resolvePosePresetPlacement(de)
      const partida = figureBlendState(
        figure({ pose: resolvePosePreset(de), rotation: placement.rotation, position: [0, placement.groundOffsetM, 0] }),
      )
      const chegada = resolveBlendTarget(figure(), presetSource(para))
      for (let i = 0; i <= 8; i += 1) {
        expect(menorJunta(blendPoses(partida, chegada, i / 8))).toBeGreaterThan(-0.001)
      }
    }
  })

  /**
   * A correção sobe só o afundamento EXTRA (o que a mistura criou), e por isso
   * as pontas ficam intactas mesmo quando o usuário deixou o boneco enterrado
   * de propósito — caso contrário 0% deixaria de devolver a pose original.
   */
  it('não levanta um boneco que já estava enterrado nas duas pontas', () => {
    const enterrado = figure({ pose: resolvePosePreset('standing'), position: [0, -0.3, 0] })
    const partida = figureBlendState(enterrado)
    const chegada = { ...resolveBlendTarget(enterrado, presetSource('sitting')), positionY: -0.7 }

    expect(blendPoses(partida, chegada, 0).positionY).toBe(-0.3)
    expect(blendPoses(partida, chegada, 1).positionY).toBe(-0.7)
    // No meio, continua enterrado o tanto que as pontas já estavam — a
    // correção não "conserta" o que o usuário fez de propósito.
    expect(blendPoses(partida, chegada, 0.5).positionY).toBeLessThan(0)
  })

  /**
   * A correção vira opção na fase 10 (DECISOES.md #52): o animador desliga,
   * porque atravessar o chão passou a ser problema de quem monta os keyframes
   * e levantar o boneco criaria um movimento vertical que ninguém pediu. O
   * padrão continua LIGADO — este slider não muda de comportamento.
   */
  it('desligada por opção, deixa o boneco afundar exatamente o que a interpolação linear manda', () => {
    const dePe = resolvePosePresetPlacement('standing')
    const ajoelhado = resolvePosePresetPlacement('kneelingBoth')
    const partida = figureBlendState(
      figure({ pose: resolvePosePreset('standing'), rotation: dePe.rotation, position: [0, dePe.groundOffsetM, 0] }),
    )
    const chegada = figureBlendState(
      figure({
        pose: resolvePosePreset('kneelingBoth'),
        rotation: ajoelhado.rotation,
        position: [0, ajoelhado.groundOffsetM, 0],
      }),
    )

    const media = (dePe.groundOffsetM + ajoelhado.groundOffsetM) / 2
    expect(blendPoses(partida, chegada, 0.5, 1.7, { groundCorrection: false }).positionY).toBeCloseTo(media, 9)
    expect(blendPoses(partida, chegada, 0.5, 1.7).positionY).toBeGreaterThan(media)
    expect(menorJunta(blendPoses(partida, chegada, 0.5, 1.7, { groundCorrection: false }))).toBeLessThan(-0.01)
  })

  it('nunca BAIXA o boneco: o problema é atravessar o chão, não flutuar', () => {
    const voando = figure({ pose: resolvePosePreset('superman'), position: [0, 1, 0] })
    const partida = figureBlendState(voando)
    const chegada = { ...resolveBlendTarget(voando, presetSource('superman')), positionY: 1 }

    expect(blendPoses(partida, chegada, 0.5).positionY).toBeCloseTo(1, 6)
  })
})

describe('resolveBlendTarget', () => {
  it('em pé, preserva a direção que o boneco já encarava', () => {
    const boneco = figure({ rotation: { x: 0, y: 137, z: 0 } })
    expect(resolveBlendTarget(boneco, presetSource('running')).rotation).toEqual({ x: 0, y: 137, z: 0 })
  })

  it('deitado, impõe a inclinação inteira da pose', () => {
    const boneco = figure({ rotation: { x: 0, y: 137, z: 0 } })
    expect(resolveBlendTarget(boneco, presetSource('lyingSpreadSupine')).rotation).toEqual({ x: -90, y: 0, z: 0 })
  })

  it('escala a altura do quadril pela altura do boneco', () => {
    const baixo = figure({ height: 1.5 })
    expect(resolveBlendTarget(baixo, presetSource('sitting')).positionY).toBeCloseTo(
      (0.485 - 0.9) * getHeightScale(1.5),
      6,
    )
  })
})

/**
 * A invariante que amarra a mistura ao resto do app: 100% é exatamente
 * "Aplicar pose". Sem ela, o slider seria um terceiro jeito de posar, com
 * resultado próprio — e o usuário veria a pose "pular" ao chegar no fim.
 */
describe('100% é idêntico a aplicar a pose', () => {
  it('mesma pose, mesma rotação e mesma altura, em pé e deitado', () => {
    for (const key of ['running', 'sitting', 'lyingSpreadSupine', 'fetal'] as const) {
      const boneco = figure({ rotation: { x: 0, y: 40, z: 0 }, height: 1.62 })
      const cheio = blendPoses(figureBlendState(boneco), resolveBlendTarget(boneco, presetSource(key)), 1)
      const placement = resolvePosePresetPlacement(key)

      expect(cheio.pose).toEqual(resolvePosePreset(key))
      expect(cheio.rotation).toEqual(
        placement.preservesHeading ? { ...placement.rotation, y: 40 } : placement.rotation,
      )
      expect(cheio.positionY).toBeCloseTo(placement.groundOffsetM * getHeightScale(1.62), 6)
    }
  })

  it('e o boneco misturado é montável: as juntas todas existem no esqueleto', () => {
    const boneco = figure()
    const meio = blendPoses(figureBlendState(boneco), resolveBlendTarget(boneco, presetSource('fetal')), 0.5)
    for (const jointName of Object.keys(meio.pose)) {
      expect(JOINT_NAMES).toContain(jointName)
    }

    const { joints } = buildJointFrames({ ...boneco, pose: meio.pose, rotation: meio.rotation })
    const cabeca = new THREE.Vector3()
    joints.get('head')!.getWorldPosition(cabeca)
    expect(Number.isFinite(cabeca.y)).toBe(true)
  })
})

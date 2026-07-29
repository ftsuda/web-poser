import { getHandJointNames, isHandJoint, resolveHandPreset, HAND_PRESET_KEYS, type HandPresetKey } from './handPresets'
import { lowestJointY, seatOnGround } from './poseGround'
import { NEUTRAL_ELBOW_TWIST, STANDING_HIP_HEIGHT_M } from './posePresets'
import { SIDES, type Side } from './poseMirror'
import { JOINT_NAMES, ROOT_JOINT_NAME, getJoint, type JointRotation } from './skeleton'
import type { SavedPose } from './poseLibrary'

/**
 * Converte uma pose salva pelo usuário (biblioteca de poses, `poses.json`) no
 * bloco TypeScript de um preset de `posePresets.ts`.
 *
 * **Por que isto existe.** Até aqui um preset novo era escrito às cegas:
 * ângulos digitados, boneco montado na cabeça, busca numérica à mão para
 * assentar no chão. O app, porém, JÁ é o editor certo — gizmo com limites, IK,
 * espelho, travas — e já sabe guardar o resultado: `SavedPose` carrega
 * exatamente os quatro dados que um preset precisa (`pose`, `rotation`,
 * `groundOffsetM` e o `preservesHeading` derivado deles). O que faltava era a
 * tradução. Posa-se no app, salva-se na biblioteca, e o preset sai daqui.
 *
 * **O que a tradução tem de saber**, e que uma cópia crua do JSON perderia:
 *
 * 1. O preset é PARCIAL — só lista o que se afasta da pose neutra. Emitir os
 *    eixos zerados de 32 juntas faria um bloco ilegível.
 * 2. `elbow.*.y` ausente **não** é zero: é a torção neutra do antebraço
 *    (`NEUTRAL_ELBOW_TWIST`, ±90 — ver DECISOES.md #25). Copiar o valor cru
 *    apagaria a convenção do arquivo, repetindo ±90 em todo preset.
 * 3. As juntas da mão saem da pose e viram `hands: 'fist'` quando batem com
 *    uma pose de mão pronta — que é como os presets do arquivo se escrevem.
 * 4. `hipHeightM` é a altura do quadril, não o deslocamento guardado:
 *    `hipHeightM = STANDING_HIP_HEIGHT_M + groundOffsetM`.
 * 5. `rotation` só aparece quando a pose inclina o boneco. Presente ou ausente
 *    é o que decide o `preservesHeading` do preset — com ela, o giro do
 *    usuário no chão é imposto; sem ela, preservado.
 *
 * Os avisos são o resto do trabalho: dizem o que o gerador viu de estranho
 * (pose flutuando, pose atravessando o chão, mão que não bate com preset
 * nenhum) em vez de emitir código silenciosamente torto.
 */

export interface PresetCodeResult {
  /** Chave sugerida para o preset, derivada do nome da pose. */
  key: string
  /** Bloco pronto para colar dentro de `POSE_PRESETS`, já indentado. */
  code: string
  /** O que merece olho humano antes de colar. */
  avisos: string[]
}

const ZERO: JointRotation = { x: 0, y: 0, z: 0 }
const EIXOS = ['x', 'y', 'z'] as const

/** `Pose do Herói` → `poseDoHeroi`; o que não vira identificador cai no padrão. */
export function presetKeyFromName(name: string): string {
  const limpo = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
  if (!limpo) return 'novaPose'

  const [primeira, ...resto] = limpo.split(' ')
  const chave = primeira.toLowerCase() + resto.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join('')
  return /^[a-z]/.test(chave) ? chave : `pose${chave[0].toUpperCase()}${chave.slice(1)}`
}

/** Ângulo como o arquivo escreve: inteiro quando dá, uma casa quando precisa. */
function grau(valor: number): number {
  const arredondado = Math.round(valor * 10) / 10
  return Object.is(arredondado, -0) ? 0 : arredondado
}

function rotacaoDe(pose: Record<string, JointRotation>, jointName: string): JointRotation {
  return pose[jointName] ?? ZERO
}

/** Pose de mão pronta que bate com o que a pose salva tem naquele lado, ou `null`. */
function handPresetOf(pose: Record<string, JointRotation>, side: Side): HandPresetKey | null {
  for (const key of HAND_PRESET_KEYS) {
    const alvo = resolveHandPreset(key, side)
    const bate = Object.entries(alvo).every(([jointName, rotation]) => {
      const atual = rotacaoDe(pose, jointName)
      return EIXOS.every((eixo) => Math.abs(atual[eixo] - rotation[eixo]) < 0.001)
    })
    if (bate) return key
  }
  return null
}

/** Os eixos daquela junta que valem a pena escrever — sem zeros e sem a torção neutra. */
function eixosSignificativos(jointName: string, rotation: JointRotation): Partial<JointRotation> {
  const limits = getJoint(jointName).limits
  const neutro = NEUTRAL_ELBOW_TWIST[jointName]
  const saida: Partial<JointRotation> = {}

  for (const eixo of EIXOS) {
    const valor = grau(rotation[eixo])
    // Eixo que não é grau de liberdade da junta nunca entra: o preset seria
    // ignorado por `resolvePosePreset` e enganaria quem lesse o arquivo.
    if (!limits[eixo]) continue
    const referencia = eixo === 'y' && neutro !== undefined ? neutro : 0
    if (valor !== referencia) saida[eixo] = valor
  }
  return saida
}

function objetoLiteral(campos: Partial<JointRotation>): string {
  return `{ ${EIXOS.filter((e) => campos[e] !== undefined)
    .map((e) => `${e}: ${campos[e]}`)
    .join(', ')} }`
}

export function savedPoseToPresetCode(saved: SavedPose, keyOverride?: string): PresetCodeResult {
  const key = keyOverride?.trim() || presetKeyFromName(saved.name)
  const avisos: string[] = []

  // --- mãos ---------------------------------------------------------------
  const maos = Object.fromEntries(SIDES.map((side) => [side, handPresetOf(saved.pose, side)])) as Record<
    Side,
    HandPresetKey | null
  >
  const semPreset = SIDES.filter((side) => maos[side] === null)
  for (const side of semPreset) {
    avisos.push(
      `a mão ${side} não bate com nenhuma pose de mão pronta; as juntas dela foram escritas uma a uma ` +
        `— se for de propósito, tudo bem; se não, aplique uma pose de mão antes de salvar`,
    )
  }

  const maosDeclaradas =
    semPreset.length > 0
      ? null
      : maos.L === maos.R
        ? maos.L === 'open'
          ? null // ausente já significa mãos abertas
          : maos.L
        : { L: maos.L!, R: maos.R! }

  const juntasDeMaoOcultas = new Set(
    SIDES.filter((side) => maos[side] !== null).flatMap((side) => getHandJointNames(side)),
  )

  // --- juntas -------------------------------------------------------------
  const linhas: string[] = []
  for (const jointName of JOINT_NAMES) {
    if (jointName === ROOT_JOINT_NAME) continue
    if (isHandJoint(jointName) && juntasDeMaoOcultas.has(jointName)) continue

    const campos = eixosSignificativos(jointName, rotacaoDe(saved.pose, jointName))
    if (Object.keys(campos).length === 0) continue
    // Aspas só onde o nome exige (`hip.L`), como o arquivo já escreve.
    const nome = /^[a-zA-Z_$][\w$]*$/.test(jointName) ? jointName : `'${jointName}'`
    linhas.push(`      ${nome}: ${objetoLiteral(campos)},`)
  }

  // --- colocação ----------------------------------------------------------
  const partes = [`    pose: {`, ...linhas, `    },`]

  if (!saved.preservesHeading) {
    const campos: Partial<JointRotation> = {}
    for (const eixo of EIXOS) {
      const valor = grau(saved.rotation[eixo])
      if (valor !== 0) campos[eixo] = valor
    }
    partes.push(`    rotation: ${objetoLiteral(campos)},`)
  }

  if (Math.abs(saved.groundOffsetM) > 1e-9) {
    partes.push(`    hipHeightM: ${Math.round((STANDING_HIP_HEIGHT_M + saved.groundOffsetM) * 1000) / 1000},`)
  }

  if (typeof maosDeclaradas === 'string') partes.push(`    hands: '${maosDeclaradas}',`)
  else if (maosDeclaradas) partes.push(`    hands: { L: '${maosDeclaradas.L}', R: '${maosDeclaradas.R}' },`)

  // --- conferências -------------------------------------------------------
  const rotacao = saved.preservesHeading ? ZERO : saved.rotation
  const assentado = seatOnGround(saved.pose, rotacao)
  const folga = assentado - saved.groundOffsetM
  if (Math.abs(folga) > 0.01) {
    avisos.push(
      folga > 0
        ? `a pose está ${(folga * 100).toFixed(1)} cm ABAIXO do assentamento calculado — confira se não afunda no chão`
        : `a pose está ${(-folga * 100).toFixed(1)} cm ACIMA do assentamento calculado — de propósito (pose no ar, ` +
            `carregada por outro boneco) ou esquecimento?`,
    )
  }

  const menorY = lowestJointY(saved.pose, rotacao) + saved.groundOffsetM
  if (menorY < 0) {
    avisos.push(
      `a junta mais baixa fica ${(-menorY * 100).toFixed(1)} cm abaixo do chão — o teste ` +
        `"nenhuma junta atravessa o chão" vai reprovar este preset`,
    )
  }

  return { key, code: `  ${key}: {\n${partes.join('\n')}\n  },`, avisos }
}

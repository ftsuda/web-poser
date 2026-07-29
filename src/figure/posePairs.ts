import * as THREE from 'three'
import type { JointRotation } from './skeleton'
import { resolvePosePresetPlacement, type PosePresetKey } from './posePresets'

/**
 * Pareamento das poses em dupla: qual pose o PARCEIRO recebe e onde ele fica.
 *
 * As poses em par sempre foram desenhadas aos pares — uma resolve o golpe/o
 * apoio e a outra a reação — e até aqui montar a cena era manual: aplicar a
 * pose no segundo boneco e afastá-lo a olho até bater com a distância escrita
 * na dica do painel. Esta tabela é essa dica virando número: com dois bonecos
 * na cena, aplicar uma pose em par também posa E posiciona o outro
 * (`applyPosePreset` no `figuresStore`).
 *
 * Cada distância aqui é a MESMA já travada pelos testes de geometria das
 * poses (`posePresets.test.ts`) — o encontro punho × rosto, mão × mão,
 * antebraço × garganta. Mudou aqui, mudou lá e mudou a dica no painel.
 */
export interface PosePairing {
  /** Pose que o parceiro recebe. Igual à própria chave nas poses que servem aos dois (aperto de mão, abraço, clinche). */
  counterpart: PosePresetKey
  /**
   * Distância entre os quadris dos dois, em metros na altura de referência
   * (1,70 m), medida ao longo do eixo Z do boneco de origem: positivo à
   * FRENTE dele, negativo atrás.
   */
  gapM: number
  /**
   * `true` = o parceiro fica girado 180° (um de frente para o outro);
   * `false` = os dois olham para o mesmo lado (cavalinho, colo, gravata,
   * mata-leão). Ver a regra exata de mapeamento em `resolvePairedRotation`.
   */
  facing: boolean
}

/**
 * Tabela completa. A consistência mútua (a pose do parceiro aponta de volta,
 * com a mesma distância e o sinal correto) é travada por teste, então não há
 * como uma metade ficar para trás.
 *
 * Fora dela ficam de propósito as poses de luta que NÃO descrevem um encontro:
 * "guarda de luta" é uma pose solo que por acaso mora no grupo de luta, e não
 * tem contato nenhum que fixe uma distância — inventar uma seria chute.
 */
export const POSE_PAIRINGS: Partial<Record<PosePresetKey, PosePairing>> = {
  // De frente um para o outro (parceiro girado 180°). A distância é simétrica:
  // se B está a D à frente de A girado 180°, A está a D à frente de B.
  handshake: { counterpart: 'handshake', gapM: 0.755, facing: true },
  hug: { counterpart: 'hug', gapM: 0.26, facing: true },
  clinch: { counterpart: 'clinch', gapM: 0.4, facing: true },
  danceLead: { counterpart: 'danceFollow', gapM: 0.36, facing: true },
  danceFollow: { counterpart: 'danceLead', gapM: 0.36, facing: true },
  pullingUp: { counterpart: 'beingPulledUp', gapM: 0.69, facing: true },
  beingPulledUp: { counterpart: 'pullingUp', gapM: 0.69, facing: true },
  pushGiving: { counterpart: 'pushTaking', gapM: 0.467, facing: true },
  pushTaking: { counterpart: 'pushGiving', gapM: 0.467, facing: true },
  punchGiving: { counterpart: 'punchTaking', gapM: 0.629, facing: true },
  punchTaking: { counterpart: 'punchGiving', gapM: 0.629, facing: true },
  kickGiving: { counterpart: 'kickTaking', gapM: 0.815, facing: true },
  kickTaking: { counterpart: 'kickGiving', gapM: 0.815, facing: true },
  kneeStrikeGiving: { counterpart: 'kneeStrikeTaking', gapM: 0.3653, facing: true },
  kneeStrikeTaking: { counterpart: 'kneeStrikeGiving', gapM: 0.3653, facing: true },

  // Olhando para o mesmo lado: aqui o sinal importa, e o par inverte-o (se o
  // carregado fica 0,16 m ATRÁS de quem carrega, quem carrega fica 0,16 m à
  // frente dele).
  carryingPiggyback: { counterpart: 'carriedPiggyback', gapM: -0.16, facing: false },
  carriedPiggyback: { counterpart: 'carryingPiggyback', gapM: 0.16, facing: false },
  carryingCradle: { counterpart: 'carriedCradle', gapM: 0.28, facing: false },
  carriedCradle: { counterpart: 'carryingCradle', gapM: -0.28, facing: false },
  chokeGiving: { counterpart: 'chokeTaking', gapM: 0.39, facing: false },
  chokeTaking: { counterpart: 'chokeGiving', gapM: -0.39, facing: false },
  rearChokeKneeling: { counterpart: 'rearChokeSeated', gapM: 0.45, facing: false },
  rearChokeSeated: { counterpart: 'rearChokeKneeling', gapM: -0.45, facing: false },
  groundChokeGiving: { counterpart: 'groundChokeTaking', gapM: 0.1, facing: false },
  groundChokeTaking: { counterpart: 'groundChokeGiving', gapM: -0.1, facing: false },
  armLockPushGiving: { counterpart: 'armLockPushTaking', gapM: 0.238, facing: false },
  armLockPushTaking: { counterpart: 'armLockPushGiving', gapM: -0.238, facing: false },
  armLockPullGiving: { counterpart: 'armLockPullTaking', gapM: 0.238, facing: false },
  armLockPullTaking: { counterpart: 'armLockPullGiving', gapM: -0.238, facing: false },
}

/** O pareamento da pose, ou `null` se ela for solo. */
export function getPosePairing(key: PosePresetKey): PosePairing | null {
  return POSE_PAIRINGS[key] ?? null
}

/**
 * Para onde o parceiro anda, no plano do chão, em relação a quem recebeu a
 * pose. A tabela é medida com o boneco de origem olhando para +Z (o giro que
 * o usuário deu a ele entra aqui como `headingDeg`), e a escala converte a
 * distância da altura de referência para a dos bonecos em cena.
 */
export function resolvePairedOffset(gapM: number, headingDeg: number, scale = 1): [number, number] {
  const rad = THREE.MathUtils.degToRad(headingDeg)
  const gap = gapM * scale
  return [cleanNumber(Math.sin(rad) * gap), cleanNumber(Math.cos(rad) * gap)]
}

/**
 * Rotação do parceiro: a colocação canônica da pose dele COMPOSTA com o giro
 * de encenação de quem recebeu a pose (mais os 180° quando os dois se
 * encaram). Feita por matriz, e não somando graus em `y`, porque somar só
 * funciona quando a pose do parceiro é em pé: nas poses que já impõem
 * rotação (deitado no colo, mata-leão deitado) os ângulos de Euler não se
 * somam — mexer em `y` ali ROLA o corpo em torno do próprio eixo em vez de
 * mudar a direção que ele encara.
 */
export function resolvePairedRotation(
  counterpart: PosePresetKey,
  headingDeg: number,
  facing: boolean,
): JointRotation {
  const placement = resolvePosePresetPlacement(counterpart)
  return composePlacementRotation(placement.rotation, headingDeg + (facing ? 180 : 0))
}

/**
 * A rotação imposta por uma pose COMPOSTA com um giro no chão (Y) — a conta
 * central de `resolvePairedRotation`, exposta à parte porque os trechos de
 * animação (`animationClips.ts`) precisam dela para qualquer pose, não só para
 * o parceiro de um par.
 */
export function composePlacementRotation(rotation: JointRotation, turnDeg: number): JointRotation {
  // Caso comum (toda pose em pé/ajoelhada/sentada): a colocação da pose não
  // inclina o boneco, então o giro é só um número somado em Y. Vale a pena
  // separar porque a decomposição por matriz, sendo exata, ainda assim
  // escolheria uma forma equivalente porém ilegível ({180, 0, 180} em vez de
  // {0, 180, 0}) — e são esses graus que aparecem nos campos de rotação.
  if (rotation.x === 0 && rotation.z === 0) {
    return { x: 0, y: cleanDegrees(rotation.y + turnDeg), z: 0 }
  }

  const own = new THREE.Euler(
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z),
  )
  const composed = new THREE.Matrix4()
    .makeRotationY(THREE.MathUtils.degToRad(turnDeg))
    .multiply(new THREE.Matrix4().makeRotationFromEuler(own))
  const euler = new THREE.Euler().setFromRotationMatrix(composed, 'XYZ')

  return {
    x: cleanDegrees(THREE.MathUtils.radToDeg(euler.x)),
    y: cleanDegrees(THREE.MathUtils.radToDeg(euler.y)),
    z: cleanDegrees(THREE.MathUtils.radToDeg(euler.z)),
  }
}

/**
 * Arredonda a 1e-4 grau e mantém o resultado dentro de (-180, 180]. O
 * arredondamento não é cosmético: sem ele o ruído de ponto flutuante da
 * decomposição da matriz (1e-15 grau) vaza para a cena salva e para as
 * comparações de igualdade do undo.
 */
function cleanDegrees(degrees: number): number {
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180
  return cleanNumber(wrapped === -180 ? 180 : wrapped)
}

function cleanNumber(value: number): number {
  const rounded = Math.round(value * 1e4) / 1e4
  return rounded === 0 ? 0 : rounded
}

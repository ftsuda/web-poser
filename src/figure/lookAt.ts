import * as THREE from 'three'
import { buildJointFrames } from './jointFrames'
import type { JointRotation } from './skeleton'
import type { Figure } from '../store/figuresStore'
import { commitQuaternion, type Solve } from '../pose-import/poseSolver'

/**
 * Fração do giro que cabe ao PESCOÇO. Sai da razão entre as amplitudes do
 * esqueleto: o pescoço tem o dobro da faixa da cabeça em todos os eixos, então
 * 2/3 para ele e 1/3 para ela fazem as duas chegarem juntas ao limite.
 */
const NECK_SHARE = 2 / 3

/**
 * "Olhar para" (PLANO.md item 32, `DECISOES.md` #123): mira o rosto do boneco
 * num ponto do mundo, girando pescoço e cabeça.
 *
 * É o gesto mais repetido ao montar cena com dois bonecos, e até aqui só
 * existia como dois pares de sliders — ajustados por tentativa, porque o
 * ângulo certo depende de onde o outro boneco está.
 *
 * **A repartição segue as AMPLITUDES**, não é meio a meio. Dar tudo à cabeça
 * bateria no limite dela (±30° em Y) e o boneco olharia torto de lado; meio a
 * meio parece justo e também não serve, porque o pescoço tem o dobro da
 * amplitude da cabeça em todos os eixos (y ±60 contra ±30, x 90° contra 40°) —
 * dividido ao meio, a cabeça satura antes e o olhar erra o alvo por vários
 * graus. Cada junta leva a fração da sua própria faixa. Passando da soma das
 * duas, o `commit` grampeia e o boneco vira o quanto pode: honesto, em vez de
 * torcer o pescoço.
 *
 * **A cadeia acima do pescoço não é tocada.** O tronco fica como está: quem
 * posou o corpo não quer que mirar o olhar o desmanche. O frame do `upperChest`
 * vem da FK atual, então a raiz e todo o tronco entram na conta.
 *
 * Junta travada não se mexe (#42): trave o pescoço e só a cabeça responde.
 */
export function solveLookAt(
  figure: Figure,
  target: readonly [number, number, number],
  lockedJoints: readonly string[] = [],
): Record<string, JointRotation> | null {
  const neckLocked = lockedJoints.includes('neck')
  const headLocked = lockedJoints.includes('head')
  if (neckLocked && headLocked) return null

  const { joints } = buildJointFrames(figure)
  const headGroup = joints.get('head')
  const neckGroup = joints.get('neck')
  const parentGroup = joints.get('upperChest')
  if (!headGroup || !neckGroup || !parentGroup) return null

  const headPosition = headGroup.getWorldPosition(new THREE.Vector3())
  const wanted = new THREE.Vector3(...target).sub(headPosition)
  // Alvo em cima da própria cabeça: não há direção para onde olhar.
  if (wanted.lengthSq() < 1e-8) return null
  wanted.normalize()

  const headWorld = headGroup.getWorldQuaternion(new THREE.Quaternion())
  const neckWorld = neckGroup.getWorldQuaternion(new THREE.Quaternion())
  // O rosto é o +Z local da cabeça — a mesma convenção do `solveNeckHead`.
  const currentGaze = new THREE.Vector3(0, 0, 1).applyQuaternion(headWorld).normalize()
  const swing = new THREE.Quaternion().setFromUnitVectors(currentGaze, wanted)

  // O `Solve` empresta o grampo e a propagação de mundo do solver de pose: o
  // pescoço é grampeado primeiro e a cabeça resolve contra o que SOBROU, então
  // ela compensa o que o pescoço não alcançou.
  const solve: Solve = { pose: {}, world: new Map() }
  solve.world.set('upperChest', parentGroup.getWorldQuaternion(new THREE.Quaternion()))

  if (neckLocked) {
    solve.world.set('neck', neckWorld)
  } else {
    const share = new THREE.Quaternion().slerp(swing, NECK_SHARE)
    const neckTarget = share.clone().multiply(neckWorld)
    commitQuaternion(solve, 'neck', solve.world.get('upperChest')!.clone().invert().multiply(neckTarget))
  }

  if (!headLocked) {
    const headTarget = swing.clone().multiply(headWorld)
    commitQuaternion(solve, 'head', solve.world.get('neck')!.clone().invert().multiply(headTarget))
  }

  return solve.pose
}

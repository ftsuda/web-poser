import * as THREE from 'three'
import { clampJointRotation, getJoint, type JointRotation } from '../figure/skeleton'

/**
 * O miolo COMPARTILHADO da inferência de pose: pontos no mundo → rotações por
 * junta nas convenções do `buildJointFrames`, grampeadas pelos limites. Nasceu
 * dentro do `retarget.ts` (#109) e foi extraído quando a marcação manual
 * (PLANO.md > "Pose por marcação manual") precisou do MESMO solver com outra
 * origem de pontos — landmarks do BlazePose lá, toques do usuário aqui.
 *
 * Quem chama monta o `Solve` (com o quaternion de MUNDO da raiz já posto) e
 * decide de onde vêm as direções; este módulo só sabe resolver junta a junta:
 * frames ortonormais para o tronco, menor arco + plano do membro para
 * ombro/quadril, `atan2` nas dobradiças. Tudo puro, sem avisos embutidos —
 * cada chamador fala com o usuário na língua dele (a CLI imprime, a UI traduz).
 */

/** Ângulo mínimo de dobra (graus) para o plano do membro ser confiável. */
export const PLANE_MIN_BEND_DEG = 12

export const Y_UP = new THREE.Vector3(0, 1, 0)
export const Y_DOWN = new THREE.Vector3(0, -1, 0)
export const Z_FORWARD = new THREE.Vector3(0, 0, 1)

export function radToDegRotation(euler: THREE.Euler): JointRotation {
  return {
    x: THREE.MathUtils.radToDeg(euler.x),
    y: THREE.MathUtils.radToDeg(euler.y),
    z: THREE.MathUtils.radToDeg(euler.z),
  }
}

export function quatFromDegrees(rotation: JointRotation): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z),
      'XYZ',
    ),
  )
}

/** Frame ortonormal → quaternion; `x`/`y` são as imagens desejadas dos eixos locais X e Y. */
export function quatFromAxes(x: THREE.Vector3, y: THREE.Vector3): THREE.Quaternion {
  const ex = x.clone().normalize()
  const ey = y.clone().sub(ex.clone().multiplyScalar(y.dot(ex))).normalize()
  const ez = ex.clone().cross(ey)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez))
}

/** Estado da resolução: pose acumulada e quaternion de MUNDO de cada junta já resolvida. */
export interface Solve {
  pose: Record<string, JointRotation>
  world: Map<string, THREE.Quaternion>
}

/**
 * Grava a rotação local (já em graus), grampeada pelos limites, e propaga o
 * quaternion de mundo — os filhos são resolvidos contra o que FICOU depois do
 * grampo, não contra o alvo ideal, para compensarem no que puderem.
 */
export function commit(solve: Solve, jointName: string, rotation: Partial<JointRotation>): JointRotation {
  const clamped = clampJointRotation(jointName, rotation)
  solve.pose[jointName] = clamped
  const parent = getJoint(jointName).parent
  const parentWorld = parent ? solve.world.get(parent) : undefined
  const local = quatFromDegrees(clamped)
  solve.world.set(jointName, parentWorld ? parentWorld.clone().multiply(local) : local)
  return clamped
}

export function commitQuaternion(solve: Solve, jointName: string, local: THREE.Quaternion): JointRotation {
  return commit(solve, jointName, radToDegRotation(new THREE.Euler().setFromQuaternion(local, 'XYZ')))
}

/** A direção-alvo, trazida do mundo para o frame do PAI da junta (onde a rotação local age). */
export function directionInPreFrame(solve: Solve, jointName: string, worldDirection: THREE.Vector3): THREE.Vector3 {
  const parent = getJoint(jointName).parent
  const parentWorld = parent ? solve.world.get(parent) : undefined
  const direction = worldDirection.clone()
  if (parentWorld) direction.applyQuaternion(parentWorld.clone().invert())
  return direction.normalize()
}

/**
 * Junta esférica de membro (ombro/quadril): osso de repouso em −Y local. Sem
 * plano, menor arco; com o plano do membro (a articulação seguinte dobrada), o
 * eixo da dobradiça também é alinhado — `hingeSign` diz para que lado do X
 * local a normal do plano aponta (braços −1, pernas +1, ver a derivação no
 * teste de ida-e-volta do retarget).
 */
export function solveLimbRoot(
  solve: Solve,
  jointName: string,
  boneWorldDir: THREE.Vector3,
  plane: { normalWorld: THREE.Vector3; hingeSign: 1 | -1 } | null,
): void {
  const bone = directionInPreFrame(solve, jointName, boneWorldDir)
  const swing = new THREE.Quaternion().setFromUnitVectors(Y_DOWN, bone)

  if (plane) {
    const normal = directionInPreFrame(solve, jointName, plane.normalWorld)
    normal.sub(bone.clone().multiplyScalar(normal.dot(bone)))
    if (normal.lengthSq() > 1e-6) {
      normal.normalize()
      // As duas orientações do plano (normal para +X ou −X local) dão o mesmo
      // plano — mas uma delas é o frame girado 180° em torno do osso, que a
      // decomposição de Euler estoura em x/y/z grandes e o grampo mutila.
      // Fica a mais próxima do MENOR ARCO: com dados consistentes é a do
      // `hingeSign` derivado; com dados contraditórios (uma marca levantada
      // do plano sem a vizinha), é a que não vira o membro do avesso.
      const aligned = quatFromAxes(normal.clone().multiplyScalar(plane.hingeSign), bone.clone().negate())
      const flipped = quatFromAxes(normal.clone().multiplyScalar(-plane.hingeSign), bone.clone().negate())
      commitQuaternion(
        solve,
        jointName,
        Math.abs(aligned.dot(swing)) >= Math.abs(flipped.dot(swing)) ? aligned : flipped,
      )
      return
    }
  }

  commitQuaternion(solve, jointName, swing)
}

/** Flexão de dobradiça (cotovelo/joelho): o osso seguinte, medido no frame da junta, por `atan2` no plano Y–Z. */
export function hingeFlexionDeg(solve: Solve, jointName: string, boneWorldDir: THREE.Vector3): number {
  const direction = directionInPreFrame(solve, jointName, boneWorldDir)
  return THREE.MathUtils.radToDeg(Math.atan2(-direction.z, -direction.y))
}

export function midpoint(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  return a.clone().add(b).multiplyScalar(0.5)
}

export function angleBetweenDeg(a: THREE.Vector3, b: THREE.Vector3): number {
  return THREE.MathUtils.radToDeg(a.angleTo(b))
}

/**
 * Um braço ou uma perna a partir dos três pontos de MUNDO (raiz do membro,
 * dobradiça, extremidade): resolve ombro/quadril com o plano do membro quando
 * há dobra suficiente, e a flexão da dobradiça por `atan2`. `hingeTwistDeg` é
 * a torção neutra a gravar na dobradiça (cotovelos ±90; joelhos 0).
 */
export function solveLimbFromPoints(
  solve: Solve,
  chain: { rootJoint: string; hingeJoint: string; hingeSign: 1 | -1; hingeTwistDeg?: number },
  root: THREE.Vector3,
  hinge: THREE.Vector3,
  end: THREE.Vector3,
): void {
  const upper = hinge.clone().sub(root).normalize()
  const lower = end.clone().sub(hinge).normalize()

  const bent = angleBetweenDeg(upper, lower) >= PLANE_MIN_BEND_DEG
  solveLimbRoot(
    solve,
    chain.rootJoint,
    upper,
    bent ? { normalWorld: upper.clone().cross(lower), hingeSign: chain.hingeSign } : null,
  )
  commit(solve, chain.hingeJoint, {
    x: hingeFlexionDeg(solve, chain.hingeJoint, lower),
    y: chain.hingeTwistDeg ?? 0,
  })
}

/**
 * Quebra mínima do tronco (graus) para a marca do meio valer sobre a
 * repartição meio a meio. Um deslize de 1% da altura no ponto da base do
 * tórax vale ~2,5° na coluna, e o peito compensa outro tanto no sentido
 * oposto: abaixo disso a marca diria ruído, e o ruído sairia como um S falso.
 */
export const TORSO_BREAK_MIN_DEG = 6

/**
 * O tronco: o frame dos ombros, repartido entre `spine` e `chest` (o detalhe
 * fino da coluna fica neutro — `upperChest` e clavículas zero). `rootQuat` é o
 * quaternion de MUNDO da raiz, já posto no `Solve` pelo chamador.
 *
 * Sem `midUp`, a repartição é meio a meio — um chute, o único possível quando
 * o que se conhece do tronco são as duas pontas. Com `midUp` (a direção do
 * centro dos quadris até a base do tórax marcada, #119), o ponto de quebra é
 * MEDIDO: a coluna responde pela parte de baixo e o peito pelo que falta para
 * chegar ao frame dos ombros. É o que separa um tronco arqueado de uma reta
 * inclinada. O retarget automático não passa `midUp`: o BlazePose não tem
 * marco no meio da coluna.
 */
export function solveTorso(
  solve: Solve,
  rootQuat: THREE.Quaternion,
  shoulderAxis: THREE.Vector3,
  up: THREE.Vector3,
  midUp: THREE.Vector3 | null = null,
): void {
  const torsoQuat = quatFromAxes(shoulderAxis, up)
  const torsoDelta = rootQuat.clone().invert().multiply(torsoQuat)
  const halfWorld = rootQuat.clone().multiply(new THREE.Quaternion().slerp(torsoDelta, 0.5))

  const spineWorld = midUp ? spineFromMidTorso(rootQuat, halfWorld, midUp) : halfWorld
  commitQuaternion(solve, 'spine', rootQuat.clone().invert().multiply(spineWorld))
  commitQuaternion(solve, 'chest', solve.world.get('spine')!.clone().invert().multiply(torsoQuat))
  commit(solve, 'upperChest', {})
  commit(solve, 'clavicle.L', {})
  commit(solve, 'clavicle.R', {})
}

/**
 * O quaternion de MUNDO da coluna a partir da base do tórax marcada.
 *
 * O ponto marcado NÃO fica na ponta do osso da coluna: entre a raiz e ele há
 * dois trechos, o fixo `root→spine` (que rotação nenhuma do tronco move) e o
 * `spine→chest`, esse sim girado pela coluna. Tomar a direção do composto como
 * se fosse a do osso subestima a quebra em ~40%. Desfazer o trecho fixo é
 * exato e cabe numa equação: com `d` a direção medida e `t` o comprimento até
 * o ponto, `|t·d − a·ŷ| = b` — sempre solúvel, porque no esqueleto b > a.
 *
 * O eixo transversal continua vindo da repartição meio a meio: um ponto SOBRE
 * o eixo do tronco diz a inclinação da coluna, nunca a torção em torno dela.
 */
function spineFromMidTorso(
  rootQuat: THREE.Quaternion,
  halfWorld: THREE.Quaternion,
  midUp: THREE.Vector3,
): THREE.Quaternion {
  const a = new THREE.Vector3(...getJoint('spine').position).length()
  const b = new THREE.Vector3(...getJoint('chest').position).length()

  const direction = midUp.clone().applyQuaternion(rootQuat.clone().invert())
  if (direction.lengthSq() < 1e-12) return halfWorld
  direction.normalize()

  const cos = direction.y
  const disc = a * a * cos * cos - a * a + b * b
  if (disc < 0) return halfWorld
  const reach = a * cos + Math.sqrt(disc)
  const bone = direction.multiplyScalar(reach).sub(new THREE.Vector3(0, a, 0))
  if (bone.lengthSq() < 1e-12) return halfWorld
  const boneWorld = bone.normalize().applyQuaternion(rootQuat)

  const defaultUp = Y_UP.clone().applyQuaternion(halfWorld)
  if (angleBetweenDeg(defaultUp, boneWorld) < TORSO_BREAK_MIN_DEG) return halfWorld

  // `quatFromAxes` preserva o PRIMEIRO eixo e projeta o segundo — aqui quem
  // não pode escorregar é a direção do osso, então o transversal entra já
  // perpendicular a ela.
  const across = new THREE.Vector3(1, 0, 0).applyQuaternion(halfWorld)
  across.sub(boneWorld.clone().multiplyScalar(across.dot(boneWorld)))
  if (across.lengthSq() < 1e-12) return halfWorld
  return quatFromAxes(across, boneWorld)
}

/**
 * Pescoço e cabeça: o prumo (direção do pescoço à cabeça, em mundo) e,
 * opcionalmente, a direção do olhar. `null` deixa a junta neutra.
 */
export function solveNeckHead(
  solve: Solve,
  neckWorldDir: THREE.Vector3 | null,
  faceWorldDir: THREE.Vector3 | null,
): void {
  if (neckWorldDir) {
    const neckDir = directionInPreFrame(solve, 'neck', neckWorldDir)
    commitQuaternion(solve, 'neck', new THREE.Quaternion().setFromUnitVectors(Y_UP, neckDir))
  } else {
    commit(solve, 'neck', {})
  }

  if (faceWorldDir) {
    const faceDir = directionInPreFrame(solve, 'head', faceWorldDir)
    commitQuaternion(solve, 'head', new THREE.Quaternion().setFromUnitVectors(Z_FORWARD, faceDir))
  } else {
    commit(solve, 'head', {})
  }
}

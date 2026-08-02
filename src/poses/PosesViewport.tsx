import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { findWorkingAnimation, keyframeStartTimesMs } from '../animation/animation'
import { ONION_SKIN_COLORS, ONION_SKIN_OPACITY, onionSkinFrames } from '../animation/onionSkin'
import { Figure } from '../figure/Figure'
import { ROOT_JOINT_NAME } from '../figure/skeleton'
import { solveJointDrag } from '../figure/dragSolver'
import { isPlacementPinned } from '../figure/jointPins'
import { BACKGROUND_COLORS, CAMERA_DEFAULTS, GRID_DIVISIONS, GROUND_SIZE } from '../scene/constants'
import { useAnimationStore } from '../store/animationStore'
import { effectiveLockedJoints, useFiguresStore } from '../store/figuresStore'
import { usePosesShellStore } from '../store/posesShellStore'
import { AXIS_COLORS, GIZMO_SCALE_PER_METER } from './gizmoStyle'
import { JointAxisRings } from './JointAxisRings'
import { twistAxisForJoint } from './jointTwist'
import { jointWorldPosition } from './posesEdit'
import {
  POSES_VIEWS,
  closestPointOnAxisToRay,
  projectPointerOnPlane,
  projectPointerOnViewPlane,
  viewCameraPose,
  type Vec3,
} from './posesViews'
import type { Axis } from '../figure/skeleton'

/**
 * O viewport do módulo de poses — um `<Canvas>` PRÓPRIO, e não o
 * `Viewport.tsx` do desktop adaptado (fronteira do plano, item 44: aquele
 * carrega CameraRig, máscara, régua, captura e gizmos que aqui não existem).
 * Uma única vista por vez: a câmera troca de posição/projeção ao mudar de
 * vista — sem `<View>`, sem scissor, sem segundo contexto WebGL.
 *
 * O arrasto de junta e o gesto de torção NÃO são testáveis por unit test
 * (mesma ressalva do gizmo do desktop) — falta a conferência visual no
 * navegador.
 */

/** Distância da câmera ortográfica ao alvo — só profundidade de cena, o tamanho vem do zoom. */
const ORTHO_DISTANCE_M = 10
/** Distância inicial da câmera em perspectiva da vista livre. */
const FREE_DISTANCE_M = 5
/** O alvo padrão das vistas: a altura do peito de um boneco de 1,70 m, no centro. */
const VIEW_TARGET: Vec3 = [0, 1, 0]
/** Altura de mundo (m) que a vista ortográfica enquadra de início. */
const ORTHO_FRAME_HEIGHT_M = 2.4
/** Raio (m, antes da escala de altura) do alvo de toque invisível por junta. */
const TOUCH_TARGET_RADIUS_M = 0.055
/** Giro acumulado (graus) de dois dedos a partir do qual o gesto vira torção, e não câmera. */
const TWIST_DECIDE_DEG = 10

/** Janela (ms) do duplo toque na junta = travar/destravar (item 50). */
const DOUBLE_TAP_MS = 350

interface DragState {
  figureId: string
  jointName: string
  /** Posição de mundo da junta no INÍCIO do arrasto — o plano de projeção fica preso a ela. */
  anchor: Vec3
  /** Colocação do boneco no início — o arrasto da raiz soma o delta a partir daqui. */
  startPosition: readonly [number, number, number]
  /**
   * Vista Livre: normal do plano paralelo à tela (a direção da câmera no
   * momento do toque). `null` nas vistas travadas — lá o plano vem do eixo.
   */
  planeNormal: Vec3 | null
  /** Arrasto por SETA do gizmo (vista Livre): o eixo do mundo que restringe o alvo. */
  axis: Axis | null
}

/** Direções e cores das setas do gizmo de translação — as cores por eixo são o padrão único (`gizmoStyle.ts`). */
const GIZMO_AXES: readonly { axis: Axis; dir: Vec3; color: string; rotation: [number, number, number] }[] = [
  { axis: 'x', dir: [1, 0, 0], color: AXIS_COLORS.x, rotation: [0, 0, -Math.PI / 2] },
  { axis: 'y', dir: [0, 1, 0], color: AXIS_COLORS.y, rotation: [0, 0, 0] },
  { axis: 'z', dir: [0, 0, 1], color: AXIS_COLORS.z, rotation: [Math.PI / 2, 0, 0] },
]

const GIZMO_AXIS_DIRS: Record<Axis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }

interface FreeViewGizmoProps {
  anchor: Vec3
  onAxisPointerDown: (axis: Axis) => (event: ThreeEvent<PointerEvent>) => void
}

/**
 * Gizmo de translação da vista Livre (#93) com TAMANHO CONSTANTE EM TELA
 * (item 48): o grupo é reescalado por quadro pela distância da câmera — longe
 * as setas não viram alvo de dedo minúsculo, perto não engolem o boneco.
 */
function FreeViewGizmo({ anchor, onAxisPointerDown }: FreeViewGizmoProps) {
  const groupRef = useRef<THREE.Group>(null)
  useFrame(({ camera: liveCamera }) => {
    const group = groupRef.current
    if (!group) return
    const distance = liveCamera.position.distanceTo(
      new THREE.Vector3(anchor[0], anchor[1], anchor[2]),
    )
    group.scale.setScalar(Math.min(3, Math.max(0.4, distance * GIZMO_SCALE_PER_METER)))
  })

  return (
    <group ref={groupRef} position={anchor as [number, number, number]}>
      {GIZMO_AXES.map(({ axis, color, rotation }) => (
        <group key={axis} rotation={rotation}>
          <mesh position={[0, 0.15, 0]} renderOrder={10}>
            <cylinderGeometry args={[0.006, 0.006, 0.18, 8]} />
            <meshBasicMaterial color={color} depthTest={false} />
          </mesh>
          <mesh position={[0, 0.26, 0]} renderOrder={10}>
            <coneGeometry args={[0.02, 0.05, 12]} />
            <meshBasicMaterial color={color} depthTest={false} />
          </mesh>
          <mesh visible={false} position={[0, 0.17, 0]} onPointerDown={onAxisPointerDown(axis)}>
            <cylinderGeometry args={[0.045, 0.045, 0.3, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

interface TwistPointer {
  x: number
  y: number
}

/** Ângulo (graus) da reta entre dois ponteiros — a base do gesto de torção. */
function pointerAngleDeg(a: TwistPointer, b: TwistPointer): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

function PosesCameraRig() {
  const viewKey = usePosesShellStore((state) => state.viewKey)
  const view = POSES_VIEWS[viewKey]
  const size = useThree((state) => state.size)

  if (view.ortho) {
    const pose = viewCameraPose(viewKey, VIEW_TARGET, ORTHO_DISTANCE_M)
    return (
      <OrthographicCamera
        key={viewKey}
        makeDefault
        position={pose.position as [number, number, number]}
        up={pose.up as [number, number, number]}
        zoom={size.height / ORTHO_FRAME_HEIGHT_M}
        near={CAMERA_DEFAULTS.near}
        far={CAMERA_DEFAULTS.far}
        onUpdate={(camera) => camera.lookAt(...VIEW_TARGET)}
      />
    )
  }

  const pose = viewCameraPose(viewKey, VIEW_TARGET, FREE_DISTANCE_M)
  return (
    <PerspectiveCamera
      key={viewKey}
      makeDefault
      position={pose.position as [number, number, number]}
      up={pose.up as [number, number, number]}
      fov={CAMERA_DEFAULTS.fov}
      near={CAMERA_DEFAULTS.near}
      far={CAMERA_DEFAULTS.far}
      onUpdate={(camera) => camera.lookAt(...VIEW_TARGET)}
    />
  )
}

/** Fantasmas do papel-cebola, ancorados no keyframe corrente da bancada (`currentKeyframeId`). */
function PosesOnionSkin() {
  const onionSkin = useAnimationStore((state) => state.onionSkin)
  const mode = useAnimationStore((state) => state.onionSkinMode)
  const animations = useFiguresStore((state) => state.animations)
  const currentKeyframeId = usePosesShellStore((state) => state.currentKeyframeId)

  if (!onionSkin) return null
  const working = findWorkingAnimation(animations)
  if (!working || working.keyframes.length === 0) return null

  const foundIndex = working.keyframes.findIndex((keyframe) => keyframe.id === currentKeyframeId)
  const index = foundIndex >= 0 ? foundIndex : working.keyframes.length - 1
  const timeMs = keyframeStartTimesMs(working)[index]
  const frames = onionSkinFrames(working, timeMs, mode)

  return (
    <>
      {frames.flatMap((frame) =>
        frame.keyframe.figures.map((figure) => (
          <Figure
            key={`${frame.role}-${frame.index}-${figure.id}`}
            figure={figure}
            ghost={{ color: ONION_SKIN_COLORS[frame.role], opacity: ONION_SKIN_OPACITY }}
            style="stick"
          />
        )),
      )}
    </>
  )
}

function PosesSceneContent() {
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const selectedJointName = useFiguresStore((state) => state.selectedJointName)
  const jointLocks = useFiguresStore((state) => state.jointLocks)
  const jointPins = useFiguresStore((state) => state.jointPins)
  const selectJoint = useFiguresStore((state) => state.selectJoint)
  const setJointRotations = useFiguresStore((state) => state.setJointRotations)
  const setJointRotation = useFiguresStore((state) => state.setJointRotation)
  const setRootRotation = useFiguresStore((state) => state.setRootRotation)
  const setPosition = useFiguresStore((state) => state.setPosition)
  const viewKey = usePosesShellStore((state) => state.viewKey)
  const showOnlyEditing = usePosesShellStore((state) => state.showOnlyEditing)
  const freeEditEnabled = usePosesShellStore((state) => state.freeEditEnabled)

  const view = POSES_VIEWS[viewKey]
  // A Livre edita quando DESTRAVADA (#93): arrasto no plano da tela + gizmo
  // de setas. Travada, continua sendo só conferência, como o item 44 pediu.
  const canEdit = view.editable || freeEditEnabled
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  // -----------------------------------------------------------------------
  // "Enquadrar boneco" (item 49): recentra a vista no boneco em edição — o
  // pan/zoom livres tornam fácil perdê-lo. Nas ortográficas repõe a câmera da
  // vista e o zoom que cabe a altura; na Livre mantém a DIREÇÃO de órbita
  // atual e só recentra/aproxima. Roda num callback de `useFrame` — câmera e
  // controles chegam como PARÂMETRO, que é o que a regra de imutabilidade dos
  // hooks permite mutar (mesma razão de o `CameraRig` operar assim).
  // -----------------------------------------------------------------------
  const appliedFrameSeqRef = useRef(usePosesShellStore.getState().frameRequestSeq)
  useFrame((rootState) => {
    const seq = usePosesShellStore.getState().frameRequestSeq
    if (seq === appliedFrameSeqRef.current) return
    appliedFrameSeqRef.current = seq
    const liveControls = rootState.controls as { target: THREE.Vector3; update: () => void } | null
    if (!liveControls) return
    const state = useFiguresStore.getState()
    const figure =
      state.figures.find((candidate) => candidate.id === state.selectedFigureId) ??
      state.figures[0]
    if (!figure) return
    const liveCamera = rootState.camera
    const center = new THREE.Vector3(
      figure.position[0],
      figure.position[1] + figure.height * 0.55,
      figure.position[2],
    )

    if (view.ortho) {
      const pose = viewCameraPose(viewKey, [center.x, center.y, center.z], ORTHO_DISTANCE_M)
      liveCamera.position.set(pose.position[0], pose.position[1], pose.position[2])
      liveCamera.up.set(pose.up[0], pose.up[1], pose.up[2])
      if (liveCamera instanceof THREE.OrthographicCamera) {
        liveCamera.zoom = rootState.size.height / (figure.height * 1.6)
        liveCamera.updateProjectionMatrix()
      }
    } else {
      const direction = liveCamera.position.clone().sub(liveControls.target)
      if (direction.lengthSq() < 1e-6) direction.set(0.557, 0.371, 0.743)
      direction.normalize().multiplyScalar(figure.height * 2.2)
      liveCamera.position.copy(center).add(direction)
    }
    liveControls.target.copy(center)
    liveControls.update()
  })

  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const twistRef = useRef<{
    pointers: Map<number, TwistPointer>
    lastAngle: number
    accumulated: number
    active: boolean
  } | null>(null)
  const [twisting, setTwisting] = useState(false)

  // ---------------------------------------------------------------------
  // Arrasto de junta: pointerdown na junta (alvo de toque invisível) começa;
  // o movimento projeta o raio do toque no plano da vista pela junta e
  // resolve com o MESMO `solveJointDrag` do desktop; soltar termina.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const dom = gl.domElement
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()

    // Coalescido por rAF (item 47): cada quadro resolve só o ÚLTIMO evento —
    // o solver e a re-renderização dos bonecos não rodam mais por pointermove.
    let pendingMove: PointerEvent | null = null
    let rafId = 0

    const processMove = () => {
      rafId = 0
      const event = pendingMove
      pendingMove = null
      if (!event) return
      const drag = dragRef.current
      if (!drag) return
      const rect = dom.getBoundingClientRect()
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      )
      raycaster.setFromCamera(ndc, camera)
      const origin: Vec3 = [raycaster.ray.origin.x, raycaster.ray.origin.y, raycaster.ray.origin.z]
      const dir: Vec3 = [
        raycaster.ray.direction.x,
        raycaster.ray.direction.y,
        raycaster.ray.direction.z,
      ]
      // Três formas do mesmo arrasto: por seta do gizmo (reta do eixo), no
      // plano da tela (vista Livre) ou no plano da vista travada.
      const target = drag.axis
        ? closestPointOnAxisToRay(drag.anchor, GIZMO_AXIS_DIRS[drag.axis], origin, dir)
        : drag.planeNormal
          ? projectPointerOnPlane(drag.anchor, drag.planeNormal, origin, dir)
          : projectPointerOnViewPlane(viewKey, drag.anchor, origin, dir)
      if (!target) return

      const state = useFiguresStore.getState()
      const figure = state.figures.find((candidate) => candidate.id === drag.figureId)
      if (!figure) return

      if (drag.jointName === ROOT_JOINT_NAME) {
        setPosition(drag.figureId, [
          drag.startPosition[0] + (target[0] - drag.anchor[0]),
          drag.startPosition[1] + (target[1] - drag.anchor[1]),
          drag.startPosition[2] + (target[2] - drag.anchor[2]),
        ])
        return
      }

      // Travas + congeladas por âncora + a raiz de boneco ancorado (item 62);
      // a raiz recrutada pelo alvo fora de alcance (item 63) entra no mesmo
      // passo de undo das juntas.
      const locked = effectiveLockedJoints(state, drag.figureId)
      const result = solveJointDrag(figure, drag.jointName, target, locked)
      setJointRotations(drag.figureId, result.rotations, result.rootRotation)
      // Vibração ao saturar o limite articular — reforço, nunca o único aviso
      // (não existe no Safari do iOS).
      if (!result.reached) navigator.vibrate?.(10)
    }

    const handleMove = (event: PointerEvent) => {
      if (!dragRef.current) return
      pendingMove = event
      if (!rafId) rafId = requestAnimationFrame(processMove)
    }

    const handleUp = () => {
      if (rafId) cancelAnimationFrame(rafId)
      // DESPACHA o movimento pendente em vez de descartá-lo: num gesto rápido
      // (ou com a thread presa — a primeira compilação de shader dos anéis do
      // item 60 chega a engolir o arrasto inteiro), o pointerup pode vencer o
      // rAF — sem isto, o último trecho do arrasto se perdia.
      if (dragRef.current && pendingMove) processMove()
      rafId = 0
      pendingMove = null
      if (!dragRef.current) return
      dragRef.current = null
      setDragging(false)
    }

    // Na WINDOW, não no canvas (item 45): um arrasto rápido leva o dedo para
    // fora do canvas antes do pointerup, e o listener local nunca receberia o
    // solto — o arrasto ficava "grudado" até o toque seguinte.
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [camera, gl, viewKey, setPosition, setJointRotations])

  // ---------------------------------------------------------------------
  // Torção com dois dedos: girar os dois ponteiros torce a junta selecionada
  // no próprio eixo. O gesto só "vence" a câmera depois de acumular
  // `TWIST_DECIDE_DEG` de giro — pinça (zoom) e arrasto de dois dedos (pan)
  // continuam com o OrbitControls até lá.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const dom = gl.domElement

    const handleDown = (event: PointerEvent) => {
      if (!view.editable) return
      const twist = twistRef.current ?? {
        pointers: new Map<number, TwistPointer>(),
        lastAngle: 0,
        accumulated: 0,
        active: false,
      }
      twist.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (twist.pointers.size === 2) {
        const [a, b] = [...twist.pointers.values()]
        twist.lastAngle = pointerAngleDeg(a, b)
        twist.accumulated = 0
        twist.active = false
      }
      twistRef.current = twist
    }

    const handleMove = (event: PointerEvent) => {
      const twist = twistRef.current
      if (!twist || !twist.pointers.has(event.pointerId)) return
      twist.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (twist.pointers.size !== 2) return

      const state = useFiguresStore.getState()
      const figureId = state.selectedFigureId
      const jointName = state.selectedJointName
      if (!figureId || !jointName) return
      const axis = twistAxisForJoint(jointName)
      if (!axis) return

      const [a, b] = [...twist.pointers.values()]
      const angle = pointerAngleDeg(a, b)
      let delta = angle - twist.lastAngle
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      twist.lastAngle = angle

      if (!twist.active) {
        twist.accumulated += delta
        if (Math.abs(twist.accumulated) < TWIST_DECIDE_DEG) return
        twist.active = true
        setTwisting(true)
        delta = twist.accumulated
      }

      const figure = state.figures.find((candidate) => candidate.id === figureId)
      if (!figure) return
      if (jointName === ROOT_JOINT_NAME) {
        setRootRotation(figureId, { y: figure.rotation.y + delta })
      } else {
        const current = figure.pose[jointName]?.y ?? 0
        setJointRotation(figureId, jointName, { y: current + delta })
      }
    }

    const handleUp = (event: PointerEvent) => {
      const twist = twistRef.current
      if (!twist) return
      twist.pointers.delete(event.pointerId)
      if (twist.pointers.size < 2) {
        twist.active = false
        twist.accumulated = 0
        setTwisting(false)
      }
    }

    // O gesto COMEÇA no canvas, mas mover/soltar valem na window (item 45):
    // dois dedos girando facilmente saem do canvas no meio do gesto.
    dom.addEventListener('pointerdown', handleDown)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      dom.removeEventListener('pointerdown', handleDown)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [gl, view.editable, setJointRotation, setRootRotation])

  const handleJointPointerDown = (figureId: string) => (jointName: string, event: ThreeEvent<PointerEvent>) => {
    if (!canEdit) return
    if (figureId !== selectedFigureId) return
    const state = useFiguresStore.getState()
    const figure = state.figures.find((candidate) => candidate.id === figureId)
    if (!figure) return
    selectJoint(jointName)
    // Colocação congelada por âncora (item 62): o arrasto da raiz nem começa —
    // o store recusaria cada movimento, e um arrasto que não faz nada confunde.
    if (jointName === ROOT_JOINT_NAME && isPlacementPinned(state.jointPins, figureId)) return
    const anchor = jointWorldPosition(figure, jointName)
    if (!anchor) return
    event.stopPropagation()
    // Na Livre o plano de arrasto é o paralelo à tela, preso à direção da
    // câmera NO MOMENTO do toque — orbitar depois de soltar não muda nada.
    const worldDir = view.editable
      ? null
      : camera.getWorldDirection(new THREE.Vector3())
    dragRef.current = {
      figureId,
      jointName,
      anchor,
      startPosition: figure.position,
      planeNormal: worldDir ? [worldDir.x, worldDir.y, worldDir.z] : null,
      axis: null,
    }
    setDragging(true)
  }

  // Duplo toque na junta = travar/destravar (item 50, previsto no item 44):
  // põe o cadeado onde a mão já está. A raiz fica de fora (não pode travar).
  const lastTapRef = useRef<{ figureId: string; jointName: string; time: number } | null>(null)
  const handleSelectJointTap = (figureId: string) => (jointName: string) => {
    selectJoint(jointName)
    const now = performance.now()
    const last = lastTapRef.current
    if (
      last &&
      last.figureId === figureId &&
      last.jointName === jointName &&
      now - last.time < DOUBLE_TAP_MS &&
      jointName !== ROOT_JOINT_NAME
    ) {
      useFiguresStore.getState().toggleJointLock(figureId, jointName)
      navigator.vibrate?.(20)
      lastTapRef.current = null
      return
    }
    lastTapRef.current = { figureId, jointName, time: now }
  }

  /** Início de arrasto numa SETA do gizmo (vista Livre): restringe o alvo ao eixo. */
  const handleGizmoPointerDown = (axis: Axis) => (event: ThreeEvent<PointerEvent>) => {
    const state = useFiguresStore.getState()
    const figureId = state.selectedFigureId
    const jointName = state.selectedJointName
    if (!figureId || !jointName) return
    const figure = state.figures.find((candidate) => candidate.id === figureId)
    if (!figure) return
    // Mesma guarda do arrasto direto: raiz de boneco ancorado não translada.
    if (jointName === ROOT_JOINT_NAME && isPlacementPinned(state.jointPins, figureId)) return
    const anchor = jointWorldPosition(figure, jointName)
    if (!anchor) return
    event.stopPropagation()
    dragRef.current = {
      figureId,
      jointName,
      anchor,
      startPosition: figure.position,
      planeNormal: null,
      axis,
    }
    setDragging(true)
  }

  const visibleFigures =
    showOnlyEditing && selectedFigureId
      ? figures.filter((figure) => figure.id === selectedFigureId)
      : figures

  return (
    <>
      <PosesCameraRig />
      <color attach="background" args={[BACKGROUND_COLORS.medium]} />
      <hemisphereLight args={['#ffffff', '#666666', 0.9]} />
      <directionalLight position={[4, 8, 5]} intensity={0.7} />
      <gridHelper args={[GROUND_SIZE, GRID_DIVISIONS]} />

      {visibleFigures.map((figure) => {
        const isEditing = figure.id === selectedFigureId
        return (
          <Figure
            key={figure.id}
            figure={figure}
            // Palito onde há edição (vistas ortográficas e a Livre
            // destravada); manequim completo na Livre travada — que continua
            // sendo a vista de conferência (#93).
            style={canEdit ? 'stick' : 'wooden'}
            selectedJointName={isEditing ? selectedJointName : null}
            lockedJointNames={isEditing ? (jointLocks[figure.id] ?? null) : null}
            pinnedJointNames={isEditing ? (jointPins[figure.id] ?? null) : null}
            onSelectJoint={isEditing && canEdit ? handleSelectJointTap(figure.id) : undefined}
            touchTargetRadius={isEditing && canEdit ? TOUCH_TARGET_RADIUS_M : undefined}
            onJointPointerDown={isEditing && canEdit ? handleJointPointerDown(figure.id) : undefined}
          />
        )
      })}

      {/* Gizmo de translação da vista Livre (#93): três setas de eixo com
          haste invisível gorda para o dedo. Só com edição destravada e junta
          selecionada; nas vistas travadas o plano da vista já faz o serviço. */}
      {!view.editable && freeEditEnabled && selectedFigureId && selectedJointName && (() => {
        const figure = figures.find((candidate) => candidate.id === selectedFigureId)
        const anchor = figure ? jointWorldPosition(figure, selectedJointName) : null
        if (!anchor) return null
        return <FreeViewGizmo anchor={anchor} onAxisPointerDown={handleGizmoPointerDown} />
      })()}

      {/* Anéis gimbal da junta selecionada (item 60): leitura dos eixos de
          rotação em TODAS as vistas de edição — na Livre destravada convivem
          com as setas (setas arrastam, anéis só leem). */}
      {canEdit && selectedFigureId && selectedJointName && (() => {
        const figure = figures.find((candidate) => candidate.id === selectedFigureId)
        if (!figure) return null
        return <JointAxisRings figure={figure} jointName={selectedJointName} />
      })()}

      <PosesOnionSkin />

      {/* Nas vistas de edição a câmera NÃO gira (a vista é a projeção), mas
          desloca e aproxima (pedido do usuário; era o previsto no item 44 —
          sem isso não se alcança junta pequena no celular): um dedo em espaço
          vazio (ou o botão esquerdo do mouse) TRANSLADA; pinça, dois dedos e a
          roda dão zoom. Um dedo sobre a junta continua sendo arrasto de pose —
          o pointerdown da junta desliga os controles antes do movimento. Na
          vista livre, o padrão do OrbitControls (um dedo orbita). */}
      <OrbitControls
        key={viewKey}
        makeDefault
        enabled={!dragging && !twisting}
        enableRotate={!view.ortho}
        mouseButtons={
          view.ortho
            ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
            : undefined
        }
        touches={
          view.ortho
            ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
            : undefined
        }
        target={VIEW_TARGET as [number, number, number]}
      />
    </>
  )
}

export function PosesViewport() {
  return (
    <div className="poses-viewport">
      {/* `touch-action: none`: sem isso o navegador rouba o arrasto para
          rolar a página — o maior atrito de canvas no celular (item 44). */}
      <Canvas style={{ touchAction: 'none' }}>
        <PosesSceneContent />
      </Canvas>
    </div>
  )
}

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore } from '../store/figuresStore'
import { useUIStore } from '../store/uiStore'
import { OVERLAY_NAMES } from './constants'
import { useOutputAspect } from './outputAspect'
import { getSceneCameraObject } from './sceneCameraObject'

export interface SceneCameraGizmoProps {
  onDraggingChange?: (dragging: boolean) => void
}

/** Profundidade do tronco do frustum desenhado, em metros — só representação, não o `far` real. */
const FRUSTUM_DEPTH = 0.45

/** Cores do gizmo: apagado no trabalho normal, aceso quando selecionado. */
const BODY_COLOR = '#c8c8c8'
const BODY_COLOR_SELECTED = '#ffb020'
const LINE_COLOR = '#3a3a3a'
const LINE_COLOR_SELECTED = '#b87700'

/**
 * A representação VISUAL da câmera de cena no viewport (fase 11), na
 * convenção do Blender: um corpo com o tronco de pirâmide do campo de visão e
 * um triângulo marcando o topo do quadro. Clicar seleciona a câmera (e
 * desseleciona o boneco); com ela selecionada, W/E alternam entre mover e
 * girar, com o mesmo `TransformControls` das juntas.
 *
 * O grupo não é posicionado por estado React: um `useFrame` o faz seguir o
 * OBJETO vivo (`sceneCameraObject.ts`) a cada quadro. É o que deixa o gizmo
 * acompanhar tanto os comandos do painel (estado → objeto, via `CameraRig`)
 * quanto a reprodução de animação, que move o objeto imperativamente sem
 * passar pelo store.
 *
 * Some no modo visão-câmera (não há como olhar para a câmera de dentro dela) e
 * está em `OVERLAY_NAMES`: PNG e MP4 nunca o mostram. Como os demais gizmos, o
 * arrasto em si não tem teste automatizado — a fiação de seleção e o cálculo do
 * frustum são o que se valida.
 */
export function SceneCameraGizmo({ onDraggingChange }: SceneCameraGizmoProps) {
  const viewMode = useCameraStore((state) => state.viewMode)
  const cameraSelected = useCameraStore((state) => state.cameraSelected)
  const setCameraSelected = useCameraStore((state) => state.setCameraSelected)
  const selectFigure = useFiguresStore((state) => state.selectFigure)
  const setSceneCamera = useFiguresStore((state) => state.setSceneCamera)
  const gizmoMode = useUIStore((state) => state.gizmoMode)
  const fov = useCameraStore((state) => state.fov)
  const aspect = useOutputAspect()

  const groupRef = useRef<THREE.Group>(null)
  const draggingRef = useRef(false)
  // O `TransformControls` precisa do objeto REAL: estado (e não só ref) para
  // que a seleção re-renderize já com o grupo montado.
  const [group, setGroup] = useState<THREE.Group | null>(null)

  // Segue o objeto vivo — ver comentário do componente. Suspenso durante o
  // arrasto: ali quem manda no grupo é o `TransformControls`, e o espelho
  // rodando por baixo faria o gizmo tremer entre o ponteiro e o estado.
  useFrame(() => {
    const target = groupRef.current
    if (!target || draggingRef.current) return
    const camera = getSceneCameraObject()
    target.position.copy(camera.position)
    target.quaternion.copy(camera.quaternion)
  })

  /**
   * Linhas do frustum: origem → quatro cantos de um quadro a `FRUSTUM_DEPTH`
   * na frente da lente (−Z local), mais o próprio quadro. A abertura vem do
   * `fov` real e a proporção é a da SAÍDA — o gizmo mostra o quadro que o
   * arquivo vai ter.
   */
  const frustumGeometry = useMemo(() => {
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * FRUSTUM_DEPTH
    const halfWidth = halfHeight * aspect
    const z = -FRUSTUM_DEPTH
    const corners = [
      [-halfWidth, halfHeight, z],
      [halfWidth, halfHeight, z],
      [halfWidth, -halfHeight, z],
      [-halfWidth, -halfHeight, z],
    ] as const

    const positions: number[] = []
    for (const corner of corners) positions.push(0, 0, 0, ...corner)
    for (let index = 0; index < corners.length; index += 1) {
      positions.push(...corners[index], ...corners[(index + 1) % corners.length])
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geometry
  }, [fov, aspect])

  /** Triângulo do topo do quadro — a marca de "este lado é para cima" do Blender. */
  const upTriangleGeometry = useMemo(() => {
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * FRUSTUM_DEPTH
    const halfWidth = halfHeight * aspect
    const z = -FRUSTUM_DEPTH
    const base = halfHeight * 1.05
    const positions = [
      -halfWidth * 0.35, base, z,
      halfWidth * 0.35, base, z,
      0, base + halfHeight * 0.5, z,
    ]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.computeVertexNormals()
    return geometry
  }, [fov, aspect])

  if (viewMode === 'camera') return null

  const handleSelect = () => {
    // Seleção exclusiva: a câmera OU um boneco, nunca os dois gizmos juntos.
    selectFigure(null)
    setCameraSelected(true)
  }

  /**
   * Devolve o arrasto ao estado: mover translada posição E alvo juntos (a
   * direção de visão não muda); girar mantém a posição e leva o alvo pelo novo
   * olhar, preservando a distância — é a distância que os planos e o controle
   * de órbita do modo visão usam.
   */
  const handleObjectChange = () => {
    const dragged = groupRef.current
    if (!dragged) return
    const state = useFiguresStore.getState().sceneCamera

    if (gizmoMode === 'translate') {
      const dx = dragged.position.x - state.position[0]
      const dy = dragged.position.y - state.position[1]
      const dz = dragged.position.z - state.position[2]
      setSceneCamera({
        ...state,
        position: [dragged.position.x, dragged.position.y, dragged.position.z],
        target: [state.target[0] + dx, state.target[1] + dy, state.target[2] + dz],
      })
      return
    }

    const distance =
      new THREE.Vector3(...state.target).distanceTo(new THREE.Vector3(...state.position)) || 1
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(dragged.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(dragged.quaternion)
    const target = new THREE.Vector3(...state.position).addScaledVector(forward, distance)
    setSceneCamera({
      ...state,
      target: [target.x, target.y, target.z],
      up: [up.x, up.y, up.z],
    })
  }

  return (
    <>
      <group
        ref={(node) => {
          groupRef.current = node
          setGroup(node)
        }}
        name={OVERLAY_NAMES.sceneCamera}
      >
        {/* Corpo clicável — atrás da lente, como no Blender. */}
        <mesh
          position={[0, 0, 0.14]}
          onClick={(event) => {
            event.stopPropagation()
            handleSelect()
          }}
        >
          <boxGeometry args={[0.18, 0.14, 0.24]} />
          <meshStandardMaterial color={cameraSelected ? BODY_COLOR_SELECTED : BODY_COLOR} />
        </mesh>
        <lineSegments geometry={frustumGeometry}>
          <lineBasicMaterial color={cameraSelected ? LINE_COLOR_SELECTED : LINE_COLOR} />
        </lineSegments>
        <mesh geometry={upTriangleGeometry}>
          <meshBasicMaterial
            color={cameraSelected ? BODY_COLOR_SELECTED : BODY_COLOR}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {cameraSelected && group && (
        <TransformControls
          object={group}
          mode={gizmoMode}
          space={gizmoMode === 'rotate' ? 'local' : 'world'}
          onObjectChange={handleObjectChange}
          onMouseDown={() => {
            draggingRef.current = true
            onDraggingChange?.(true)
          }}
          onMouseUp={() => {
            draggingRef.current = false
            onDraggingChange?.(false)
          }}
        />
      )}
    </>
  )
}

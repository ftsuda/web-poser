import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { getLockedRootAxes } from '../figure/jointLocks'
import { ROOT_JOINT_NAME, getJointAxes } from '../figure/skeleton'
import { useFiguresStore } from '../store/figuresStore'
import { beginUndoBatch, endUndoBatch } from '../store/undoBatch'
import type { GizmoMode } from '../store/uiStore'

export interface SelectionGizmoProps {
  figureId: string
  jointName: string
  target: THREE.Object3D
  onDraggingChange?: (dragging: boolean) => void
  /**
   * Só vale para o `root`: mover (colocação no chão) ou girar (orientação do
   * boneco em torno do próprio pivô do quadril) — fase 9, item 13. No modo
   * `rotate`, o `target` precisa ser o grupo interno da raiz (o que carrega
   * `figure.rotation`), não o grupo externo da colocação (ver DECISOES.md #7).
   * Nas demais juntas este componente é sempre rotação — o modo `translate`
   * delas é outro componente (`JointDragGizmo`, arrasto de cadeia).
   */
  rootMode?: GizmoMode
}

/**
 * Gizmo 3D anexado à junta selecionada — gizmo de translação (root, plano do
 * chão) ou de rotação (demais juntas, restrita aos eixos que são grau de
 * liberdade daquela junta). Ver PLANO.md > "Interação de pose", passos 1-2.
 * A interação de arrastar não é testável por automação (ver DECISOES.md) —
 * este componente só tem a fiação de props coberta por teste.
 */
export function SelectionGizmo({
  figureId,
  jointName,
  target,
  onDraggingChange,
  rootMode = 'translate',
}: SelectionGizmoProps) {
  const setPosition = useFiguresStore((state) => state.setPosition)
  const setRootRotation = useFiguresStore((state) => state.setRootRotation)
  const setJointRotation = useFiguresStore((state) => state.setJointRotation)
  const jointLocks = useFiguresStore((state) => state.jointLocks)

  const isRoot = jointName === ROOT_JOINT_NAME
  const isRootTranslate = isRoot && rootMode === 'translate'
  // O root aceita translação livre nos 3 eixos — inclusive Y, para levantar o
  // boneco do chão (a sombra acompanha só X/Z e fica presa ao plano, dando
  // noção da altura; ver `FigureShadow` em Figure.tsx) — e, no modo rotate,
  // rotação nos eixos DESTRAVADOS (colocação não passa por limites
  // articulares, mas passa pela trava por eixo do item 64: o anel do eixo
  // travado some, como somem os eixos que não são DOF de uma junta).
  const lockedRootAxes = isRoot && rootMode === 'rotate' ? getLockedRootAxes(jointLocks, figureId) : []
  const axes = (isRoot ? (['x', 'y', 'z'] as const) : getJointAxes(jointName)).filter(
    (axis) => !lockedRootAxes.includes(axis),
  )

  const readRotationDegrees = () => ({
    x: THREE.MathUtils.radToDeg(target.rotation.x),
    y: THREE.MathUtils.radToDeg(target.rotation.y),
    z: THREE.MathUtils.radToDeg(target.rotation.z),
  })

  const handleObjectChange = () => {
    if (isRootTranslate) {
      setPosition(figureId, [target.position.x, target.position.y, target.position.z])
      return
    }

    if (isRoot) {
      setRootRotation(figureId, readRotationDegrees())
      return
    }

    setJointRotation(figureId, jointName, readRotationDegrees())
  }

  return (
    <TransformControls
      object={target}
      mode={isRootTranslate ? 'translate' : 'rotate'}
      space="local"
      showX={axes.includes('x')}
      showY={axes.includes('y')}
      showZ={axes.includes('z')}
      onObjectChange={handleObjectChange}
      // Mover ou girar é um gesto só, e um passo de undo só (DECISOES.md #118).
      onMouseDown={() => {
        beginUndoBatch()
        onDraggingChange?.(true)
      }}
      onMouseUp={() => {
        endUndoBatch()
        onDraggingChange?.(false)
      }}
    />
  )
}

import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { ROOT_JOINT_NAME, getJointAxes } from '../figure/skeleton'
import { useFiguresStore } from '../store/figuresStore'

export interface SelectionGizmoProps {
  figureId: string
  jointName: string
  target: THREE.Object3D
  onDraggingChange?: (dragging: boolean) => void
}

/**
 * Gizmo 3D anexado à junta selecionada — gizmo de translação (root, plano do
 * chão) ou de rotação (demais juntas, restrita aos eixos que são grau de
 * liberdade daquela junta). Ver PLANO.md > "Interação de pose", passos 1-2.
 * A interação de arrastar não é testável por automação (ver DECISOES.md) —
 * este componente só tem a fiação de props coberta por teste.
 */
export function SelectionGizmo({ figureId, jointName, target, onDraggingChange }: SelectionGizmoProps) {
  const setPosition = useFiguresStore((state) => state.setPosition)
  const setJointRotation = useFiguresStore((state) => state.setJointRotation)

  const isRoot = jointName === ROOT_JOINT_NAME
  // O root aceita translação livre nos 3 eixos — inclusive Y, para levantar o
  // boneco do chão (a sombra acompanha só X/Z e fica presa ao plano, dando
  // noção da altura; ver `FigureShadow` em Figure.tsx).
  const axes = isRoot ? (['x', 'y', 'z'] as const) : getJointAxes(jointName)

  const handleObjectChange = () => {
    if (isRoot) {
      setPosition(figureId, [target.position.x, target.position.y, target.position.z])
      return
    }

    setJointRotation(figureId, jointName, {
      x: THREE.MathUtils.radToDeg(target.rotation.x),
      y: THREE.MathUtils.radToDeg(target.rotation.y),
      z: THREE.MathUtils.radToDeg(target.rotation.z),
    })
  }

  return (
    <TransformControls
      object={target}
      mode={isRoot ? 'translate' : 'rotate'}
      space="local"
      showX={axes.includes('x')}
      showY={axes.includes('y')}
      showZ={axes.includes('z')}
      onObjectChange={handleObjectChange}
      onMouseDown={() => onDraggingChange?.(true)}
      onMouseUp={() => onDraggingChange?.(false)}
    />
  )
}

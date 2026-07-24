import { useState } from 'react'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { applyIKTarget } from '../figure/ikActions'
import { useIKStore } from '../store/ikStore'

export interface IKTargetGizmoProps {
  figureId: string
  endEffector: string
  onDraggingChange?: (dragging: boolean) => void
}

const REACHED_COLOR = '#4ade80'
const UNREACHABLE_COLOR = '#ef4444'
const TARGET_RADIUS = 0.035

/**
 * Alvo arrastável do IK (fase 7) — uma esfera livre no mundo (não presa a
 * nenhuma junta) que o usuário arrasta para posicionar a mão/pé; a cada
 * mudança, resolve a cadeia (`ikActions.ts`) e grava a pose resultante no
 * `figuresStore`, como qualquer outra edição via gizmo. Muda de cor
 * (verde/vermelho) conforme o alvo está ou não dentro do alcance do membro
 * — decisão confirmada com o usuário (ver DECISOES.md #12). Assim como
 * `SelectionGizmo.tsx`, a interação de arrastar não é testável por
 * automação — validado manualmente no navegador.
 */
export function IKTargetGizmo({ figureId, endEffector, onDraggingChange }: IKTargetGizmoProps) {
  const [targetObject, setTargetObject] = useState<THREE.Group | null>(null)
  const target = useIKStore((state) => state.getTarget(figureId, endEffector))
  const reached = useIKStore((state) => state.getReached(figureId, endEffector))

  const handleObjectChange = () => {
    if (!targetObject) return
    applyIKTarget(figureId, endEffector, [
      targetObject.position.x,
      targetObject.position.y,
      targetObject.position.z,
    ])
  }

  if (!target) return null

  return (
    <>
      <group ref={setTargetObject} position={target}>
        <mesh name="ik-target-marker">
          <sphereGeometry args={[TARGET_RADIUS, 12, 8]} />
          <meshStandardMaterial color={reached ? REACHED_COLOR : UNREACHABLE_COLOR} />
        </mesh>
      </group>
      {targetObject && (
        <TransformControls
          object={targetObject}
          mode="translate"
          onObjectChange={handleObjectChange}
          onMouseDown={() => onDraggingChange?.(true)}
          onMouseUp={() => onDraggingChange?.(false)}
        />
      )}
    </>
  )
}

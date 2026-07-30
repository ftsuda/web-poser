import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { applyJointDrag } from '../figure/dragActions'

export interface JointDragGizmoProps {
  figureId: string
  jointName: string
  /** `Group` ao vivo da junta na cena (registrado por `Figure` via `onJointRef`) — de onde a posição no mundo é lida. */
  jointObject: THREE.Object3D
  onDraggingChange?: (dragging: boolean) => void
}

/**
 * Gizmo de translação de junta: arrastar a junta puxa a cadeia de ancestrais
 * (solver em `dragSolver.ts`) até os limites articulares, com a raiz fixa.
 *
 * O `TransformControls` não pode ser anexado ao `Group` real da junta — o
 * `position` dele é o offset fixo do esqueleto, e arrastá-lo corromperia a
 * hierarquia. Em vez disso, um PROXY efêmero (grupo sem geometria, filho
 * direto da cena) segue a posição da junta no mundo; a cada mudança do
 * arrasto, o solver resolve a cadeia, grava a pose no `figuresStore` (undo
 * normal) e o proxy é reposicionado na posição efetivamente ALCANÇADA — é
 * esse snap-back que faz o gizmo "travar" quando todos os limites saturam,
 * em vez de seguir o mouse para onde o boneco não alcança.
 *
 * Fora do arrasto, o proxy é realinhado à junta a cada quadro (`useFrame`):
 * sliders, presets e undo movem a junta por fora, e o gizmo precisa
 * acompanhar. Como os demais gizmos, a interação de arrastar em si não é
 * testável por automação (ver DECISOES.md) — só a fiação de props tem teste.
 */
export function JointDragGizmo({ figureId, jointName, jointObject, onDraggingChange }: JointDragGizmoProps) {
  const [proxy, setProxy] = useState<THREE.Group | null>(null)
  const draggingRef = useRef(false)

  useFrame(() => {
    if (!proxy || draggingRef.current) return
    jointObject.getWorldPosition(proxy.position)
  })

  const handleObjectChange = () => {
    if (!proxy) return
    const achieved = applyJointDrag(figureId, jointName, [
      proxy.position.x,
      proxy.position.y,
      proxy.position.z,
    ])
    if (achieved) proxy.position.set(...achieved)
  }

  return (
    <>
      <group name="joint-drag-proxy" ref={setProxy} />
      {proxy && (
        <TransformControls
          object={proxy}
          mode="translate"
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

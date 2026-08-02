import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Axis } from '../figure/skeleton'
import type { Figure } from '../store/figuresStore'
import { AXIS_COLORS, GIZMO_SCALE_PER_METER } from './gizmoStyle'
import { jointAxisFrames } from './jointAxisFrames'

/**
 * Anéis gimbal da junta selecionada (item 60): um anel colorido por eixo de
 * DOF, SÓ LEITURA — quem edita são os sliders da aba Junta (mesmas cores) e
 * o arrasto. Os frames vêm de `jointAxisFrames` (fiéis ao Euler XYZ); aqui é
 * só o desenho, com o mesmo tamanho constante em tela do gizmo de setas.
 */

/** Raio do anel (m, antes da reescala por distância) — por dentro das setas do gizmo. */
const RING_RADIUS_M = 0.14
const RING_TUBE_M = 0.006

/** Deita o toro (plano XY, furo em Z) perpendicular ao eixo do anel. */
const RING_ROTATIONS: Record<Axis, [number, number, number]> = {
  x: [0, Math.PI / 2, 0],
  y: [Math.PI / 2, 0, 0],
  z: [0, 0, 0],
}

/** Os anéis não participam do raycast: o alvo de toque da junta fica livre. */
const noRaycast = () => null

interface JointAxisRingsProps {
  figure: Figure
  jointName: string
}

export function JointAxisRings({ figure, jointName }: JointAxisRingsProps) {
  const groupRef = useRef<THREE.Group>(null)
  const result = jointAxisFrames(figure, jointName)

  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group || !result) return
    const distance = camera.position.distanceTo(new THREE.Vector3(...result.origin))
    group.scale.setScalar(Math.min(3, Math.max(0.4, distance * GIZMO_SCALE_PER_METER)))
  })

  if (!result) return null
  return (
    <group ref={groupRef} position={result.origin as [number, number, number]}>
      {result.frames.map((frame) => (
        <group key={frame.axis} quaternion={frame.quaternion}>
          <mesh rotation={RING_ROTATIONS[frame.axis]} renderOrder={9} raycast={noRaycast}>
            <torusGeometry args={[RING_RADIUS_M, RING_TUBE_M, 8, 48]} />
            <meshBasicMaterial
              color={AXIS_COLORS[frame.axis]}
              depthTest={false}
              transparent
              opacity={0.85}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

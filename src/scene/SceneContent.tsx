import { GRID_DIVISIONS, GROUND_NAME, GROUND_SIZE, OVERLAY_NAMES, SHADOW_INTENSITY } from './constants'

export interface SceneContentProps {
  grid: boolean
}

export function SceneContent({ grid }: SceneContentProps) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#444444', 1]} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        // Sombra mais clara no chão (ver `SHADOW_INTENSITY`) — vale para tudo
        // o que projeta, porque a escuridão da sombra é da luz e não de quem a
        // projeta.
        shadow-intensity={SHADOW_INTENSITY}
      />

      <mesh name={GROUND_NAME} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color="#606060" />
      </mesh>

      {grid && (
        <gridHelper name={OVERLAY_NAMES.grid} args={[GROUND_SIZE, GRID_DIVISIONS, '#909090', '#707070']} />
      )}
    </>
  )
}

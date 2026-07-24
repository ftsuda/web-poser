import { GRID_DIVISIONS, GROUND_SIZE } from './constants'

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
      />

      <mesh name="ground" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color="#606060" />
      </mesh>

      {grid && (
        <gridHelper name="scene-grid" args={[GROUND_SIZE, GRID_DIVISIONS, '#909090', '#707070']} />
      )}
    </>
  )
}

import { GRID_DIVISIONS, GROUND_NAME, GROUND_SIZE, OVERLAY_NAMES, SHADOW_INTENSITY } from './constants'
import {
  DEFAULT_LIGHT,
  SHADOW_CAMERA_FAR_M,
  SHADOW_EXTENT_M,
  lightPosition,
  type LightSettings,
} from './sceneLight'

export interface SceneContentProps {
  grid: boolean
  /** Luz da cena (item 16); ausente = o padrão, que é a luz fixa de antes. */
  light?: LightSettings
}

export function SceneContent({ grid, light = DEFAULT_LIGHT }: SceneContentProps) {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#444444', 1]} />
      <directionalLight
        position={lightPosition(light.lightAzimuth, light.lightElevation)}
        intensity={light.lightIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
        // Sombra mais clara no chão (ver `SHADOW_INTENSITY`) — vale para tudo
        // o que projeta, porque a escuridão da sombra é da luz e não de quem a
        // projeta.
        shadow-intensity={SHADOW_INTENSITY}
        // O frustum da câmera de sombra deixou de poder ser o padrão do three
        // (−5…5) quando a luz passou a girar (item 16): rasante, a sombra de um
        // boneco estica metros e sairia cortada ao meio. ±8 m cobre a elevação
        // mínima de 15°, e o `far` acompanha a distância fixa da luz.
        shadow-camera-left={-SHADOW_EXTENT_M}
        shadow-camera-right={SHADOW_EXTENT_M}
        shadow-camera-top={SHADOW_EXTENT_M}
        shadow-camera-bottom={-SHADOW_EXTENT_M}
        shadow-camera-far={SHADOW_CAMERA_FAR_M}
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

import { useEffect, useRef, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore } from '../store/figuresStore'
import { computeOrthographicZoom, computePresetView } from './cameraPresets'
import { CAMERA_DEFAULTS } from './constants'

export interface CameraRigProps {
  controlsRef: RefObject<OrbitControlsImpl | null>
}

/** Distância padrão do alvo quando a câmera ainda não se moveu (ex.: logo após montar). */
const DEFAULT_ORBIT_DISTANCE = CAMERA_DEFAULTS.position[2]

/**
 * Componente sem visual (`return null`) que vive dentro do `<Canvas>` e é o
 * único lugar que efetivamente move a câmera ativa — presets ortográficos,
 * bookmarks e a troca perspectiva/ortográfica (ver PLANO.md > "Ambiente e
 * câmera"). Mantém duas instâncias de câmera (perspectiva e ortográfica)
 * vivas o tempo todo, e alterna qual delas é a "câmera padrão" do R3F via
 * `set({ camera })`, copiando posição/orientação de uma para a outra — evita
 * a corrida de timing de desmontar/remontar um componente de câmera do drei
 * a cada troca de projeção (ver DECISOES.md).
 *
 * Assim como o arraste do gizmo em `SelectionGizmo.tsx`, o efeito real de
 * mover a câmera (imperativo, sobre um `THREE.Object3D` vivo) não é coberto
 * por teste automatizado — validado manualmente no navegador. A lógica
 * matemática dos presets (`cameraPresets.ts`) e as transições do store
 * (`cameraStore.ts`) têm cobertura completa.
 */
export function CameraRig({ controlsRef }: CameraRigProps) {
  const set = useThree((state) => state.set)
  const size = useThree((state) => state.size)

  const perspectiveCameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orthographicCameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const activeProjectionRef = useRef<'perspective' | 'orthographic'>('perspective')

  if (perspectiveCameraRef.current == null) {
    const camera = new THREE.PerspectiveCamera(
      CAMERA_DEFAULTS.fov,
      size.width / size.height,
      CAMERA_DEFAULTS.near,
      CAMERA_DEFAULTS.far,
    )
    camera.position.set(...CAMERA_DEFAULTS.position)
    perspectiveCameraRef.current = camera
  }
  if (orthographicCameraRef.current == null) {
    const camera = new THREE.OrthographicCamera(
      size.width / -2,
      size.width / 2,
      size.height / 2,
      size.height / -2,
      CAMERA_DEFAULTS.near,
      CAMERA_DEFAULTS.far,
    )
    camera.position.set(...CAMERA_DEFAULTS.position)
    orthographicCameraRef.current = camera
  }

  const fov = useCameraStore((state) => state.fov)
  const projection = useCameraStore((state) => state.projection)
  const pendingCommand = useCameraStore((state) => state.pendingCommand)
  const clearPendingCommand = useCameraStore((state) => state.clearPendingCommand)
  const addCameraBookmark = useFiguresStore((state) => state.addCameraBookmark)
  const cameraBookmarks = useFiguresStore((state) => state.cameraBookmarks)

  useEffect(() => {
    set({ camera: perspectiveCameraRef.current! })
  }, [set])

  useEffect(() => {
    const camera = perspectiveCameraRef.current
    if (!camera) return
    camera.fov = fov
    camera.updateProjectionMatrix()
  }, [fov])

  // Troca o objeto de câmera ativo quando a projeção muda, preservando a pose.
  useEffect(() => {
    const perspectiveCamera = perspectiveCameraRef.current
    const orthographicCamera = orthographicCameraRef.current
    if (!perspectiveCamera || !orthographicCamera) return
    if (activeProjectionRef.current === projection) return

    const from = activeProjectionRef.current === 'orthographic' ? orthographicCamera : perspectiveCamera
    const to = projection === 'orthographic' ? orthographicCamera : perspectiveCamera

    to.position.copy(from.position)
    to.up.copy(from.up)
    to.quaternion.copy(from.quaternion)

    if (to instanceof THREE.OrthographicCamera) {
      const distance = controlsRef.current
        ? from.position.distanceTo(controlsRef.current.target)
        : DEFAULT_ORBIT_DISTANCE
      to.zoom = computeOrthographicZoom(distance || DEFAULT_ORBIT_DISTANCE, fov, size.height)
    }
    to.updateProjectionMatrix()

    activeProjectionRef.current = projection
    set({ camera: to })
    controlsRef.current?.update()
  }, [projection, set, fov, size.height, controlsRef])

  // Executa o comando pendente (preset, bookmark, salvar posição atual) contra
  // a câmera atualmente ativa — roda depois do efeito de troca acima, então
  // `projection` já reflete a câmera correta nesta mesma leva de efeitos.
  useEffect(() => {
    if (!pendingCommand) return
    const controls = controlsRef.current
    const camera = projection === 'orthographic' ? orthographicCameraRef.current : perspectiveCameraRef.current
    if (!controls || !camera) return

    switch (pendingCommand.type) {
      case 'requestSaveBookmark': {
        addCameraBookmark({
          name: pendingCommand.name,
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [controls.target.x, controls.target.y, controls.target.z],
          projection,
          fov,
          zoom: camera instanceof THREE.OrthographicCamera ? camera.zoom : 1,
        })
        break
      }

      case 'preset': {
        const target: [number, number, number] = [controls.target.x, controls.target.y, controls.target.z]
        const distance = camera.position.distanceTo(controls.target) || DEFAULT_ORBIT_DISTANCE
        const { position, up } = computePresetView(pendingCommand.preset, target, distance)
        camera.position.set(...position)
        camera.up.set(...up)
        camera.lookAt(controls.target)
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = computeOrthographicZoom(distance, fov, size.height)
          camera.updateProjectionMatrix()
        }
        controls.update()
        break
      }

      case 'applyBookmark': {
        const bookmark = cameraBookmarks.find((b) => b.id === pendingCommand.id)
        if (bookmark) {
          camera.position.set(...bookmark.position)
          camera.up.set(0, 1, 0)
          controls.target.set(...bookmark.target)
          camera.lookAt(controls.target)
          if (camera instanceof THREE.OrthographicCamera) {
            camera.zoom = bookmark.zoom
            camera.updateProjectionMatrix()
          }
          controls.update()
        }
        break
      }

      case 'toPerspective':
        // A troca de pose já foi feita pelo efeito de projeção acima.
        break
    }

    clearPendingCommand()
  }, [
    pendingCommand,
    projection,
    controlsRef,
    fov,
    size.height,
    cameraBookmarks,
    addCameraBookmark,
    clearPendingCommand,
  ])

  return null
}

import { useEffect, useRef, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore } from '../store/figuresStore'
import { interpolateCameraView, type CameraViewState } from './cameraMove'
import { computeFrameDistance, computeOrthographicZoom, computePresetView } from './cameraPresets'
import { focalLengthToFov, fovToFocalLength } from './lens'
import {
  computeGroupShotView,
  computeOverTheShoulderView,
  computePovView,
  computeShotView,
  rollUpVector,
  twoShotDirection,
  twoShotPair,
  type ShotRequest,
  type ShotView,
} from './shotFraming'
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
  const scene = useThree((state) => state.scene)

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
  const rollDeg = useCameraStore((state) => state.rollDeg)

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

    /** Põe a câmera exatamente onde um preset/movimento resolveu (posição, alvo e topo da tela). */
    const applyView = (view: ShotView | CameraViewState) => {
      controls.target.set(...view.target)
      camera.position.set(...view.position)
      camera.up.set(...view.up)
      camera.lookAt(controls.target)
      if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom = computeOrthographicZoom(camera.position.distanceTo(controls.target), fov, size.height)
        camera.updateProjectionMatrix()
      }
      controls.update()
    }

    /** Direção de onde a câmera olha hoje (do alvo para a câmera) — só o azimute é aproveitado. */
    const currentDirection = (): [number, number, number] => {
      const direction = camera.position.clone().sub(controls.target)
      if (direction.lengthSq() < 1e-8) direction.set(...CAMERA_DEFAULTS.position)
      return [direction.x, direction.y, direction.z]
    }

    const cameraState = (): CameraViewState => ({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      up: [camera.up.x, camera.up.y, camera.up.z],
      focalMm: fovToFocalLength(fov),
    })

    switch (pendingCommand.type) {
      case 'requestSaveBookmark': {
        addCameraBookmark({
          name: pendingCommand.name,
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [controls.target.x, controls.target.y, controls.target.z],
          projection,
          fov,
          zoom: camera instanceof THREE.OrthographicCamera ? camera.zoom : 1,
          // O topo da tela vai junto: sem ele um bookmark salvo com ângulo
          // holandês voltaria endireitado (DECISOES.md #46).
          up: [camera.up.x, camera.up.y, camera.up.z],
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
          camera.up.set(...(bookmark.up ?? [0, 1, 0]))
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

      case 'frameFigure': {
        // A caixa é medida no objeto REAL da cena, não estimada pela altura:
        // assim o enquadramento acompanha a pose (Superman deitado ocupa uma
        // caixa bem diferente de um boneco em pé).
        const figureObject = scene.getObjectByName(`figure-${pendingCommand.figureId}`)
        if (!figureObject) break

        const box = new THREE.Box3().setFromObject(figureObject)
        if (box.isEmpty()) break

        const sphere = box.getBoundingSphere(new THREE.Sphere())
        const distance = computeFrameDistance(sphere.radius, fov, size.width / size.height)
        // Mantém a direção de onde a câmera já olha — enquadrar aproxima, não
        // reposiciona o ângulo escolhido pelo usuário.
        const direction = camera.position.clone().sub(controls.target)
        if (direction.lengthSq() < 1e-8) direction.set(...CAMERA_DEFAULTS.position)
        direction.normalize()

        controls.target.copy(sphere.center)
        camera.position.copy(sphere.center).addScaledVector(direction, distance)
        camera.lookAt(controls.target)
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = computeOrthographicZoom(distance, fov, size.height)
          camera.updateProjectionMatrix()
        }
        controls.update()
        break
      }

      // ----------------------------------------------------------------
      // Enquadramento cinematográfico e movimento entre dois pontos (#46)
      // ----------------------------------------------------------------

      case 'applyShot':
      case 'applyTwoShot': {
        const { figures, selectedFigureId, selectedJointName } = useFiguresStore.getState()
        const vista = useCameraStore.getState()
        const shot = vista.shot
        if (!shot) break

        const request: ShotRequest = {
          shot,
          fovDeg: fov,
          fromDirection: currentDirection(),
          angle: vista.angle,
          cameraHeight: vista.cameraHeight,
          orientation: vista.orientation,
          selectedJoint: selectedJointName,
          rollDeg,
          thirds: vista.thirds,
          leadRoom: vista.leadRoom,
          aspect: size.width / size.height,
        }

        // Two shot: o par formado pelo boneco selecionado e o vizinho mais
        // próximo, enquadrado com a mesma máquina do conjunto.
        if (pendingCommand.type === 'applyTwoShot') {
          const par = twoShotPair(figures, selectedFigureId)
          if (!par) break
          // Olhar o par de lado, para um não tapar o outro — a não ser que o
          // usuário tenha pedido um lado explicitamente.
          const view = computeGroupShotView(par, {
            ...request,
            fromDirection: vista.orientation
              ? request.fromDirection
              : twoShotDirection(par, request.fromDirection),
          })
          if (view) applyView(view)
          break
        }

        const figure = figures.find((candidate) => candidate.id === selectedFigureId)
        if (figure) {
          applyView(computeShotView(figure, request))
          break
        }
        // Sem boneco selecionado, os planos abertos enquadram TODOS os bonecos,
        // mirando no ponto médio do conjunto (DECISOES.md #48). O `aspect` da
        // tela entra aqui porque é ele que diz quanta largura cabe.
        const grupo = computeGroupShotView(figures, request)
        if (grupo) applyView(grupo)
        break
      }

      case 'applyPov': {
        const { figures, selectedFigureId } = useFiguresStore.getState()
        const figure = figures.find((candidate) => candidate.id === selectedFigureId)
        if (!figure) break
        applyView(computePovView(figure, rollDeg))
        break
      }

      case 'applyReverseAngle': {
        // Meia-volta em torno do alvo, mantendo altura e distância: é o
        // contracampo. Feito na câmera viva, então compõe com qualquer vista.
        const offset = camera.position.clone().sub(controls.target)
        camera.position.set(
          controls.target.x - offset.x,
          camera.position.y,
          controls.target.z - offset.z,
        )
        camera.lookAt(controls.target)
        controls.update()
        break
      }

      case 'applyOverTheShoulder': {
        // Quem está em primeiro plano é o boneco selecionado; o outro é o
        // sujeito da conversa. Com um boneco só, não há vista a montar.
        const { figures, selectedFigureId } = useFiguresStore.getState()
        const near = figures.find((candidate) => candidate.id === selectedFigureId)
        const far = figures.find((candidate) => candidate.id !== near?.id)
        if (!near || !far) break
        const view = computeOverTheShoulderView(near, far, rollDeg)
        if (view) applyView(view)
        break
      }

      case 'applyRoll': {
        // Só o topo da tela muda: a câmera não sai do lugar.
        const direction = controls.target.clone().sub(camera.position)
        if (direction.lengthSq() < 1e-8) break
        camera.up.set(...rollUpVector([direction.x, direction.y, direction.z], rollDeg))
        camera.lookAt(controls.target)
        controls.update()
        break
      }

      case 'captureMovePoint':
        useCameraStore.getState().setMovePoint(pendingCommand.point, cameraState())
        break

      case 'applyMove': {
        const { moveA, moveB, moveT } = useCameraStore.getState()
        if (!moveA || !moveB) break
        const view = interpolateCameraView(moveA, moveB, moveT)
        applyView(view)
        // A lente faz parte do movimento: as duas pontas podem ter lentes
        // diferentes (é assim que se monta um dolly zoom).
        useCameraStore.getState().setFov(focalLengthToFov(view.focalMm))
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
    rollDeg,
    scene,
    size.width,
  ])

  return null
}

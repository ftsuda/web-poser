import { useEffect, useRef, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore } from '../store/figuresStore'
import { interpolateCameraView, type CameraViewState } from './cameraMove'
import { computeFrameDistance, computeOrthographicZoom, computePresetView } from './cameraPresets'
import { focalLengthToFov, fovToFocalLength } from './lens'
import { readOutputAspect } from './outputAspect'
import { applyViewToCamera, getSceneCameraObject } from './sceneCameraObject'
import { getViewportOrthographicCamera, getViewportPerspectiveCamera } from './viewportCameras'
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
 * único lugar que troca a câmera ATIVA do R3F e move as câmeras do VIEWPORT
 * (presets ortográficos, enquadrar com F, perspectiva/ortográfica) — ver
 * PLANO.md > "Ambiente e câmera". Mantém duas instâncias de câmera de
 * navegação vivas o tempo todo e alterna qual delas é a "câmera padrão" via
 * `set({ camera })` (ver DECISOES.md); no modo visão-câmera (fase 11), a
 * ativa passa a ser a CÂMERA DE CENA (`sceneCameraObject.ts`).
 *
 * Desde a fase 11 os comandos CINEMATOGRÁFICOS (planos, POV, movimento A→B,
 * bookmarks perspectivos…) não movem mais a câmera do viewport: eles calculam
 * um `CameraViewState` novo — a partir do estado atual da câmera de cena — e
 * gravam em `figuresStore.sceneCamera`. O viewport de trabalho fica livre.
 *
 * Como antes, o efeito imperativo sobre `THREE.Object3D` vivo não é coberto
 * por teste automatizado — validado no navegador. A matemática dos presets
 * (`cameraPresets.ts`), do enquadramento (`shotFraming.ts`) e as transições
 * do store (`cameraStore.ts`) têm cobertura completa.
 */
export function CameraRig({ controlsRef }: CameraRigProps) {
  const set = useThree((state) => state.set)
  const size = useThree((state) => state.size)
  const scene = useThree((state) => state.scene)

  const perspectiveCameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orthographicCameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const activeProjectionRef = useRef<'perspective' | 'orthographic'>('perspective')

  // As instâncias são singletons de módulo (`viewportCameras.ts`) porque o
  // `<OrbitControls>` do Viewport precisa apontar para elas EXPLICITAMENTE —
  // ver o comentário de lá. Aqui só se completa o que depende da janela.
  if (perspectiveCameraRef.current == null) {
    const camera = getViewportPerspectiveCamera()
    camera.aspect = size.width / size.height
    camera.updateProjectionMatrix()
    perspectiveCameraRef.current = camera
  }
  if (orthographicCameraRef.current == null) {
    const camera = getViewportOrthographicCamera()
    camera.left = size.width / -2
    camera.right = size.width / 2
    camera.top = size.height / 2
    camera.bottom = size.height / -2
    camera.updateProjectionMatrix()
    orthographicCameraRef.current = camera
  }

  const fov = useCameraStore((state) => state.fov)
  const projection = useCameraStore((state) => state.projection)
  const viewMode = useCameraStore((state) => state.viewMode)
  const pendingCommand = useCameraStore((state) => state.pendingCommand)
  const clearPendingCommand = useCameraStore((state) => state.clearPendingCommand)
  const addCameraBookmark = useFiguresStore((state) => state.addCameraBookmark)
  const cameraBookmarks = useFiguresStore((state) => state.cameraBookmarks)
  const sceneCamera = useFiguresStore((state) => state.sceneCamera)
  const setSceneCamera = useFiguresStore((state) => state.setSceneCamera)
  const rollDeg = useCameraStore((state) => state.rollDeg)

  // ------------------------------------------------------------------
  // Câmera ativa: viewport (edição) ou câmera de cena (visão-câmera)
  // ------------------------------------------------------------------

  useEffect(() => {
    if (viewMode === 'camera') {
      set({ camera: getSceneCameraObject() })
      return
    }
    const viewportCamera =
      activeProjectionRef.current === 'orthographic'
        ? orthographicCameraRef.current
        : perspectiveCameraRef.current
    if (viewportCamera) set({ camera: viewportCamera })
  }, [set, viewMode])

  // ------------------------------------------------------------------
  // Sincronia estado → objeto vivo da câmera de cena
  // ------------------------------------------------------------------

  // A fonte da verdade em repouso é o store; o objeto é o espelho vivo que o
  // gizmo segue e que o modo visão-câmera renderiza.
  useEffect(() => {
    applyViewToCamera(getSceneCameraObject(), sceneCamera)
  }, [sceneCamera])

  // A lente do painel vale para a câmera de cena: trocar os milímetros muda o
  // `fov` daqui e precisa refletir no estado persistido — sem reenquadrar
  // (quem reenquadra com plano ativo é o comando `applyShot`, disparado pelo
  // próprio `setFocalLength`).
  useEffect(() => {
    const camera = perspectiveCameraRef.current
    if (camera) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    const current = useFiguresStore.getState().sceneCamera
    const focalMm = fovToFocalLength(fov)
    if (Math.abs(current.focalMm - focalMm) > 1e-6) {
      useFiguresStore.getState().setSceneCamera({ ...current, focalMm })
    }
  }, [fov])

  // Troca o objeto de câmera do VIEWPORT quando a projeção muda, preservando a pose.
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
    // No modo visão-câmera a ativa continua sendo a câmera de cena — a troca
    // de projeção do viewport fica pronta para quando a edição voltar.
    if (useCameraStore.getState().viewMode === 'edit') set({ camera: to })
    controlsRef.current?.update()
  }, [projection, set, fov, size.height, controlsRef])

  // Executa o comando pendente. Comandos de NAVEGAÇÃO (preset, F, bookmark
  // ortográfico) agem na câmera do viewport; os CINEMATOGRÁFICOS calculam e
  // gravam o novo estado da câmera de cena.
  useEffect(() => {
    if (!pendingCommand) return
    const controls = controlsRef.current
    const camera = projection === 'orthographic' ? orthographicCameraRef.current : perspectiveCameraRef.current
    if (!controls || !camera) return

    /** Estado atual da câmera de cena — o ponto de partida dos comandos cinematográficos. */
    const vistaDeCena = (): CameraViewState => useFiguresStore.getState().sceneCamera

    /** Grava o resultado de um comando na câmera de cena, completando a lente do painel. */
    const commitSceneView = (view: ShotView | CameraViewState) => {
      setSceneCamera({
        position: [...view.position] as [number, number, number],
        target: [...view.target] as [number, number, number],
        up: [...view.up] as [number, number, number],
        focalMm: 'focalMm' in view ? view.focalMm : fovToFocalLength(fov),
      })
    }

    /** Direção de onde a câmera de cena olha hoje (do alvo para a câmera) — só o azimute é aproveitado. */
    const sceneDirection = (): [number, number, number] => {
      const state = vistaDeCena()
      const direction = new THREE.Vector3(...state.position).sub(new THREE.Vector3(...state.target))
      if (direction.lengthSq() < 1e-8) direction.set(...CAMERA_DEFAULTS.position)
      return [direction.x, direction.y, direction.z]
    }

    switch (pendingCommand.type) {
      case 'requestSaveBookmark': {
        // O bookmark guarda a CÂMERA DE CENA (fase 11) — é ela que o painel
        // comanda; a navegação do viewport não é conteúdo para salvar.
        const state = vistaDeCena()
        addCameraBookmark({
          name: pendingCommand.name,
          position: [...state.position],
          target: [...state.target],
          projection: 'perspective',
          fov: focalLengthToFov(state.focalMm),
          zoom: 1,
          up: [...state.up],
        })
        break
      }

      case 'placeCameraAtView': {
        // A ponte entre a bancada e a câmera: "fotografa" a vista de trabalho
        // atual e leva a câmera de cena para lá, com a lente do painel.
        commitSceneView({
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [controls.target.x, controls.target.y, controls.target.z],
          up: [camera.up.x, camera.up.y, camera.up.z],
          focalMm: fovToFocalLength(fov),
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
        if (!bookmark) break
        // Bookmark perspectivo vale para a câmera de cena; ortográfico é vista
        // de trabalho e move o viewport (fase 11).
        if (bookmark.projection === 'perspective') {
          commitSceneView({
            position: [...bookmark.position] as [number, number, number],
            target: [...bookmark.target] as [number, number, number],
            up: [...(bookmark.up ?? [0, 1, 0])] as [number, number, number],
            focalMm: fovToFocalLength(bookmark.fov),
          })
          break
        }
        camera.position.set(...bookmark.position)
        camera.up.set(...(bookmark.up ?? [0, 1, 0]))
        controls.target.set(...bookmark.target)
        camera.lookAt(controls.target)
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = bookmark.zoom
          camera.updateProjectionMatrix()
        }
        controls.update()
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
        // Mantém a direção de onde a vista já olha — enquadrar aproxima, não
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
      // Comandos cinematográficos — calculam e gravam a câmera de cena
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
          fromDirection: sceneDirection(),
          angle: vista.angle,
          cameraHeight: vista.cameraHeight,
          orientation: vista.orientation,
          selectedJoint: selectedJointName,
          rollDeg,
          thirds: vista.thirds,
          leadRoom: vista.leadRoom,
          // A proporção é a da SAÍDA (o arquivo), não a da janela: é para o
          // arquivo que a câmera de cena enquadra (fase 11).
          aspect: readOutputAspect(),
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
          if (view) commitSceneView(view)
          break
        }

        const figure = figures.find((candidate) => candidate.id === selectedFigureId)
        if (figure) {
          commitSceneView(computeShotView(figure, request))
          break
        }
        // Sem boneco selecionado, os planos abertos enquadram TODOS os bonecos,
        // mirando no ponto médio do conjunto (DECISOES.md #48).
        const grupo = computeGroupShotView(figures, request)
        if (grupo) commitSceneView(grupo)
        break
      }

      case 'applyPov': {
        const { figures, selectedFigureId } = useFiguresStore.getState()
        const figure = figures.find((candidate) => candidate.id === selectedFigureId)
        if (!figure) break
        commitSceneView(computePovView(figure, rollDeg))
        break
      }

      case 'applyReverseAngle': {
        // Meia-volta em torno do alvo, mantendo altura e distância: é o
        // contracampo — agora sobre o estado da câmera de cena.
        const state = vistaDeCena()
        commitSceneView({
          ...state,
          position: [
            state.target[0] - (state.position[0] - state.target[0]),
            state.position[1],
            state.target[2] - (state.position[2] - state.target[2]),
          ],
        })
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
        if (view) commitSceneView(view)
        break
      }

      case 'applyRoll': {
        // Só o topo da tela muda: a câmera não sai do lugar.
        const state = vistaDeCena()
        const direction: [number, number, number] = [
          state.target[0] - state.position[0],
          state.target[1] - state.position[1],
          state.target[2] - state.position[2],
        ]
        const lengthSq = direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2
        if (lengthSq < 1e-8) break
        commitSceneView({ ...state, up: rollUpVector(direction, rollDeg) })
        break
      }

      case 'captureMovePoint':
        useCameraStore.getState().setMovePoint(pendingCommand.point, vistaDeCena())
        break

      case 'applyMove': {
        const { moveA, moveB, moveT } = useCameraStore.getState()
        if (!moveA || !moveB) break
        const view = interpolateCameraView(moveA, moveB, moveT)
        commitSceneView(view)
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
    setSceneCamera,
    clearPendingCommand,
    rollDeg,
    scene,
    size.width,
  ])

  return null
}

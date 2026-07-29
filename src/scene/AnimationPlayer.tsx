import { useCallback, useEffect, type RefObject } from 'react'
import { flushSync as flushSceneSync, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  advancePlayheadMs,
  animationDurationMs,
  animationOutputDurationMs,
  clampAnimationSpeed,
  findWorkingAnimation,
  formatAnimationFilename,
} from '../animation/animation'
import { sampleAnimation, sampleAnimationOutput } from '../animation/animationSampler'
import { frameTimeline } from '../animation/frameTimeline'
import {
  createMp4Sink,
  exportFrames,
  pickVideoCodec,
  toEvenDimension,
} from '../animation/videoExport'
import { writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { useAnimationStore } from '../store/animationStore'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore } from '../store/figuresStore'
import { useKeyframeThumbnailStore } from '../store/keyframeThumbnailStore'
import { useSnapshotCaptureStore } from '../store/snapshotCaptureStore'
import type { CameraViewState } from './cameraMove'
import { focalLengthToFov, fovToFocalLength } from './lens'
import { hideSceneOverlays, renderAtResolution } from './sceneCapture'

/** Tamanho da miniatura de keyframe (item 30) — 16:9, pequena o bastante para caber no card. */
const THUMBNAIL_WIDTH = 160
const THUMBNAIL_HEIGHT = 90

export interface AnimationPlayerProps {
  controlsRef: RefObject<OrbitControlsImpl | null>
}

/**
 * O animador propriamente dito, dentro do `<Canvas>` (PLANO.md > "Mini
 * animador"). Sem visual próprio: executa os comandos do `animationStore`,
 * toca a animação na tela e roda a exportação de vídeo.
 *
 * Vive aqui, e não num painel, porque tudo o que ele faz depende de coisas que
 * só existem dentro do canvas — a câmera viva, o `OrbitControls` e o
 * renderizador. Mesma razão de `CameraRig.tsx` e `SnapshotCapture.tsx`, e
 * mesma consequência: não tem teste automatizado (WebGL e WebCodecs não
 * existem em jsdom). O que dá para testar sem GPU está em `animationSampler`,
 * `frameTimeline`, `videoExport` e `sceneCapture` — e está.
 *
 * **A cena de trabalho nunca é tocada.** A reprodução publica um estado de
 * PRÉ-VISUALIZAÇÃO (`animationStore.preview`) que o `Viewport` renderiza no
 * lugar dos bonecos do store; parar devolve a cena intacta, sem passar pelo
 * histórico de undo.
 */
export function AnimationPlayer({ controlsRef }: AnimationPlayerProps) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const activeCamera = useThree((state) => state.camera)
  const getThree = useThree((state) => state.get)

  const pendingCommand = useAnimationStore((state) => state.pendingCommand)
  const playing = useAnimationStore((state) => state.playing)

  /** Estado da câmera viva, no formato que o keyframe guarda. */
  const readCameraView = useCallback((): CameraViewState | null => {
    const controls = controlsRef.current
    const camera = getThree().camera
    if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return null
    return {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      up: [camera.up.x, camera.up.y, camera.up.z],
      focalMm: fovToFocalLength(camera.fov),
    }
  }, [controlsRef, getThree])

  /** Põe a câmera exatamente onde a amostra manda — posição, alvo, topo da tela e lente. */
  const applyCameraView = useCallback(
    (view: CameraViewState) => {
      const controls = controlsRef.current
      const camera = getThree().camera
      if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return
      controls.target.set(...view.target)
      camera.position.set(...view.position)
      camera.up.set(...view.up)
      camera.lookAt(controls.target)
      // A lente entra direto no objeto vivo: passar pelo `cameraStore` a cada
      // quadro empilharia um re-render de React por quadro só para mudar um
      // número que já está aplicado aqui. O painel é sincronizado ao parar.
      camera.fov = focalLengthToFov(view.focalMm)
      camera.updateProjectionMatrix()
      controls.update()
    },
    [controlsRef, getThree],
  )

  // ------------------------------------------------------------------
  // Comandos (capturar, regravar, ir para, exportar)
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!pendingCommand) return

    const animationState = useAnimationStore.getState()
    const figuresState = useFiguresStore.getState()
    // A animação editada é sempre a DE TRABALHO (item 36) — as outras são a
    // biblioteca, e abrir uma delas a traz para cá.
    const animation = findWorkingAnimation(figuresState.animations)

    const clear = () => useAnimationStore.getState().clearPendingCommand()

    // Capturar e acrescentar um trecho são justamente o que CRIA a animação de
    // trabalho: esses dois não podem esbarrar na ausência dela.
    const criaAnimacao =
      pendingCommand.type === 'captureKeyframe' ||
      pendingCommand.type === 'appendClip' ||
      pendingCommand.type === 'appendSavedClip'
    if (!animation && !criaAnimacao) {
      clear()
      return
    }

    switch (pendingCommand.type) {
      case 'captureKeyframe': {
        const view = readCameraView()
        if (view) figuresState.addAnimationKeyframe(animation?.id ?? null, view)
        break
      }

      case 'appendClip': {
        // A câmera viva vai congelada em TODOS os keyframes do trecho — o
        // enquadramento durante o trecho é decisão de quem monta (decidido
        // com o usuário, DECISOES.md #60).
        const view = readCameraView()
        if (view) {
          figuresState.appendAnimationClip(
            animation?.id ?? null,
            pendingCommand.clipKey,
            view,
            pendingCommand.figureAIds,
            pendingCommand.figureBId,
            pendingCommand.label,
          )
        }
        break
      }

      case 'appendSavedClip': {
        // Mesma regra do trecho de fábrica: a câmera viva vai congelada em
        // todos os keyframes (item 39).
        const view = readCameraView()
        if (view) {
          figuresState.appendSavedClip(
            animation?.id ?? null,
            pendingCommand.clipId,
            view,
            pendingCommand.casts,
            pendingCommand.label,
          )
        }
        break
      }

      case 'updateKeyframe': {
        const view = readCameraView()
        if (view && animation) figuresState.updateAnimationKeyframe(animation.id, pendingCommand.keyframeId, view)
        break
      }

      case 'goToKeyframe': {
        if (!animation) break
        const keyframe = animation.keyframes.find((candidate) => candidate.id === pendingCommand.keyframeId)
        if (!keyframe) break
        applyCameraView(keyframe.camera)
        useCameraStore.getState().setFocalLengthQuietly(keyframe.camera.focalMm)
        // Ir para um keyframe é para PODER AJUSTÁ-LO: a cena de trabalho passa
        // a ser aquele retrato de verdade, e a pré-visualização sai da frente.
        useAnimationStore.getState().setPreview(null)
        figuresState.loadFiguresFromKeyframe(keyframe.figures)
        break
      }

      case 'seek': {
        if (!animation) break
        // Navegar mostra o instante SEM tocar na cena de trabalho — quem quer
        // ajustar um keyframe usa "Ir para", que é outra coisa.
        const sample = sampleAnimation(animation, animationState.timeMs)
        if (!sample) break
        useAnimationStore.getState().setPreview(sample)
        applyCameraView(sample.camera)
        break
      }

      case 'renderThumbnails': {
        if (!animation) break
        // Um retrato pequeno por keyframe (item 30). Renderizado aqui porque
        // depende do canvas vivo, como o instantâneo e o vídeo — e guardado
        // num cache de FERRAMENTA, fora do undo e do arquivo.
        const camera = getThree().camera
        const anterior = readCameraView()
        for (const keyframe of animation.keyframes) {
          flushSceneSync(() =>
            useAnimationStore.getState().setPreview({ figures: keyframe.figures, camera: keyframe.camera }),
          )
          applyCameraView(keyframe.camera)
          // Esconder a cada quadro, como na exportação: o commit do React acima
          // pode reacender um apoio de tela.
          const restoreScene = hideSceneOverlays(scene)
          renderAtResolution(gl, scene, camera, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, () => {
            useKeyframeThumbnailStore
              .getState()
              .setThumbnail(keyframe.id, gl.domElement.toDataURL('image/jpeg', 0.6))
          })
          restoreScene()
        }
        // A bancada volta a ser o que era: nem a cena nem o enquadramento
        // mudam por ter gerado miniaturas.
        useAnimationStore.getState().setPreview(null)
        if (anterior) applyCameraView(anterior)
        gl.render(scene, camera)
        break
      }

      case 'exportVideo': {
        if (!animation) break
        void runExport()
        break
      }
    }

    clear()

    async function runExport() {
      const store = useAnimationStore.getState()
      const width = toEvenDimension(store.width)
      const height = toEvenDimension(store.height)
      // O vídeo tem o comprimento DA SAÍDA: a linha do tempo dividida pela
      // velocidade. A 0,5 são o dobro dos quadros, e cada um mostra metade do
      // caminho andado — é o que faz a câmera lenta ser lenta de verdade, e
      // não a mesma coisa com quadros repetidos.
      const frames = frameTimeline(animationOutputDurationMs(animation!), store.fps)

      const camera = getThree().camera

      try {
        const codec = await pickVideoCodec(width, height)
        if (!codec) {
          useAnimationStore.getState().failExport('panels.animation.errorNoCodec')
          return
        }

        const sink = await createMp4Sink({ canvas: gl.domElement, codec, fps: store.fps })
        useAnimationStore.getState().startExport(frames.length)

        const blob = await exportFrames({
          frames,
          sink,
          isCancelled: () => useAnimationStore.getState().cancelRequested,
          onProgress: (rendered) => useAnimationStore.getState().reportExportProgress(rendered),
          encodeFrame: (frame) => {
            const sample = sampleAnimationOutput(animation!, frame.timeMs)
            if (!sample) return Promise.resolve()

            // O `flushSync` é o do `@react-three/fiber`, NÃO o do `react-dom`
            // — e essa distinção é o conserto de um vídeo que saía errado
            // (DECISOES.md #55). A cena vive no reconciliador do R3F, que tem
            // fila própria; o `flushSync` do `react-dom` não a esvazia, e o
            // `render` abaixo desenhava o quadro anterior.
            //
            // Isto só funciona porque os bonecos assinam a loja DE DENTRO do
            // `<Canvas>` (`SceneFigures.tsx`): pela prop `children` o R3F
            // entrega a cena por um `root.render()` assíncrono, que nenhum
            // `flushSync` alcança.
            flushSceneSync(() => useAnimationStore.getState().setPreview(sample))
            applyCameraView(sample.camera)

            // Esconder A CADA QUADRO, e não uma vez antes do laço: o commit do
            // React acima e o `update` do `TransformControls` podem reacender
            // um apoio de tela no meio da exportação. Um passe pela árvore por
            // quadro não pesa nada perto de renderizar a cena.
            const restoreScene = hideSceneOverlays(scene)
            let backpressure: Promise<void> = Promise.resolve()
            renderAtResolution(gl, scene, camera, width, height, () => {
              backpressure = sink.addFrame(frame.timeS, frame.durationS)
            })
            restoreScene()
            return backpressure
          },
        })

        // Cancelado: a cena tem de voltar a ser a de trabalho, senão fica
        // parada no último quadro renderizado.
        if (!blob) {
          useAnimationStore.getState().setPreview(null)
          return
        }

        const filename = formatAnimationFilename(animation!.name)
        await writeFileToDirectoryOrDownload(
          useSnapshotCaptureStore.getState().directoryHandle,
          filename,
          blob,
        )
        useAnimationStore.getState().finishExport(filename)
      } catch {
        // Falha de codificador/gravação não pode deixar a cena escondida nem o
        // painel travado em "exportando".
        useAnimationStore.getState().failExport('panels.animation.errorExport')
      } finally {
        gl.render(scene, camera)
      }
    }
  }, [pendingCommand, gl, scene, activeCamera, getThree, readCameraView, applyCameraView])

  // ------------------------------------------------------------------
  // Reprodução na tela
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!playing) return

    const animation = findWorkingAnimation(useFiguresStore.getState().animations)
    const total = animation ? animationDurationMs(animation) : 0

    if (!animation || total <= 0) {
      useAnimationStore.getState().pause()
      return
    }

    // Tocar com a linha do tempo já no fim recomeça do zero — é o que se
    // espera de apertar "tocar" de novo, e é também a saída para o caso de a
    // animação ter encurtado desde a última reprodução.
    if (useAnimationStore.getState().timeMs >= total) useAnimationStore.getState().setTimeMs(0)

    let frameId = 0
    let previous = performance.now()

    const tick = (now: number) => {
      const store = useAnimationStore.getState()
      // A velocidade é lida A CADA QUADRO, e não uma vez ao começar: quem mexe
      // no campo com a animação tocando vê o efeito na hora, sem ter de parar
      // e tocar de novo. É uma busca numa lista de poucas animações.
      const speed = clampAnimationSpeed(findWorkingAnimation(useFiguresStore.getState().animations)?.speed)
      // A linha do tempo continua sendo a da ANIMAÇÃO — o que a velocidade muda
      // é o passo com que se anda por ela. Por isso o slider, os instantes dos
      // keyframes e o "inserir aqui" não precisam saber que ela existe.
      //
      // Com o laço ligado (item 27), chegar ao fim recomeça em vez de parar —
      // só na tela: o vídeo exportado continua com uma passada só.
      const { timeMs, ended } = advancePlayheadMs(store.timeMs, (now - previous) * speed, total, store.repeat)
      previous = now

      const sample = sampleAnimation(animation, timeMs)
      if (sample) applyCameraView(sample.camera)
      // Chegar ao fim LARGA a pré-visualização: enquanto ela está na tela, o
      // que se vê é o retrato da animação, e editar a cena não aparece em lugar
      // nenhum. Antes disso era preciso apertar "Parar" para voltar a
      // trabalhar. A câmera fica onde a animação terminou — o enquadramento
      // final é justamente o que se quer conferir.
      store.setPreview(ended ? null : (sample ?? null))
      store.setTimeMs(timeMs)

      if (ended) {
        store.pause()
        return
      }
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [playing, applyCameraView])

  // Parar de tocar devolve a lente ao painel: durante a reprodução ela é
  // escrita direto na câmera, para não custar um re-render por quadro.
  useEffect(() => {
    if (playing) return
    const camera = getThree().camera
    if (camera instanceof THREE.PerspectiveCamera) {
      useCameraStore.getState().setFocalLengthQuietly(fovToFocalLength(camera.fov))
    }
  }, [playing, getThree])

  return null
}

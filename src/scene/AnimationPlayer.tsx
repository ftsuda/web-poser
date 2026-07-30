import { useCallback, useEffect } from 'react'
import { flushSync as flushSceneSync, useThree } from '@react-three/fiber'
import * as THREE from 'three'
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
import { CAMERA_DEFAULTS } from './constants'
import { hideSceneOverlays, renderAtResolution } from './sceneCapture'
import { applyViewToCamera, getSceneCameraObject } from './sceneCameraObject'

/** Tamanho da miniatura de keyframe (item 30) — 16:9, pequena o bastante para caber no card. */
const THUMBNAIL_WIDTH = 160
const THUMBNAIL_HEIGHT = 90


/**
 * O animador propriamente dito, dentro do `<Canvas>` (PLANO.md > "Mini
 * animador"). Sem visual próprio: executa os comandos do `animationStore`,
 * toca a animação na tela e roda a exportação de vídeo.
 *
 * Vive aqui, e não num painel, porque tudo o que ele faz depende de coisas que
 * só existem dentro do canvas — o objeto vivo da câmera de cena e o
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
export function AnimationPlayer() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const activeCamera = useThree((state) => state.camera)
  const getThree = useThree((state) => state.get)

  const pendingCommand = useAnimationStore((state) => state.pendingCommand)
  const playing = useAnimationStore((state) => state.playing)

  /**
   * A câmera dos keyframes é a CÂMERA DE CENA (fase 11) — sempre disponível no
   * store, em qualquer projeção do viewport: capturar não depende mais de onde
   * a bancada está olhando.
   */
  const readCameraView = useCallback(
    (): CameraViewState => useFiguresStore.getState().sceneCamera,
    [],
  )

  /**
   * Põe a câmera de cena exatamente onde a amostra manda — no OBJETO vivo,
   * não no store: um `set` de store por quadro empilharia um re-render de
   * React por quadro. O gizmo segue o objeto (`useFrame`), e o modo
   * visão-câmera renderiza por ele; o store é sincronizado ao parar.
   */
  const applyCameraView = useCallback((view: CameraViewState) => {
    applyViewToCamera(getSceneCameraObject(), view)
  }, [])

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
        figuresState.addAnimationKeyframe(animation?.id ?? null, readCameraView())
        break
      }

      case 'appendClip': {
        // A câmera de cena vai congelada em TODOS os keyframes do trecho — o
        // enquadramento durante o trecho é decisão de quem monta (decidido
        // com o usuário, DECISOES.md #60).
        figuresState.appendAnimationClip(
          animation?.id ?? null,
          pendingCommand.clipKey,
          readCameraView(),
          pendingCommand.figureAIds,
          pendingCommand.figureBId,
          pendingCommand.label,
        )
        break
      }

      case 'appendSavedClip': {
        // Mesma regra do trecho de fábrica: a câmera de cena vai congelada em
        // todos os keyframes (item 39).
        figuresState.appendSavedClip(
          animation?.id ?? null,
          pendingCommand.clipId,
          readCameraView(),
          pendingCommand.casts,
          pendingCommand.label,
        )
        break
      }

      case 'updateKeyframe': {
        if (animation) figuresState.updateAnimationKeyframe(animation.id, pendingCommand.keyframeId, readCameraView())
        break
      }

      case 'goToKeyframe': {
        if (!animation) break
        const keyframe = animation.keyframes.find((candidate) => candidate.id === pendingCommand.keyframeId)
        if (!keyframe) break
        // A câmera do keyframe vira a câmera de cena DE VERDADE (store, não só
        // o objeto vivo): ir para um keyframe é para poder ajustá-lo, e o
        // ajuste parte do que está gravado.
        figuresState.setSceneCamera(keyframe.camera)
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
        // ajustar um keyframe usa "Ir para", que é outra coisa. A câmera de
        // cena, porém, ANDA de verdade: capturar logo após navegar deve gravar
        // o enquadramento daquele instante (o gizmo mostra onde ela está).
        const sample = sampleAnimation(animation, animationState.timeMs)
        if (!sample) break
        useAnimationStore.getState().setPreview(sample)
        figuresState.setSceneCamera(sample.camera)
        useCameraStore.getState().setFocalLengthQuietly(sample.camera.focalMm)
        break
      }

      case 'renderThumbnails': {
        if (!animation) break
        // Um retrato pequeno por keyframe (item 30). Renderizado aqui porque
        // depende do canvas vivo, como o instantâneo e o vídeo — e guardado
        // num cache de FERRAMENTA, fora do undo e do arquivo. A câmera é uma
        // DESCARTÁVEL montada de cada keyframe (fase 11): nem a vista de
        // trabalho nem a câmera de cena se mexem por causa de miniaturas.
        const thumbnailCamera = new THREE.PerspectiveCamera(
          CAMERA_DEFAULTS.fov,
          THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT,
          CAMERA_DEFAULTS.near,
          CAMERA_DEFAULTS.far,
        )
        for (const keyframe of animation.keyframes) {
          flushSceneSync(() =>
            useAnimationStore.getState().setPreview({ figures: keyframe.figures, camera: keyframe.camera }),
          )
          applyViewToCamera(thumbnailCamera, keyframe.camera)
          // Esconder a cada quadro, como na exportação: o commit do React acima
          // pode reacender um apoio de tela.
          const restoreScene = hideSceneOverlays(scene)
          renderAtResolution(gl, scene, thumbnailCamera, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, () => {
            useKeyframeThumbnailStore
              .getState()
              .setThumbnail(keyframe.id, gl.domElement.toDataURL('image/jpeg', 0.6))
          })
          restoreScene()
        }
        // A bancada volta a ser o que era: nem a cena nem o enquadramento
        // mudam por ter gerado miniaturas.
        useAnimationStore.getState().setPreview(null)
        gl.render(scene, getThree().camera)
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

      // A câmera do vídeo é uma DESCARTÁVEL montada quadro a quadro do
      // keyframe (fase 11): o viewport não é mais sequestrado pela exportação.
      const camera = new THREE.PerspectiveCamera(
        CAMERA_DEFAULTS.fov,
        width / height,
        CAMERA_DEFAULTS.near,
        CAMERA_DEFAULTS.far,
      )

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
            applyViewToCamera(camera, sample.camera)

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
        // A tela volta a ser desenhada pela câmera ATIVA (a da bancada ou a de
        // cena, conforme o modo) — a descartável era só do arquivo.
        gl.render(scene, getThree().camera)
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
    /** Último enquadramento aplicado ao objeto vivo — devolvido ao store ao parar. */
    let lastView: CameraViewState | null = null

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
      if (sample) {
        applyCameraView(sample.camera)
        lastView = sample.camera
      }
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
    return () => {
      cancelAnimationFrame(frameId)
      // Parar (no fim ou no botão) devolve ao STORE o enquadramento em que a
      // câmera de cena ficou: durante a reprodução ela andou só no objeto
      // vivo, para não custar um `set` de store por quadro. A lente volta ao
      // painel pelo mesmo commit.
      if (lastView) {
        useFiguresStore.getState().setSceneCamera(lastView)
        useCameraStore.getState().setFocalLengthQuietly(lastView.focalMm)
      }
    }
  }, [playing, applyCameraView])

  return null
}

import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeVideo,
  type VideoCodec,
} from 'mediabunny'
import type { AnimationFrame } from './frameTimeline'

/**
 * Exportação de vídeo (PLANO.md > "Mini animador" > "Exportação MP4").
 *
 * O arquivo está partido em dois de propósito:
 *
 * - **O laço** (`exportFrames`) não sabe o que é MP4 nem WebCodecs: recebe os
 *   quadros, uma função que desenha cada um e um destino que aceita quadros.
 *   É onde moram a ordem, o progresso e o cancelamento — e por isso é testável
 *   sem GPU e sem codificador.
 * - **A ponte com a `mediabunny`** (`createMp4Sink`) é a única parte que
 *   depende do navegador, e é validada no navegador de verdade.
 *
 * A exportação é **quadro a quadro**, não uma gravação de tela: gravar em
 * tempo real (`canvas.captureStream()` + `MediaRecorder`) faria a taxa real de
 * quadros depender da velocidade da máquina, e o mesmo projeto sairia
 * diferente a cada exportação. Aqui o relógio é nosso — uma máquina lenta só
 * demora mais.
 */

/** Destino de quadros: o que a `mediabunny` faz por trás, visto pelo laço. */
export interface VideoSink {
  /** Consome o quadro que ACABOU de ser desenhado no canvas. A promessa é a contrapressão do codificador. */
  addFrame: (timeS: number, durationS: number) => Promise<void>
  /** Fecha o arquivo e devolve o MP4 pronto. */
  finalize: () => Promise<Blob>
  /** Aborta e libera o codificador sem produzir arquivo. */
  cancel: () => Promise<void>
}

export interface ExportFramesOptions {
  frames: readonly AnimationFrame[]
  /**
   * Põe a cena no estado do quadro, renderiza e entrega ao codificador — tudo
   * no MESMO passo síncrono, e devolve a contrapressão para ser esperada aqui.
   *
   * Desenhar e entregar não podem ser dois passos separados: sem
   * `preserveDrawingBuffer`, o canvas WebGL só pode ser lido no passo em que
   * foi desenhado, e o canvas volta ao tamanho da janela logo depois do
   * `render` (ver `sceneCapture.renderAtResolution`).
   */
  encodeFrame: (frame: AnimationFrame) => Promise<void>
  sink: Pick<VideoSink, 'finalize' | 'cancel'>
  onProgress?: (rendered: number, total: number) => void
  /** Consultado antes de cada quadro; `true` interrompe e devolve `null`. */
  isCancelled?: () => boolean
}

/**
 * Percorre os quadros e devolve o arquivo pronto, ou `null` se foi cancelado
 * no meio. Aqui moram a ordem, o progresso e o cancelamento — e nada mais, que
 * é o que torna esta peça testável sem GPU nem codificador.
 *
 * O cancelamento é conferido ENTRE quadros: interromper no meio de um deixaria
 * o codificador com um quadro pela metade.
 */
export async function exportFrames(options: ExportFramesOptions): Promise<Blob | null> {
  const { frames, encodeFrame, sink, onProgress, isCancelled } = options

  for (const frame of frames) {
    if (isCancelled?.()) {
      await sink.cancel()
      return null
    }

    await encodeFrame(frame)
    onProgress?.(frame.index + 1, frames.length)
  }

  return sink.finalize()
}

// ---------------------------------------------------------------------------
// Ponte com a mediabunny (MPL-2.0, zero dependências de runtime — DECISOES #52)
// ---------------------------------------------------------------------------

/**
 * Codecs aceitos, em ordem de preferência. `avc` (H.264) primeiro porque é o
 * que qualquer player abre; os outros são queda para navegadores/máquinas que
 * não codificam H.264, e cabem no mesmo contêiner MP4.
 */
export const VIDEO_CODEC_PREFERENCE: readonly VideoCodec[] = ['avc', 'hevc', 'av1', 'vp9']

/** H.264 trabalha em macroblocos: dimensão ímpar é recusada pelo codificador. */
export function toEvenDimension(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2)
}

/**
 * Primeiro codec que este navegador consegue codificar nesta resolução, ou
 * `null` se nenhum — caso em que o painel desabilita a exportação com
 * mensagem própria, em vez de falhar no meio do processo.
 */
export async function pickVideoCodec(width: number, height: number): Promise<VideoCodec | null> {
  for (const codec of VIDEO_CODEC_PREFERENCE) {
    if (await canEncodeVideo(codec, { width, height })) return codec
  }
  return null
}

export interface Mp4SinkOptions {
  canvas: HTMLCanvasElement
  codec: VideoCodec
  fps: number
}

/**
 * Monta o MP4 em memória a partir do próprio canvas do viewport. O
 * `BufferTarget` guarda o arquivo inteiro em RAM — a 1080p30 são cerca de
 * 1 MB por segundo de vídeo, o que é aceitável; se um dia incomodar, o caminho
 * é o `StreamTarget` gravando direto num `FileSystemWritableFileStream`.
 */
export async function createMp4Sink({ canvas, codec, fps }: Mp4SinkOptions): Promise<VideoSink> {
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH })
  // O `frameRate` faz a `mediabunny` encaixar os instantes na grade da taxa,
  // o que evita jitter de arredondamento no arquivo final.
  output.addVideoTrack(source, { frameRate: fps })
  await output.start()

  return {
    addFrame: (timeS, durationS) => source.add(timeS, durationS),
    finalize: async () => {
      await output.finalize()
      const buffer = output.target.buffer
      if (!buffer) throw new Error('mediabunny finalizou sem produzir buffer')
      return new Blob([buffer], { type: 'video/mp4' })
    },
    cancel: () => output.cancel(),
  }
}

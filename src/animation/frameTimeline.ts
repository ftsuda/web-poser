/**
 * Linha do tempo de quadros da exportação de vídeo (PLANO.md > "Mini
 * animador" > "Exportação MP4"). Lógica pura: nenhuma dependência de WebGL,
 * de WebCodecs ou de relógio — é o que torna a exportação **determinística**.
 *
 * A alternativa seria gravar a tela em tempo real (`canvas.captureStream()` +
 * `MediaRecorder`), e aí a taxa real de quadros passaria a depender da
 * velocidade da máquina: o mesmo projeto sairia diferente a cada exportação.
 * Aqui o relógio é nosso, e uma máquina lenta só demora mais.
 */

export const FPS_OPTIONS = [24, 25, 30, 60] as const

export type Fps = (typeof FPS_OPTIONS)[number]

/**
 * 60 quadros por segundo (pedido do usuário): é a taxa que os players e as
 * redes tratam como "suave" hoje, e o custo de exportar mais quadros é linear.
 * As outras opções continuam ali para casar com material filmado (24 de
 * cinema, 25 de PAL).
 */
export const DEFAULT_FPS: Fps = 60

export interface AnimationFrame {
  index: number
  /** Instante do quadro, em segundos — o que o codificador recebe. */
  timeS: number
  /** Instante do quadro, em milissegundos — o que o amostrador recebe. */
  timeMs: number
  durationS: number
}

export function clampFps(fps: unknown): Fps {
  return FPS_OPTIONS.includes(fps as Fps) ? (fps as Fps) : DEFAULT_FPS
}

/**
 * Quadros de uma animação de `totalMs` a `fps`. São `round(total/1000 × fps)`
 * intervalos **mais o quadro final**: 1 s a 30 fps dá 31 quadros, do instante
 * 0 ao 1,0 inclusive. Sem esse `+1` o último keyframe nunca apareceria no
 * vídeo — a animação terminaria um quadro antes de chegar.
 *
 * Duração zero (ou negativa, se algo escapar do grampeamento) ainda rende um
 * quadro: a imagem parada, que é o resultado correto para uma animação de um
 * keyframe só.
 */
export function frameTimeline(totalMs: number, fps: number): AnimationFrame[] {
  const rate = clampFps(fps)
  const intervals = Number.isFinite(totalMs) && totalMs > 0 ? Math.round((totalMs / 1000) * rate) : 0
  const durationS = 1 / rate

  const frames: AnimationFrame[] = []
  for (let index = 0; index <= intervals; index += 1) {
    frames.push({ index, timeS: index / rate, timeMs: (index / rate) * 1000, durationS })
  }
  return frames
}

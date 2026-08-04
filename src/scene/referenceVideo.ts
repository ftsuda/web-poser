/**
 * O vídeo de referência (PLANO.md > "Vídeo como referência"): a matemática do
 * andar de frame e o ref de módulo do elemento `<video>`.
 *
 * O navegador não expõe "frame" — só `currentTime` em segundos. Avançar ou
 * retroceder um frame é `± 1/fps`, e o fps NÃO é exposto pela API de mídia:
 * vem do seletor do painel ou da medição oportunista via
 * `requestVideoFrameCallback` durante a reprodução (intervalos de `mediaTime`
 * entre frames apresentados). A medição encaixa na taxa comum mais próxima —
 * para o passo do frame, 29,97 e 30 são indistinguíveis.
 *
 * O elemento vive no overlay; os controles (painel/aba) comandam play, pause
 * e seek por este ref — o mesmo regime do `activeViewportCamera` (#111): sem
 * acoplamento de árvore entre casca e overlay.
 */

/** O `<video>` vivo do overlay; `null` fora do modo vídeo. */
export const referenceVideoElement: { current: HTMLVideoElement | null } = { current: null }

/** As taxas comuns: cinema (24), PAL (25/50), NTSC (30/60) e telas rápidas. */
export const FPS_CHOICES: readonly number[] = [12, 15, 24, 25, 30, 48, 50, 60, 90, 120]

/** Um intervalo entre frames só é plausível entre 8 e 240 fps — fora disso é seek ou lixo. */
const DELTA_MIN_S = 1 / 240
const DELTA_MAX_S = 1 / 8
const MIN_SAMPLES = 5

/** O tempo do frame vizinho, grampeado ao vídeo; entradas inválidas não movem. */
export function stepFrameTime(
  currentS: number,
  durationS: number,
  fps: number,
  direction: 1 | -1,
): number {
  if (!Number.isFinite(currentS) || !Number.isFinite(durationS) || durationS <= 0) return currentS
  if (!Number.isFinite(fps) || fps <= 0) return currentS
  return Math.min(durationS, Math.max(0, currentS + direction / fps))
}

/**
 * O fps medido: mediana dos intervalos plausíveis entre frames apresentados,
 * encaixada na taxa comum mais próxima. `null` sem amostras suficientes.
 */
export function fpsFromFrameDeltas(deltasS: readonly number[]): number | null {
  const plausible = deltasS
    .filter((delta) => Number.isFinite(delta) && delta >= DELTA_MIN_S && delta <= DELTA_MAX_S)
    .sort((a, b) => a - b)
  if (plausible.length < MIN_SAMPLES) return null
  const median = plausible[Math.floor(plausible.length / 2)]
  const measured = 1 / median
  return FPS_CHOICES.reduce((best, rate) =>
    Math.abs(rate - measured) < Math.abs(best - measured) ? rate : best,
  )
}

/**
 * A luz direcional da cena, controlável (PLANO.md item 16, `DECISOES.md` #121).
 *
 * Até aqui a luz era uma posição fixa `[4, 6, 3]` cravada no `SceneContent`.
 * Sombra é o que comunica volume num keyframe de referência, e de onde ela cai
 * é decisão de desenho tão relevante quanto o ângulo de câmera — por isso a
 * direção virou **conteúdo de cena** (viaja no arquivo, entra no undo), e não
 * preferência de tela.
 *
 * O usuário mexe em GRAUS (azimute e elevação), nunca em coordenadas: girar a
 * luz em torno do assunto é o gesto real, e três campos X/Y/Z exigiriam pensar
 * em vetores. A **distância é fixa** — girar não pode aproximar nem afastar,
 * senão o brilho mudaria junto com a direção e o controle mentiria.
 *
 * Módulo puro de propósito: sem React, sem three, sem store. Roda no projeto
 * `unidade` da suíte (item 23).
 */

/** Distância da luz ao centro da cena, em metros. Fixa: só a DIREÇÃO se controla. */
export const LIGHT_DISTANCE_M = 8

/**
 * Meia-largura do frustum da câmera de sombra, em metros. O padrão do three
 * (5) bastava com a luz cravada em 50° de elevação; com ela girando até 15°, a
 * sombra de um boneco de 1,70 m estica 6,3 m e sairia cortada ao meio.
 */
export const SHADOW_EXTENT_M = 8

/** Alcance da câmera de sombra: a distância da luz mais a cena inteira à frente dela. */
export const SHADOW_CAMERA_FAR_M = LIGHT_DISTANCE_M * 2 + SHADOW_EXTENT_M

export interface LightSettings {
  /** Azimute em graus: 0 = luz vindo da frente (+Z), positivo gira para a direita (+X). */
  lightAzimuth: number
  /** Elevação em graus acima do horizonte: 90 = a pino. */
  lightElevation: number
  lightIntensity: number
}

export const LIGHT_AZIMUTH_RANGE = { min: -180, max: 180 } as const

/**
 * A elevação mínima **não é zero**. A 15° a sombra de um boneco de 1,70 m já
 * mede 6,3 m; mais rasante que isso ela passa do frustum da câmera de sombra e
 * aparece cortada ao meio — pior de olhar que uma sombra curta. O teto em 85°
 * evita a luz exatamente a pino, onde a direção fica paralela ao "para cima" da
 * câmera de sombra e a matriz degenera.
 */
export const LIGHT_ELEVATION_RANGE = { min: 15, max: 85 } as const

/** Zero apaga a direcional (fica só a hemisférica); acima de 2,5 estoura o branco. */
export const LIGHT_INTENSITY_RANGE = { min: 0, max: 2.5 } as const

/**
 * O padrão reproduz a luz fixa de antes (`[4, 6, 3]`, intensidade 1,2): toda
 * cena salva antes do item 16 abre sem mudar de sombra.
 */
export const DEFAULT_LIGHT: LightSettings = {
  lightAzimuth: 53,
  lightElevation: 50,
  lightIntensity: 1.2,
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Posição da luz em metros, a partir dos dois ângulos. O alvo é sempre a origem. */
export function lightPosition(
  azimuthDeg: number,
  elevationDeg: number,
): [number, number, number] {
  const azimuth = toRad(azimuthDeg)
  const elevation = toRad(elevationDeg)
  const horizontal = Math.cos(elevation) * LIGHT_DISTANCE_M
  return [
    horizontal * Math.sin(azimuth),
    Math.sin(elevation) * LIGHT_DISTANCE_M,
    horizontal * Math.cos(azimuth),
  ]
}

function clampTo(value: number | undefined, range: { min: number; max: number }): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(range.max, Math.max(range.min, value))
}

/**
 * Grampeia o que veio de slider ou de arquivo, campo a campo. Campo ausente (ou
 * que não é número finito) sai ausente — quem chama decide se cai no padrão ou
 * se mantém o valor de antes.
 */
export function clampLightSettings(settings: Partial<LightSettings>): Partial<LightSettings> {
  const clamped: Partial<LightSettings> = {}
  const azimuth = clampTo(settings.lightAzimuth, LIGHT_AZIMUTH_RANGE)
  if (azimuth !== undefined) clamped.lightAzimuth = azimuth
  const elevation = clampTo(settings.lightElevation, LIGHT_ELEVATION_RANGE)
  if (elevation !== undefined) clamped.lightElevation = elevation
  const intensity = clampTo(settings.lightIntensity, LIGHT_INTENSITY_RANGE)
  if (intensity !== undefined) clamped.lightIntensity = intensity
  return clamped
}

/** Lê os três campos de um objeto qualquer (arquivo de cena), caindo no padrão. */
export function lightFromUnknown(source: Partial<LightSettings> | undefined): LightSettings {
  return { ...DEFAULT_LIGHT, ...clampLightSettings(source ?? {}) }
}

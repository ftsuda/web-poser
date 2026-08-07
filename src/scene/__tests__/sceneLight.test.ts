import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIGHT,
  LIGHT_AZIMUTH_RANGE,
  LIGHT_DISTANCE_M,
  LIGHT_ELEVATION_RANGE,
  LIGHT_INTENSITY_RANGE,
  clampLightSettings,
  lightPosition,
} from '../sceneLight'

/**
 * A luz controlável (PLANO.md item 16): o usuário gira azimute e elevação em
 * GRAUS, e a cena precisa de uma posição em metros. A conversão é pura e mora
 * aqui, longe do React — é o que permite testá-la sem montar Canvas nenhum.
 */
describe('lightPosition — azimute/elevação em graus → posição em metros', () => {
  it('azimute 0 põe a luz à FRENTE da cena (+Z); 90 a põe à direita (+X)', () => {
    const [xFront, , zFront] = lightPosition(0, 0)
    expect(zFront).toBeCloseTo(LIGHT_DISTANCE_M, 6)
    expect(xFront).toBeCloseTo(0, 6)

    const [xRight, , zRight] = lightPosition(90, 0)
    expect(xRight).toBeCloseTo(LIGHT_DISTANCE_M, 6)
    expect(zRight).toBeCloseTo(0, 6)

    // Negativo gira para o outro lado — a luz vem da esquerda.
    expect(lightPosition(-90, 0)[0]).toBeCloseTo(-LIGHT_DISTANCE_M, 6)
  })

  it('elevação 90 põe a luz a pino, e a distância ao centro é sempre a mesma', () => {
    const [x, y, z] = lightPosition(37, 90)
    expect(y).toBeCloseTo(LIGHT_DISTANCE_M, 6)
    expect(Math.hypot(x, z)).toBeCloseTo(0, 6)

    // A distância é fixa: girar a luz nunca a aproxima nem a afasta, senão o
    // brilho mudaria junto com a direção e o controle deixaria de ser honesto.
    for (const [azimuth, elevation] of [[0, 20], [45, 50], [-120, 75], [180, 30]]) {
      const position = lightPosition(azimuth, elevation)
      expect(Math.hypot(...position)).toBeCloseTo(LIGHT_DISTANCE_M, 6)
    }
  })

  it('o padrão reproduz a luz fixa que existia antes do item 16', () => {
    // A cena nasceu com a luz em [4, 6, 3]; o padrão em graus tem de cair
    // praticamente no mesmo lugar, senão toda cena salva mudaria de sombra ao
    // abrir. Tolerância de 15 cm sobre 8 m de raio.
    const [x, y, z] = lightPosition(DEFAULT_LIGHT.lightAzimuth, DEFAULT_LIGHT.lightElevation)
    const escala = LIGHT_DISTANCE_M / Math.hypot(4, 6, 3)
    expect(x).toBeCloseTo(4 * escala, 1)
    expect(y).toBeCloseTo(6 * escala, 1)
    expect(z).toBeCloseTo(3 * escala, 1)
  })
})

describe('clampLightSettings — as faixas dos sliders', () => {
  it('grampeia cada campo na sua faixa e ignora valor que não é número', () => {
    expect(clampLightSettings({ lightElevation: 200 }).lightElevation).toBe(LIGHT_ELEVATION_RANGE.max)
    expect(clampLightSettings({ lightElevation: -40 }).lightElevation).toBe(LIGHT_ELEVATION_RANGE.min)
    expect(clampLightSettings({ lightAzimuth: 999 }).lightAzimuth).toBe(LIGHT_AZIMUTH_RANGE.max)
    expect(clampLightSettings({ lightIntensity: -1 }).lightIntensity).toBe(LIGHT_INTENSITY_RANGE.min)

    // `NaN` de um campo de texto vazio não pode virar luz nenhuma.
    expect(clampLightSettings({ lightIntensity: Number.NaN }).lightIntensity).toBeUndefined()
    expect(clampLightSettings({})).toEqual({})
  })

  it('a elevação mínima NÃO é zero: rasante demais a sombra sai do mapa', () => {
    // A 15° a sombra de um boneco de 1,70 m já mede 6,3 m; abaixo disso ela
    // passa do frustum da câmera de sombra e some pela metade, que é pior de
    // olhar que uma sombra curta.
    expect(LIGHT_ELEVATION_RANGE.min).toBeGreaterThan(0)
    expect(LIGHT_ELEVATION_RANGE.max).toBeLessThanOrEqual(90)
  })
})

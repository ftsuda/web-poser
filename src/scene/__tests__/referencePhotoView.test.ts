import { describe, expect, it } from 'vitest'
import {
  PHOTO_ZOOM_MAX,
  PHOTO_ZOOM_MIN,
  clampPhotoView,
  panPhotoView,
  photoRect,
  transformedPhotoRect,
  zoomPhotoViewAround,
} from '../referencePhotoView'

/**
 * A vista da foto de referência (zoom + deslocamento): matemática pura, fora
 * do React — o overlay só a consome. O deslocamento é guardado em FRAÇÕES do
 * retângulo "contain" base (não em pixels): redimensionar a janela muda o
 * base, e a foto continua no mesmo lugar RELATIVO.
 */

const CONTAINER = { width: 800, height: 600 }
const NEUTRAL = { zoom: 1, offsetX: 0, offsetY: 0 }

describe('referencePhotoView', () => {
  it('o retângulo "contain": foto 2:1 num contêiner 800×600 dá 800×400 com faixas de 100', () => {
    expect(photoRect(CONTAINER, 2)).toEqual({ left: 0, top: 100, width: 800, height: 400 })
    expect(photoRect(CONTAINER, 1)).toEqual({ left: 100, top: 0, width: 600, height: 600 })
  })

  it('vista neutra = o próprio retângulo "contain"', () => {
    expect(transformedPhotoRect(CONTAINER, 2, NEUTRAL)).toEqual(photoRect(CONTAINER, 2))
  })

  it('zoom 2 amplia em torno do centro; o deslocamento é em frações do retângulo base', () => {
    expect(transformedPhotoRect(CONTAINER, 2, { zoom: 2, offsetX: 0, offsetY: 0 })).toEqual({
      left: -400,
      top: -100,
      width: 1600,
      height: 800,
    })
    // offsetX em frações da LARGURA base (800), offsetY da ALTURA base (400).
    expect(transformedPhotoRect(CONTAINER, 2, { zoom: 1, offsetX: 0.25, offsetY: 0.5 })).toEqual({
      left: 200,
      top: 300,
      width: 800,
      height: 400,
    })
  })

  it('zoom em torno de um ponto: o pixel da foto sob o ponteiro não sai do lugar', () => {
    const anchor = { x: 200, y: 200 }
    const before = transformedPhotoRect(CONTAINER, 2, NEUTRAL)
    const photoPoint = {
      x: (anchor.x - before.left) / before.width,
      y: (anchor.y - before.top) / before.height,
    }

    const zoomed = zoomPhotoViewAround(NEUTRAL, CONTAINER, 2, anchor, 2)
    const after = transformedPhotoRect(CONTAINER, 2, zoomed)
    expect(after.left + photoPoint.x * after.width).toBeCloseTo(anchor.x, 6)
    expect(after.top + photoPoint.y * after.height).toBeCloseTo(anchor.y, 6)
    expect(zoomed.zoom).toBe(2)
  })

  it('arrastar desloca em pixels convertidos a frações do base', () => {
    const panned = panPhotoView(NEUTRAL, CONTAINER, 2, 50, 30)
    expect(panned.offsetX).toBeCloseTo(50 / 800, 9)
    expect(panned.offsetY).toBeCloseTo(30 / 400, 9)
    const rect = transformedPhotoRect(CONTAINER, 2, panned)
    expect(rect.left).toBeCloseTo(50, 9)
    expect(rect.top).toBeCloseTo(130, 9)
  })

  it('grampos: zoom entre os limites; deslocamento cresce com o zoom (a foto nunca se perde)', () => {
    expect(clampPhotoView({ zoom: 100, offsetX: 0, offsetY: 0 }).zoom).toBe(PHOTO_ZOOM_MAX)
    expect(clampPhotoView({ zoom: 0.01, offsetX: 0, offsetY: 0 }).zoom).toBe(PHOTO_ZOOM_MIN)

    // Em zoom 1 o deslocamento máximo é ±1 (meia foto + meia janela);
    // em zoom 4 vai a ±2.5 — sempre 0.5 + zoom/2.
    expect(clampPhotoView({ zoom: 1, offsetX: 9, offsetY: -9 })).toEqual({
      zoom: 1,
      offsetX: 1,
      offsetY: -1,
    })
    expect(clampPhotoView({ zoom: 4, offsetX: 9, offsetY: 9 })).toEqual({
      zoom: 4,
      offsetX: 2.5,
      offsetY: 2.5,
    })
  })

  it('vista degenerada (contêiner sem tamanho) não explode nem altera nada', () => {
    const view = { zoom: 2, offsetX: 0.5, offsetY: 0 }
    expect(panPhotoView(view, { width: 0, height: 0 }, 1, 10, 10)).toEqual(view)
    expect(zoomPhotoViewAround(view, { width: 0, height: 0 }, 1, { x: 0, y: 0 }, 4)).toEqual(view)
  })
})

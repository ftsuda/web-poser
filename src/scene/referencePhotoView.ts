/**
 * A vista da foto de referência: zoom + deslocamento sobre o retângulo
 * "contain" (PLANO.md > "Pose por marcação manual"). Matemática pura, sem
 * React — o `ReferencePhotoOverlay` posiciona a `<img>` e os marcadores por
 * ela, e o `referenceImageStore` guarda a vista.
 *
 * O deslocamento é guardado em FRAÇÕES do retângulo base (offsetX da largura,
 * offsetY da altura), não em pixels: quando a janela muda de tamanho, o base
 * muda junto e a foto permanece no mesmo lugar relativo. Como as marcas são
 * normalizadas à foto, elas atravessam qualquer zoom/deslocamento sem
 * conversão — e a inferência (que só usa direções entre marcas) nem percebe.
 */

export interface PhotoView {
  zoom: number
  offsetX: number
  offsetY: number
}

export interface PhotoContainer {
  width: number
  height: number
}

export interface PhotoRect {
  left: number
  top: number
  width: number
  height: number
}

export const PHOTO_ZOOM_MIN = 0.25
export const PHOTO_ZOOM_MAX = 8

/** Retângulo da foto (ajuste "contain") dentro do contêiner, sem zoom/deslocamento. */
export function photoRect(container: PhotoContainer, aspect: number): PhotoRect {
  const width = Math.min(container.width, container.height * aspect)
  const height = width / aspect
  return {
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
    height,
  }
}

/**
 * Grampeia a vista: zoom entre os limites e deslocamento até 0.5 + zoom/2 —
 * o suficiente para levar qualquer canto da foto ao centro da janela, e nunca
 * o bastante para a foto sumir sem volta (e há o "Recentrar" de toda forma).
 */
export function clampPhotoView(view: PhotoView): PhotoView {
  const zoom = Math.min(PHOTO_ZOOM_MAX, Math.max(PHOTO_ZOOM_MIN, view.zoom))
  const maxOffset = 0.5 + zoom / 2
  return {
    zoom,
    offsetX: Math.min(maxOffset, Math.max(-maxOffset, view.offsetX)),
    offsetY: Math.min(maxOffset, Math.max(-maxOffset, view.offsetY)),
  }
}

/** O retângulo da foto na tela: base "contain" ampliado em torno do próprio centro e deslocado. */
export function transformedPhotoRect(
  container: PhotoContainer,
  aspect: number,
  view: PhotoView,
): PhotoRect {
  const base = photoRect(container, aspect)
  return {
    left: base.left + (base.width * (1 - view.zoom)) / 2 + view.offsetX * base.width,
    top: base.top + (base.height * (1 - view.zoom)) / 2 + view.offsetY * base.height,
    width: base.width * view.zoom,
    height: base.height * view.zoom,
  }
}

/** Desloca a vista por um delta em PIXELS do contêiner (arrasto). */
export function panPhotoView(
  view: PhotoView,
  container: PhotoContainer,
  aspect: number,
  dxPx: number,
  dyPx: number,
): PhotoView {
  const base = photoRect(container, aspect)
  if (base.width <= 0 || base.height <= 0) return view
  return clampPhotoView({
    zoom: view.zoom,
    offsetX: view.offsetX + dxPx / base.width,
    offsetY: view.offsetY + dyPx / base.height,
  })
}

/**
 * Muda o zoom mantendo fixo o pixel da foto sob o ponto dado (coordenadas do
 * contêiner) — é o que faz roda e pinça ampliarem "para onde se aponta".
 */
export function zoomPhotoViewAround(
  view: PhotoView,
  container: PhotoContainer,
  aspect: number,
  anchor: { x: number; y: number },
  nextZoom: number,
): PhotoView {
  const base = photoRect(container, aspect)
  if (base.width <= 0 || base.height <= 0) return view
  const rect = transformedPhotoRect(container, aspect, view)
  const zoom = Math.min(PHOTO_ZOOM_MAX, Math.max(PHOTO_ZOOM_MIN, nextZoom))
  // Ponto da foto sob a âncora (pode estar fora de 0–1; a conta vale igual).
  const px = (anchor.x - rect.left) / rect.width
  const py = (anchor.y - rect.top) / rect.height
  // O novo `left` que mantém esse ponto sob a âncora, desfeito em offset.
  const left = anchor.x - px * base.width * zoom
  const top = anchor.y - py * base.height * zoom
  return clampPhotoView({
    zoom,
    offsetX: (left - base.left) / base.width - (1 - zoom) / 2,
    offsetY: (top - base.top) / base.height - (1 - zoom) / 2,
  })
}

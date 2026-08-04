import '../../i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useReferenceImageStore } from '../../store/referenceImageStore'
import { referenceVideoElement } from '../referenceVideo'
import { ReferencePhotoOverlay } from '../ReferencePhotoOverlay'

/**
 * O overlay da foto de referência: papel vegetal atravessável fora da
 * marcação, e a conversão toque → coordenada NORMALIZADA DA FOTO (não do
 * contêiner) — é o que mantém as marcas no mesmo pixel da imagem quando a
 * janela muda de tamanho.
 */
describe('ReferencePhotoOverlay', () => {
  beforeEach(() => {
    useReferenceImageStore.setState(useReferenceImageStore.getInitialState())
    // Contêiner de 800×600 no jsdom (que não mede layout de verdade).
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    } as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sem foto não renderiza nada', () => {
    const { container } = render(<ReferencePhotoOverlay />)
    expect(container).toBeEmptyDOMElement()
  })

  it('um TOQUE (descer + soltar parado) vira marca em coordenadas DA FOTO — letterbox descontado', () => {
    act(() => {
      // Foto 2:1 num contêiner 800×600: ajuste "contain" dá 800×400, com
      // faixas de 100 px em cima e embaixo.
      useReferenceImageStore.setState({ imageUrl: 'blob:foto', imageName: 'a.jpg', aspect: 2, marking: true })
    })
    render(<ReferencePhotoOverlay />)
    const layer = screen.getByTestId('reference-photo')

    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 400, clientY: 300 })
    // Só descer não marca: a confirmação é na SOLTURA (senão pinça marcaria).
    expect(useReferenceImageStore.getState().marks.head).toBeUndefined()
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 400, clientY: 300 })
    expect(useReferenceImageStore.getState().marks.head).toEqual({ x: 0.5, y: 0.5 })

    // Na faixa do letterbox (fora da foto) o toque não marca nada.
    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 400, clientY: 50 })
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 400, clientY: 50 })
    expect(Object.keys(useReferenceImageStore.getState().marks)).toHaveLength(1)

    // Dedo que se arrasta não é toque: nada de marca nova.
    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 300, clientY: 300 })
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 340, clientY: 300 })
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 340, clientY: 300 })
    expect(Object.keys(useReferenceImageStore.getState().marks)).toHaveLength(1)
  })

  it('com zoom, o toque e os marcadores usam o retângulo TRANSFORMADO da foto', () => {
    act(() => {
      useReferenceImageStore.setState({
        imageUrl: 'blob:foto',
        imageName: 'a.jpg',
        aspect: 2,
        marking: true,
        photoZoom: 2,
      })
    })
    render(<ReferencePhotoOverlay />)
    const layer = screen.getByTestId('reference-photo')

    // Zoom 2 em torno do centro: retângulo (-400,-100)–1600×800. O ponto de
    // tela (0,300) é o pixel (0.25, 0.5) da foto.
    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 0, clientY: 300 })
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 0, clientY: 300 })
    expect(useReferenceImageStore.getState().marks.head).toEqual({ x: 0.25, y: 0.5 })

    // E o marcador é desenhado de volta no mesmo ponto de tela.
    const marker = screen.getByRole('button', { name: 'Cabeça' })
    expect(marker.style.left).toBe('0px')
    expect(marker.style.top).toBe('300px')
  })

  it('pinça durante a marcação: dois dedos dão zoom e NÃO deixam marca', () => {
    act(() => {
      useReferenceImageStore.setState({ imageUrl: 'blob:foto', imageName: 'a.jpg', aspect: 2, marking: true })
    })
    render(<ReferencePhotoOverlay />)
    const layer = screen.getByTestId('reference-photo')

    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 300, clientY: 300 })
    fireEvent.pointerDown(layer, { pointerId: 2, clientX: 500, clientY: 300 })
    // Afasta os dedos: distância 200 → 400 = zoom 2.
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 200, clientY: 300 })
    fireEvent.pointerMove(layer, { pointerId: 2, clientX: 600, clientY: 300 })
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 200, clientY: 300 })
    fireEvent.pointerUp(layer, { pointerId: 2, clientX: 600, clientY: 300 })

    expect(useReferenceImageStore.getState().photoZoom).toBeCloseTo(2, 6)
    expect(useReferenceImageStore.getState().marks).toEqual({})
  })

  it('a roda do mouse amplia a foto no modo de marcação', () => {
    act(() => {
      useReferenceImageStore.setState({ imageUrl: 'blob:foto', imageName: 'a.jpg', aspect: 2, marking: true })
    })
    render(<ReferencePhotoOverlay />)

    fireEvent.wheel(screen.getByTestId('reference-photo'), { deltaY: -100, clientX: 400, clientY: 300 })
    expect(useReferenceImageStore.getState().photoZoom).toBeCloseTo(Math.exp(0.2), 6)
  })

  it('no modo "ajustar foto", arrastar com um dedo desloca a foto', () => {
    act(() => {
      useReferenceImageStore.setState({ imageUrl: 'blob:foto', imageName: 'a.jpg', aspect: 2, adjusting: true })
    })
    render(<ReferencePhotoOverlay />)
    const layer = screen.getByTestId('reference-photo')
    expect(layer).toHaveClass('reference-photo--adjusting')

    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 450, clientY: 330 })
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 450, clientY: 330 })

    expect(useReferenceImageStore.getState().photoOffsetX).toBeCloseTo(50 / 800, 9)
    expect(useReferenceImageStore.getState().photoOffsetY).toBeCloseTo(30 / 400, 9)
    expect(useReferenceImageStore.getState().marks).toEqual({})
  })

  it('as marcas aparecem numeradas na ordem da sequência, com o nome acessível', () => {
    act(() => {
      useReferenceImageStore.setState({
        imageUrl: 'blob:foto',
        imageName: 'a.jpg',
        aspect: 1,
        marking: true,
        marks: { head: { x: 0.5, y: 0.1 }, 'shoulder.L': { x: 0.4, y: 0.3 } },
      })
    })
    render(<ReferencePhotoOverlay />)

    // A numeração segue a sequência agrupada por membro (#113): 1 cabeça,
    // 2 nariz, 3 base do pescoço (#113.1), 4 base do tórax (#119), 5–7 braço
    // direito, 8 é o ombro esquerdo.
    expect(screen.getByRole('button', { name: 'Cabeça' })).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Ombro esquerdo' })).toHaveTextContent('8')
  })

  it('vídeo: renderiza <video> no mesmo retângulo, registra o elemento e espelha metadados', () => {
    act(() => {
      useReferenceImageStore.setState({ imageUrl: 'blob:video', imageName: 'ref.mp4', kind: 'video' })
    })
    const { unmount } = render(<ReferencePhotoOverlay />)

    const video = screen.getByTestId('reference-video') as HTMLVideoElement
    expect(video.tagName).toBe('VIDEO')
    // O ref de módulo é como os controles (painel/aba) comandam play e seek.
    expect(referenceVideoElement.current).toBe(video)

    Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true })
    Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true })
    Object.defineProperty(video, 'duration', { value: 8, configurable: true })
    fireEvent.loadedMetadata(video)
    expect(useReferenceImageStore.getState().aspect).toBeCloseTo(1920 / 1080, 6)
    expect(useReferenceImageStore.getState().videoDuration).toBe(8)

    Object.defineProperty(video, 'currentTime', { value: 2.5, configurable: true })
    fireEvent.timeUpdate(video)
    expect(useReferenceImageStore.getState().videoTime).toBe(2.5)

    unmount()
    expect(referenceVideoElement.current).toBeNull()
  })

  it('fora do modo de marcação a foto é só papel vegetal — sem marcadores', () => {
    act(() => {
      useReferenceImageStore.setState({
        imageUrl: 'blob:foto',
        imageName: 'a.jpg',
        marking: false,
        marks: { head: { x: 0.5, y: 0.1 } },
      })
    })
    render(<ReferencePhotoOverlay />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByTestId('reference-photo')).not.toHaveClass('reference-photo--marking')
  })
})

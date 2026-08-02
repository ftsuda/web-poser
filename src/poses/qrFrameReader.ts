import jsQR from 'jsqr'

/**
 * Leitura de UM quadro de vídeo em busca de um QR code (item 65).
 *
 * Dois caminhos, decididos uma vez na criação: o `BarcodeDetector` nativo
 * quando o navegador tem (Android/Chrome — decodificação por hardware, mais
 * rápida) e o `jsQR` empacotado no resto (iOS/Safari). O leitor devolve o
 * texto do QR encontrado ou `null` — quadro sem QR não é erro, é o estado
 * normal da câmera procurando a tela.
 */
export type QrFrameReader = (video: HTMLVideoElement) => Promise<string | null>

// O `BarcodeDetector` ainda não está no lib.dom do TypeScript — tipos mínimos.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeDetectorLike
}

export function createQrFrameReader(): QrFrameReader {
  const NativeDetector = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector

  if (NativeDetector) {
    const detector = new NativeDetector({ formats: ['qr_code'] })
    return async (video) => {
      try {
        const found = await detector.detect(video)
        return found[0]?.rawValue ?? null
      } catch {
        // Quadro ainda sem dimensão ou formato não suportado — segue o ciclo.
        return null
      }
    }
  }

  // Fallback: copia o quadro para um canvas e decodifica em JS puro. O canvas
  // é um só, reaproveitado — criar um por quadro seria lixo por segundo.
  const canvas = document.createElement('canvas')
  return async (video) => {
    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) return null
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(video, 0, 0, width, height)
    const image = context.getImageData(0, 0, width, height)
    const found = jsQR(image.data, width, height)
    return found?.data ?? null
  }
}

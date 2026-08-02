import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQrFrameReader } from '../qrFrameReader'

/**
 * O leitor de quadro decide o caminho UMA vez: `BarcodeDetector` nativo quando
 * o navegador tem, `jsQR` empacotado no resto. A câmera em si não é testável
 * aqui (jsdom não tem vídeo de verdade) — o que se trava por teste é a escolha
 * do caminho e o contrato "quadro sem QR devolve null, nunca lança".
 */

type DetectorGlobal = { BarcodeDetector?: unknown }

afterEach(() => {
  delete (globalThis as DetectorGlobal).BarcodeDetector
})

describe('createQrFrameReader', () => {
  it('usa o BarcodeDetector nativo quando existe, pedindo só qr_code', async () => {
    const detect = vi.fn().mockResolvedValue([{ rawValue: 'VMQR1|id|1|1|abc' }])
    const constructed: unknown[] = []
    ;(globalThis as DetectorGlobal).BarcodeDetector = class {
      detect = detect
      constructor(options: unknown) {
        constructed.push(options)
      }
    }

    const read = createQrFrameReader()
    const video = document.createElement('video')

    await expect(read(video)).resolves.toBe('VMQR1|id|1|1|abc')
    expect(constructed).toEqual([{ formats: ['qr_code'] }])
    expect(detect).toHaveBeenCalledWith(video)
  })

  it('quadro sem QR no detector nativo devolve null', async () => {
    ;(globalThis as DetectorGlobal).BarcodeDetector = class {
      detect = vi.fn().mockResolvedValue([])
    }
    const read = createQrFrameReader()
    await expect(read(document.createElement('video'))).resolves.toBeNull()
  })

  it('falha do detector nativo vira null — quadro ruim é estado normal, não erro', async () => {
    ;(globalThis as DetectorGlobal).BarcodeDetector = class {
      detect = vi.fn().mockRejectedValue(new Error('quadro sem dimensão'))
    }
    const read = createQrFrameReader()
    await expect(read(document.createElement('video'))).resolves.toBeNull()
  })

  it('sem detector nativo, vídeo ainda sem dimensão devolve null sem tocar o canvas', async () => {
    const read = createQrFrameReader()
    await expect(read(document.createElement('video'))).resolves.toBeNull()
  })
})

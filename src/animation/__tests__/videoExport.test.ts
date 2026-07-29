import { describe, expect, it, vi } from 'vitest'
import { exportFrames, toEvenDimension, type VideoSink } from '../videoExport'
import { frameTimeline } from '../frameTimeline'

function sinkFalso(registro: string[]): Pick<VideoSink, 'finalize' | 'cancel'> {
  return {
    finalize: async () => {
      registro.push('finalize')
      return new Blob(['mp4'], { type: 'video/mp4' })
    },
    cancel: async () => {
      registro.push('cancel')
    },
  }
}

describe('exportFrames', () => {
  it('percorre TODOS os quadros, em ordem, e fecha o arquivo no fim', async () => {
    const registro: string[] = []
    const frames = frameTimeline(100, 30)

    await exportFrames({
      frames,
      encodeFrame: async (frame) => {
        registro.push(`quadro:${frame.index}@${frame.timeS.toFixed(4)}`)
      },
      sink: sinkFalso(registro),
    })

    expect(frames).toHaveLength(4)
    expect(registro).toEqual([
      'quadro:0@0.0000',
      'quadro:1@0.0333',
      'quadro:2@0.0667',
      'quadro:3@0.1000',
      'finalize',
    ])
  })

  it('devolve o arquivo pronto', async () => {
    const blob = await exportFrames({
      frames: frameTimeline(0, 30),
      encodeFrame: async () => {},
      sink: sinkFalso([]),
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob!.type).toBe('video/mp4')
  })

  it('informa o progresso quadro a quadro', async () => {
    const onProgress = vi.fn()

    await exportFrames({
      frames: frameTimeline(100, 30),
      encodeFrame: async () => {},
      sink: sinkFalso([]),
      onProgress,
    })

    expect(onProgress.mock.calls).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ])
  })

  it('cancela no meio: para de renderizar, libera o codificador e não produz arquivo', async () => {
    const registro: string[] = []
    let renderizados = 0

    const blob = await exportFrames({
      frames: frameTimeline(1000, 30),
      encodeFrame: async () => {
        renderizados += 1
      },
      sink: sinkFalso(registro),
      isCancelled: () => renderizados >= 3,
    })

    expect(blob).toBeNull()
    expect(renderizados).toBe(3)
    expect(registro).toContain('cancel')
    expect(registro).not.toContain('finalize')
  })

  it('espera a contrapressão do codificador antes de renderizar o quadro seguinte', async () => {
    const emVoo: number[] = []
    let abertos = 0

    await exportFrames({
      frames: frameTimeline(200, 30),
      encodeFrame: async () => {
        abertos += 1
        emVoo.push(abertos)
        await Promise.resolve()
        abertos -= 1
      },
      sink: sinkFalso([]),
    })

    // Nunca há dois quadros dentro do codificador ao mesmo tempo — é o que a
    // contrapressão da `mediabunny` pede.
    expect(Math.max(...emVoo)).toBe(1)
  })
})

describe('toEvenDimension', () => {
  it('arredonda para baixo até um número par — H.264 trabalha em macroblocos', () => {
    expect(toEvenDimension(1920)).toBe(1920)
    expect(toEvenDimension(1081)).toBe(1080)
    expect(toEvenDimension(3)).toBe(2)
  })

  it('nunca devolve zero, que não é resolução', () => {
    expect(toEvenDimension(0)).toBe(2)
    expect(toEvenDimension(1)).toBe(2)
  })
})

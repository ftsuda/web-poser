import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FrameMaskOverlay } from '../FrameMaskOverlay'
import { fitFrameRect } from '../frameMask'
import { useUIStore } from '../../store/uiStore'

describe('FrameMaskOverlay', () => {
  beforeEach(() => {
    useUIStore.setState({ frameMaskRect: null })
  })

  afterEach(() => {
    cleanup()
    useUIStore.setState({ frameMaskRect: null })
  })

  it('não desenha nada com a máscara desligada', () => {
    render(<FrameMaskOverlay />)
    expect(screen.queryByTestId('frame-mask')).toBeNull()
  })

  it('desenha o retângulo da saída na posição e no tamanho medidos', () => {
    // Janela 4:3 mostrando um quadro 16:9: barras em cima e embaixo.
    useUIStore.setState({ frameMaskRect: fitFrameRect(1200, 900, 1920, 1080) })
    render(<FrameMaskOverlay />)

    const mascara = screen.getByTestId('frame-mask')
    expect(mascara.style.left).toBe('0px')
    expect(mascara.style.top).toBe('112.5px')
    expect(mascara.style.width).toBe('1200px')
    expect(mascara.style.height).toBe('675px')
  })

  it('é decoração: fica fora do leitor de tela', () => {
    useUIStore.setState({ frameMaskRect: fitFrameRect(1600, 900, 1080, 1080) })
    render(<FrameMaskOverlay />)

    expect(screen.getByTestId('frame-mask')).toHaveAttribute('aria-hidden', 'true')
  })
})

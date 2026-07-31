import { beforeEach, describe, expect, it } from 'vitest'
import { MIN_DEPTH_NEAR, MIN_DEPTH_SPAN } from '../../scene/depthMap'
import { useDepthStore } from '../depthStore'

/**
 * Fase 13. As três escolhas de profundidade são INDEPENDENTES (decisão do
 * usuário): ver na tela, gerar o PNG e exportar o MP4. Ligar uma não liga as
 * outras — é o que permite conferir o volume na tela e ainda capturar a imagem
 * normal.
 */
describe('depthStore', () => {
  beforeEach(() => {
    useDepthStore.setState(useDepthStore.getInitialState())
  })

  it('nasce com tudo desligado e a faixa automática', () => {
    const state = useDepthStore.getState()

    expect(state.previewEnabled).toBe(false)
    expect(state.snapshotDepth).toBe(false)
    expect(state.videoDepth).toBe(false)
    expect(state.autoRange).toBe(true)
  })

  // O chão recortado pela faixa é o padrão: grampeado, ele vira uma cunha
  // branca chapada que disputa o branco com o boneco.
  it('nasce com o chão recortado pela faixa', () => {
    expect(useDepthStore.getState().groundMode).toBe('clipped')

    useDepthStore.getState().setGroundMode('hidden')
    expect(useDepthStore.getState().groundMode).toBe('hidden')
  })

  it('as três escolhas não se contaminam', () => {
    useDepthStore.getState().togglePreview()

    const state = useDepthStore.getState()
    expect(state.previewEnabled).toBe(true)
    expect(state.snapshotDepth).toBe(false)
    expect(state.videoDepth).toBe(false)
  })

  it('liga e desliga cada saída', () => {
    useDepthStore.getState().toggleSnapshotDepth()
    expect(useDepthStore.getState().snapshotDepth).toBe(true)

    useDepthStore.getState().toggleVideoDepth()
    expect(useDepthStore.getState().videoDepth).toBe(true)

    useDepthStore.getState().toggleSnapshotDepth()
    expect(useDepthStore.getState().snapshotDepth).toBe(false)
  })

  it('travar a faixa é uma alternância própria, e não apaga os números', () => {
    useDepthStore.getState().setNearM(3)
    useDepthStore.getState().toggleAutoRange()

    expect(useDepthStore.getState().autoRange).toBe(false)
    expect(useDepthStore.getState().nearM).toBe(3)
  })

  it('mantém perto e longe válidos — o painel comita o que foi digitado', () => {
    useDepthStore.getState().setNearM(-5)
    expect(useDepthStore.getState().nearM).toBe(MIN_DEPTH_NEAR)

    useDepthStore.getState().setNearM(2)
    useDepthStore.getState().setFarM(1)
    expect(useDepthStore.getState().farM).toBe(2 + MIN_DEPTH_SPAN)
  })

  it('campo vazio (NaN) não corrompe a faixa', () => {
    useDepthStore.getState().setFarM(Number.NaN)

    const { nearM, farM } = useDepthStore.getState()
    expect(Number.isFinite(nearM)).toBe(true)
    expect(farM).toBeGreaterThan(nearM)
  })
})

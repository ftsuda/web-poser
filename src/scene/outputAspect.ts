import { useSnapshotCaptureStore } from '../store/snapshotCaptureStore'
import { useUIStore } from '../store/uiStore'
import { frameMaskResolution, type FrameMaskSource, type OutputResolution } from './frameMask'

/**
 * Proporção da SAÍDA que a câmera de cena enquadra (fase 11). A câmera não
 * renderiza mais para a janela, e sim para o arquivo — então o que os planos
 * cinematográficos precisam saber é quanta LARGURA o arquivo tem, não a janela.
 *
 * Qual proporção? A escolhida na máscara de enquadramento
 * (`uiStore.frameMaskSource`: 16:9, 9:16 ou 1:1 — fase 11.4). Com a máscara
 * desligada vale a proporção configurada do INSTANTÂNEO — é a saída primária,
 * e uma escolha estável é melhor que herdar a proporção da janela, que muda
 * com o layout dos painéis.
 */
function aspectOf(source: FrameMaskSource, snapshot: OutputResolution): number {
  const { width, height } = frameMaskResolution(source) ?? snapshot
  return width > 0 && height > 0 ? width / height : 16 / 9
}

export function readOutputAspect(): number {
  return aspectOf(useUIStore.getState().frameMaskSource, useSnapshotCaptureStore.getState())
}

/** A mesma proporção, reativa — para o frustum do gizmo acompanhar a escolha de saída. */
export function useOutputAspect(): number {
  const source = useUIStore((state) => state.frameMaskSource)
  const snapshotWidth = useSnapshotCaptureStore((state) => state.width)
  const snapshotHeight = useSnapshotCaptureStore((state) => state.height)

  return aspectOf(source, { width: snapshotWidth, height: snapshotHeight })
}

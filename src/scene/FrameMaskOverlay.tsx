import { useUIStore } from '../store/uiStore'

/**
 * Metade de fora do `<Canvas>` da máscara de enquadramento: escurece o que a
 * saída vai cortar e contorna o que ela vai conter. O retângulo vem do
 * `FrameMaskCamera`, que o mede lá dentro.
 *
 * É DOM, e não um objeto na cena, por dois motivos que se somam: nada aqui pode
 * vazar para o arquivo exportado (o PNG e o MP4 leem o buffer do WebGL, que a
 * máscara nunca toca), e o véu escuro sai de graça com um `box-shadow`, sem
 * geometria nem material novos.
 *
 * `pointer-events: none` no CSS mantém a órbita e a seleção funcionando por
 * baixo dela, e `aria-hidden` a mantém fora do leitor de tela: é decoração.
 */
export function FrameMaskOverlay() {
  const rect = useUIStore((state) => state.frameMaskRect)
  if (!rect) return null

  return (
    <div
      className="viewport__frame-mask"
      data-testid="frame-mask"
      aria-hidden="true"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    />
  )
}

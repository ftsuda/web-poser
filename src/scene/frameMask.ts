import * as THREE from 'three'

/**
 * Máscara de enquadramento: a geometria que faz o viewport mostrar a proporção
 * da SAÍDA, e não a da janela.
 *
 * O problema que ela resolve vem da fase 10 (DECISOES.md #52.1): a exportação
 * — PNG ou MP4 — troca a proporção da câmera em `applyOutputAspect`, então o
 * enquadramento que se compõe na tela nunca foi exatamente o do arquivo. Com a
 * máscara, o retângulo claro é o arquivo: o que fica de fora dele é o que a
 * exportação corta.
 *
 * Duas peças, e as duas são necessárias:
 *
 * 1. `fitFrameRect` — o maior retângulo com a proporção da saída que cabe na
 *    janela. É o que a máscara escurece por fora.
 * 2. `applyFrameMaskFit` — o afastamento da câmera. Sem ele o retângulo
 *    MENTIRIA sempre que a saída é mais larga que a janela (o caso comum: um
 *    16:9 num viewport quase quadrado), porque aí o quadro exportado inclui
 *    laterais que a janela nunca chegou a mostrar. Afastar é o que traz o
 *    quadro inteiro para dentro — é o mesmo que a "vista de câmera" do Blender
 *    faz.
 *
 * O afastamento é feito por `setViewOffset`, e não por `camera.zoom`, de
 * propósito: `zoom` já tem dono na câmera ortográfica (o `CameraRig` calcula
 * ali a equivalência com a distância da perspectiva), e disputar o mesmo campo
 * quebraria a projeção ortográfica. `view` é um canal separado, funciona igual
 * nos dois tipos de câmera e some com um `clearViewOffset`.
 */

/** Câmeras que sabem deslocar a vista — as duas que o `CameraRig` mantém vivas. */
export type FramableCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera

/**
 * De qual saída a máscara mostra a proporção. As duas resoluções são
 * independentes (o instantâneo pode ser 4K quadrado e o vídeo Full HD), então
 * o usuário escolhe qual está compondo — um controle só, em vez de uma caixa
 * por painel, para nunca haver duas máscaras disputando a tela.
 */
export const FRAME_MASK_SOURCES = ['off', 'snapshot', 'animation'] as const

export type FrameMaskSource = (typeof FRAME_MASK_SOURCES)[number]

export interface FrameRect {
  /** Largura do quadro de saída, em pixels de tela. */
  width: number
  /** Altura do quadro de saída, em pixels de tela. */
  height: number
  /** Canto esquerdo do quadro dentro do viewport, em pixels de tela. */
  left: number
  /** Canto superior do quadro dentro do viewport, em pixels de tela. */
  top: number
  /**
   * Quanto a câmera precisa se afastar para o quadro inteiro caber na janela:
   * 1 quando a saída é mais estreita que a janela (não falta nada, só sobra
   * dos lados) e menor que 1 quando é mais larga.
   */
  fit: number
}

/** Arredonda a 1e-4 para o retângulo não carregar ruído de ponto flutuante para a tela. */
function clean(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

/**
 * O maior retângulo com a proporção `outputWidth × outputHeight` que cabe numa
 * janela `viewportWidth × viewportHeight`, centrado, mais o afastamento de
 * câmera que ele exige. `null` quando algum dos lados não forma um retângulo
 * (janela ainda sem medida, resolução zerada).
 */
export function fitFrameRect(
  viewportWidth: number,
  viewportHeight: number,
  outputWidth: number,
  outputHeight: number,
): FrameRect | null {
  const lados = [viewportWidth, viewportHeight, outputWidth, outputHeight]
  if (lados.some((lado) => !Number.isFinite(lado) || lado <= 0)) return null

  const outputAspect = outputWidth / outputHeight
  const viewportAspect = viewportWidth / viewportHeight

  // Saída mais larga (ou igual): o quadro toma a largura toda e sobram barras
  // em cima e embaixo. Mais estreita: toma a altura toda, barras nos lados.
  const width = outputAspect >= viewportAspect ? viewportWidth : viewportHeight * outputAspect
  const height = outputAspect >= viewportAspect ? viewportWidth / outputAspect : viewportHeight

  return {
    width: clean(width),
    height: clean(height),
    left: clean((viewportWidth - width) / 2),
    top: clean((viewportHeight - height) / 2),
    // A altura do quadro sobre a altura da janela É o fator de afastamento: o
    // campo de visão vertical da câmera passa a caber em `height` pixels em vez
    // de na janela inteira, que é justamente o que a exportação preserva.
    //
    // Sai INTEIRO, sem o arredondamento dos lados: os outros três são pixels de
    // tela, este entra na matriz de projeção — cortá-lo em 1e-4 desalinharia a
    // borda da máscara da borda do quadro em frações de pixel.
    fit: height / viewportHeight,
  }
}

/**
 * Afasta a câmera pelo fator `fit`, para que o quadro inteiro da saída caiba na
 * janela. Devolve o restaurador, que devolve o deslocamento de vista que a
 * câmera tinha antes (normalmente nenhum).
 *
 * `fit === 1` não mexe em nada: é o caso em que a janela já mostra tudo o que a
 * saída mostra.
 */
export function applyFrameMaskFit(
  camera: FramableCamera,
  viewportWidth: number,
  viewportHeight: number,
  fit: number,
): () => void {
  if (!Number.isFinite(fit) || fit >= 1 || fit <= 0) return () => {}
  if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight)) return () => {}
  if (viewportWidth <= 0 || viewportHeight <= 0) return () => {}

  const restore = suspendViewOffset(camera)

  // Uma janela "virtual" `fit` vezes menor da qual a janela real é um recorte
  // maior e centrado: o resultado é a projeção inteira escalada por 1/fit, em
  // ambos os eixos, sem tocar em `fov` nem em `zoom`.
  camera.setViewOffset(
    viewportWidth * fit,
    viewportHeight * fit,
    (-viewportWidth * (1 - fit)) / 2,
    (-viewportHeight * (1 - fit)) / 2,
    viewportWidth,
    viewportHeight,
  )

  return restore
}

/**
 * Tira o deslocamento de vista da câmera e devolve o restaurador — usado pela
 * máscara e, na exportação, por `applyOutputAspect`: o arquivo tem de sair sem
 * o afastamento, ou gravaria as próprias barras da máscara.
 */
export function suspendViewOffset(camera: FramableCamera): () => void {
  const previous = camera.view ? { ...camera.view } : null
  camera.clearViewOffset()

  return () => {
    if (previous?.enabled) {
      camera.setViewOffset(
        previous.fullWidth,
        previous.fullHeight,
        previous.offsetX,
        previous.offsetY,
        previous.width,
        previous.height,
      )
    } else {
      camera.clearViewOffset()
    }
  }
}

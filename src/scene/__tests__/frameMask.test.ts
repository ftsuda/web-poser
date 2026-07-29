import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyFrameMaskFit, fitFrameRect } from '../frameMask'

/**
 * A afirmação que a máscara faz é geométrica: o retângulo claro mostra
 * EXATAMENTE o que a saída (PNG ou MP4) vai conter. Estes testes medem isso —
 * primeiro no retângulo, depois na matriz de projeção da câmera de verdade.
 */

/**
 * Meia-extensão (a 1 m da câmera) do que sobra DENTRO da máscara, dado o
 * afastamento que ela pede. É a conta que o olho faz ao olhar para a tela.
 */
function extentsInsideMask(
  rect: { width: number; height: number; fit: number },
  viewportWidth: number,
  viewportHeight: number,
  fovDeg: number,
) {
  const halfHeightScreen = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) / rect.fit
  const halfWidthScreen = halfHeightScreen * (viewportWidth / viewportHeight)
  return {
    halfHeight: halfHeightScreen * (rect.height / viewportHeight),
    halfWidth: halfWidthScreen * (rect.width / viewportWidth),
  }
}

describe('fitFrameRect', () => {
  it('saída mais LARGA que a janela: barras em cima e embaixo, e a câmera se afasta', () => {
    // Janela 4:3 (1.3333), saída 16:9 (1.7778).
    const rect = fitFrameRect(1200, 900, 1920, 1080)!

    expect(rect.width).toBe(1200)
    expect(rect.height).toBeCloseTo(675, 4) // 1200 / (16/9)
    expect(rect.left).toBe(0)
    expect(rect.top).toBeCloseTo(112.5, 4) // (900 - 675) / 2
    // Sem o afastamento, a parte de cima e de baixo do quadro exportado
    // simplesmente não caberiam na janela.
    expect(rect.fit).toBeCloseTo(0.75, 6) // (4/3) / (16/9)
  })

  it('saída mais ESTREITA que a janela: barras laterais, sem afastar nada', () => {
    // Janela 16:9, saída quadrada.
    const rect = fitFrameRect(1600, 900, 1080, 1080)!

    expect(rect.height).toBe(900)
    expect(rect.width).toBeCloseTo(900, 4)
    expect(rect.top).toBe(0)
    expect(rect.left).toBeCloseTo(350, 4)
    // A janela já mostra tudo o que a saída mostra, e mais um pouco dos lados:
    // basta cobrir a sobra.
    expect(rect.fit).toBe(1)
  })

  it('mesma proporção: o retângulo é a janela inteira', () => {
    const rect = fitFrameRect(1600, 900, 1920, 1080)!

    expect(rect).toEqual({ width: 1600, height: 900, left: 0, top: 0, fit: 1 })
  })

  it('o retângulo fica centrado nos dois eixos', () => {
    for (const [w, h] of [
      [1200, 900],
      [800, 1000],
      [1600, 400],
    ]) {
      const rect = fitFrameRect(w, h, 1920, 1080)!
      expect(rect.left * 2 + rect.width).toBeCloseTo(w, 3)
      expect(rect.top * 2 + rect.height).toBeCloseTo(h, 3)
    }
  })

  it('devolve null para tamanhos que não formam um retângulo', () => {
    expect(fitFrameRect(0, 900, 1920, 1080)).toBeNull()
    expect(fitFrameRect(1600, 0, 1920, 1080)).toBeNull()
    expect(fitFrameRect(1600, 900, 0, 1080)).toBeNull()
    expect(fitFrameRect(1600, 900, 1920, 0)).toBeNull()
    expect(fitFrameRect(Number.NaN, 900, 1920, 1080)).toBeNull()
    expect(fitFrameRect(1600, 900, 1920, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('o que sobra dentro da máscara tem a proporção da SAÍDA, não a da janela', () => {
    const casos: Array<[number, number, number, number]> = [
      [1200, 900, 1920, 1080], // saída mais larga
      [1600, 900, 1080, 1080], // saída mais estreita
      [900, 1200, 3840, 2160], // janela em pé
      [1600, 900, 1600, 900], // iguais
    ]

    for (const [vw, vh, ow, oh] of casos) {
      const rect = fitFrameRect(vw, vh, ow, oh)!
      const { halfWidth, halfHeight } = extentsInsideMask(rect, vw, vh, 50)

      // A altura vista dentro da máscara é a do campo de visão da câmera —
      // é exatamente o que `applyOutputAspect` preserva na exportação.
      expect(halfHeight).toBeCloseTo(Math.tan(THREE.MathUtils.degToRad(25)), 6)
      // E a largura acompanha a proporção da SAÍDA.
      expect(halfWidth / halfHeight).toBeCloseTo(ow / oh, 6)
    }
  })
})

describe('applyFrameMaskFit', () => {
  /** Onde um ponto do mundo cai na tela, em NDC (-1 a 1 = as bordas da janela). */
  function projectNdc(camera: THREE.Camera, point: [number, number, number]) {
    const projected = new THREE.Vector3(...point).project(camera)
    return { x: projected.x, y: projected.y }
  }

  it('põe a borda do quadro exportado exatamente na borda da máscara (perspectiva)', () => {
    const viewportWidth = 1200
    const viewportHeight = 900
    const fov = 50
    const camera = new THREE.PerspectiveCamera(fov, viewportWidth / viewportHeight, 0.1, 100)
    camera.updateMatrixWorld()

    const rect = fitFrameRect(viewportWidth, viewportHeight, 1920, 1080)!
    const restore = applyFrameMaskFit(camera, viewportWidth, viewportHeight, rect.fit)

    // Cantos do quadro que a exportação vai gravar, a 1 m da câmera: a altura
    // é a do fov e a largura acompanha a proporção 16:9.
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov / 2))
    const halfWidth = halfHeight * (1920 / 1080)

    const direita = projectNdc(camera, [halfWidth, 0, -1])
    const topo = projectNdc(camera, [0, halfHeight, -1])

    // A máscara ocupa esta fração da janela — e é aí que o quadro termina.
    expect(direita.x).toBeCloseTo(rect.width / viewportWidth, 5)
    expect(topo.y).toBeCloseTo(rect.height / viewportHeight, 5)

    restore()

    // Restaurado, a borda do quadro exportado volta a cair fora da janela
    // (16:9 é mais largo que a janela 4:3).
    expect(projectNdc(camera, [halfWidth, 0, -1]).x).toBeGreaterThan(1)
    expect(camera.view?.enabled).toBe(false)
  })

  it('afasta a câmera ortográfica na mesma proporção, sem mexer no zoom dela', () => {
    const camera = new THREE.OrthographicCamera(-2, 2, 1.5, -1.5, 0.1, 100)
    camera.zoom = 3
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    const antes = projectNdc(camera, [1, 0, -1]).x
    const restore = applyFrameMaskFit(camera, 1200, 900, 0.75)

    // Afastar por 0,75 encolhe o que se vê na tela pelo mesmo fator.
    expect(projectNdc(camera, [1, 0, -1]).x).toBeCloseTo(antes * 0.75, 6)
    // O zoom continua sendo o da projeção ortográfica (`CameraRig`), intocado.
    expect(camera.zoom).toBe(3)

    restore()
    expect(projectNdc(camera, [1, 0, -1]).x).toBeCloseTo(antes, 6)
  })

  it('afastamento 1 não mexe na projeção', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100)
    camera.updateMatrixWorld()
    const antes = camera.projectionMatrix.clone()

    const restore = applyFrameMaskFit(camera, 1600, 900, 1)

    expect(camera.projectionMatrix.elements).toEqual(antes.elements)
    restore()
  })

  it('devolve a câmera ao deslocamento de vista que ela já tinha', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100)
    camera.setViewOffset(1600, 900, 100, 50, 800, 450)
    const antes = camera.projectionMatrix.clone()

    const restore = applyFrameMaskFit(camera, 1600, 900, 0.5)
    expect(camera.projectionMatrix.elements).not.toEqual(antes.elements)

    restore()
    expect(camera.view?.enabled).toBe(true)
    expect(camera.projectionMatrix.elements).toEqual(antes.elements)
  })
})

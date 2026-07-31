import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import {
  hideOverlays,
  hideSceneOverlays,
  muteJointHighlight,
  renderAtResolution,
  applyOutputAspect,
  revealEditorHidden,
} from '../sceneCapture'
import { EDITOR_HIDDEN_FLAG, OVERLAY_NAMES } from '../constants'
import { applyFrameMaskFit, fitFrameRect } from '../frameMask'

function cenaComOverlays() {
  const scene = new THREE.Scene()

  const grade = new THREE.Object3D()
  grade.name = OVERLAY_NAMES.grid
  const regua = new THREE.Object3D()
  regua.name = OVERLAY_NAMES.verticalRuler
  const reguaOculta = new THREE.Object3D()
  reguaOculta.name = OVERLAY_NAMES.gridAlignment
  reguaOculta.visible = false

  const gizmo = new THREE.Object3D()
  ;(gizmo as unknown as { isTransformControlsGizmo: boolean }).isTransformControlsGizmo = true

  const boneco = new THREE.Object3D()
  boneco.name = 'figure-1'

  scene.add(grade, regua, reguaOculta, gizmo, boneco)
  return { scene, grade, regua, reguaOculta, gizmo, boneco }
}

describe('hideOverlays', () => {
  it('esconde grade, régua, indicador e gizmos — e não o boneco', () => {
    const { scene, grade, regua, gizmo, boneco } = cenaComOverlays()

    hideOverlays(scene)

    expect(grade.visible).toBe(false)
    expect(regua.visible).toBe(false)
    expect(gizmo.visible).toBe(false)
    expect(boneco.visible).toBe(true)
  })

  it('restaura só o que ESTAVA visível — não acende um overlay que o usuário desligou', () => {
    const { scene, grade, reguaOculta } = cenaComOverlays()

    hideOverlays(scene)()

    expect(grade.visible).toBe(true)
    expect(reguaOculta.visible).toBe(false)
  })
})

/**
 * O destaque da junta selecionada é cor de material, não objeto nomeado — por
 * isso escapava do passe de overlays e saía no PNG (DECISOES.md #52).
 */
describe('muteJointHighlight', () => {
  function cenaComDestaque() {
    const scene = new THREE.Scene()
    const destacada = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ emissive: '#ffe066', emissiveIntensity: 0.6 }),
    )
    const comum = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ emissiveIntensity: 0 }))
    scene.add(destacada, comum)
    return { scene, destacada, comum }
  }

  it('apaga o destaque da junta selecionada', () => {
    const { scene, destacada } = cenaComDestaque()

    muteJointHighlight(scene)

    expect((destacada.material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0)
  })

  it('restaura a intensidade exata que estava lá', () => {
    const { scene, destacada } = cenaComDestaque()

    muteJointHighlight(scene)()

    expect((destacada.material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0.6)
  })

  it('não mexe na COR emissiva, só na intensidade', () => {
    const { scene, destacada } = cenaComDestaque()
    const material = destacada.material as THREE.MeshStandardMaterial
    const cor = material.emissive.getHex()

    muteJointHighlight(scene)

    expect(material.emissive.getHex()).toBe(cor)
  })
})

describe('hideSceneOverlays', () => {
  it('esconde apoios de tela E destaque de uma vez, e devolve tudo no lugar', () => {
    const scene = new THREE.Scene()
    const grade = new THREE.Object3D()
    grade.name = OVERLAY_NAMES.grid
    const destacada = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ emissiveIntensity: 0.6 }),
    )
    scene.add(grade, destacada)

    const restore = hideSceneOverlays(scene)
    expect(grade.visible).toBe(false)
    expect((destacada.material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0)

    restore()
    expect(grade.visible).toBe(true)
    expect((destacada.material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0.6)
  })
})

describe('applyOutputAspect', () => {
  it('põe a câmera na proporção da SAÍDA e devolve a da janela depois', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100)

    const restore = applyOutputAspect(camera, 1080, 1080)
    expect(camera.aspect).toBe(1)

    restore()
    expect(camera.aspect).toBeCloseTo(16 / 9, 9)
  })

  it('na ortográfica, ajusta a moldura e restaura os quatro lados', () => {
    const camera = new THREE.OrthographicCamera(-100, 100, 50, -50, 0.1, 100)

    const restore = applyOutputAspect(camera, 1920, 1080)
    expect(camera.right).toBe(960)
    expect(camera.top).toBe(540)

    restore()
    expect(camera.right).toBe(100)
    expect(camera.top).toBe(50)
  })

  // A máscara de enquadramento afasta a câmera por `setViewOffset`. Se esse
  // afastamento sobrevivesse à captura, o arquivo sairia com as barras da
  // própria máscara desenhadas nele.
  it('suspende o afastamento da máscara durante a captura e o devolve depois', () => {
    const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 100)
    const fit = fitFrameRect(1200, 900, 1920, 1080)!.fit
    applyFrameMaskFit(camera, 1200, 900, fit)
    const comMascara = camera.projectionMatrix.clone()

    const restore = applyOutputAspect(camera, 1920, 1080)
    expect(camera.view?.enabled).toBe(false)

    // O que a captura enxerga é a projeção limpa da proporção de saída.
    const limpa = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100)
    expect(camera.projectionMatrix.elements).toEqual(limpa.projectionMatrix.elements)

    restore()
    expect(camera.view?.enabled).toBe(true)
    expect(camera.projectionMatrix.elements).toEqual(comMascara.elements)
  })
})

describe('renderAtResolution', () => {
  function rendererFalso() {
    let width = 800
    let height = 600
    let pixelRatio = 2
    const chamadas: string[] = []
    return {
      chamadas,
      get tamanho() {
        return [width, height] as const
      },
      get pixelRatio() {
        return pixelRatio
      },
      gl: {
        getSize: (target: THREE.Vector2) => target.set(width, height),
        getPixelRatio: () => pixelRatio,
        setPixelRatio: (ratio: number) => {
          pixelRatio = ratio
          chamadas.push(`pixelRatio:${ratio}`)
        },
        setSize: (w: number, h: number) => {
          width = w
          height = h
          chamadas.push(`size:${w}x${h}`)
        },
        render: () => chamadas.push('render'),
      },
    }
  }

  it('renderiza na resolução pedida e consome o quadro ANTES de restaurar', () => {
    const falso = rendererFalso()
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const consume = vi.fn(() => falso.chamadas.push('consume'))

    renderAtResolution(falso.gl, scene, camera, 1920, 1080, consume)

    // A ordem é o contrato: sem `preserveDrawingBuffer`, ler depois de
    // restaurar o tamanho devolveria um quadro vazio.
    expect(falso.chamadas).toEqual([
      'pixelRatio:1',
      'size:1920x1080',
      'render',
      'consume',
      'pixelRatio:2',
      'size:800x600',
    ])
    expect(consume).toHaveBeenCalledOnce()
  })

  it('devolve tamanho, densidade e proporção como estavam', () => {
    const falso = rendererFalso()
    const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 100)

    renderAtResolution(falso.gl, new THREE.Scene(), camera, 1920, 1080, () => {})

    expect(falso.tamanho).toEqual([800, 600])
    expect(falso.pixelRatio).toBe(2)
    expect(camera.aspect).toBeCloseTo(4 / 3, 9)
  })
})


/**
 * O passe SIMÉTRICO ao `hideOverlays` (item 42): o cenário que o usuário tirou
 * da frente para posar tem de reaparecer na captura. Se isto quebrar, um
 * objeto escondido na bancada some do PNG e do MP4 — que é o oposto do que a
 * opção promete.
 */
describe('revealEditorHidden', () => {
  function cenaComObjetoOcultoNaBancada() {
    const scene = new THREE.Scene()

    const cenario = new THREE.Object3D()
    cenario.name = 'prop-prop-1'
    cenario.visible = false
    cenario.userData = { [EDITOR_HIDDEN_FLAG]: true }

    // Objeto DESLIGADO de verdade: sem a marca, continua fora da imagem.
    const desligado = new THREE.Object3D()
    desligado.name = 'prop-prop-2'
    desligado.visible = false

    scene.add(cenario, desligado)
    return { scene, cenario, desligado }
  }

  it('acende o objeto escondido só da bancada e o apaga de volta', () => {
    const { scene, cenario } = cenaComObjetoOcultoNaBancada()

    const restore = revealEditorHidden(scene)
    expect(cenario.visible).toBe(true)

    restore()
    expect(cenario.visible).toBe(false)
  })

  it('não acende objeto que o usuário desligou de verdade', () => {
    const { scene, desligado } = cenaComObjetoOcultoNaBancada()

    revealEditorHidden(scene)
    expect(desligado.visible).toBe(false)
  })

  it('NÃO faz parte do `hideSceneOverlays` — reacender não é opção de captura', () => {
    // A opção "ocultar grade/gizmos" pode estar desligada, e ainda assim o
    // cenário precisa sair na foto: por isso os dois passes são chamados lado
    // a lado, e não um dentro do outro (ver `SnapshotCapture.tsx`).
    const { scene, cenario } = cenaComObjetoOcultoNaBancada()

    hideSceneOverlays(scene)
    expect(cenario.visible).toBe(false)
  })
})

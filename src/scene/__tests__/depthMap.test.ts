import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  DEPTH_BACKGROUND,
  MIN_DEPTH_NEAR,
  MIN_DEPTH_SPAN,
  applyDepthMaterial,
  applyDepthMaterials,
  applyDepthPass,
  attachDepthMaterials,
  computeDepthRange,
  createDepthMaterials,
  depthContentBox,
  depthRangeFromBox,
  isDepthContent,
  resolveDepthRange,
  restoreDepthMaterials,
  sanitizeDepthRange,
  suspendDepthMaterial,
  updateDepthMaterials,
} from '../depthMap'

/**
 * Fase 13 — mapa de profundidade. O que dá para testar sem GPU é justamente o
 * que decide se a imagem sai utilizável: a FAIXA (perto/longe) e o que entra
 * ou sai do passe. O shader em si e o pixel na tela ficam para a conferência
 * visual, como a captura de PNG desde a fase 5.
 */

function cubo(name: string, position: [number, number, number] = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: '#ffffff' }),
  )
  mesh.name = name
  mesh.position.set(...position)
  return mesh
}

describe('isDepthContent', () => {
  it('reconhece boneco e objeto de cena como conteúdo', () => {
    expect(isDepthContent(cubo('figure-f1'))).toBe(true)
    expect(isDepthContent(cubo('prop-p1'))).toBe(true)
  })

  it('NÃO conta o chão nem a elipse de contato — os dois distorceriam a faixa', () => {
    expect(isDepthContent(cubo('ground'))).toBe(false)
    expect(isDepthContent(cubo('figure-shadow-f1'))).toBe(false)
  })
})

describe('depthContentBox', () => {
  function cena() {
    const scene = new THREE.Scene()
    const boneco = cubo('figure-f1', [0, 0, -4])
    const objeto = cubo('prop-p1', [0, 0, -8])
    const chao = cubo('ground', [0, 0, -50])
    const elipse = cubo('figure-shadow-f1', [0, 0, -60])
    scene.add(boneco, objeto, chao, elipse)
    return { scene, boneco, objeto }
  }

  it('envolve bonecos e objetos, e ignora chão e elipse', () => {
    const box = depthContentBox(cena().scene)!

    expect(box.min.z).toBeCloseTo(-9, 6)
    expect(box.max.z).toBeCloseTo(-3, 6)
  })

  it('ignora quem está invisível — boneco oculto não estica a faixa', () => {
    const { scene, objeto } = cena()
    objeto.visible = false

    const box = depthContentBox(scene)!

    expect(box.min.z).toBeCloseTo(-5, 6)
  })

  it('devolve `null` quando não há conteúdo nenhum', () => {
    const scene = new THREE.Scene()
    scene.add(cubo('ground'))

    expect(depthContentBox(scene)).toBeNull()
  })
})

describe('depthRangeFromBox', () => {
  it('mede a distância NO EIXO DA CÂMERA, do mais perto ao mais longe', () => {
    // Câmera na origem olhando para -Z (o padrão do three).
    const camera = new THREE.PerspectiveCamera()
    const box = new THREE.Box3(new THREE.Vector3(-1, -1, -5), new THREE.Vector3(1, 1, -3))

    const range = depthRangeFromBox(box, camera)

    expect(range.near).toBeCloseTo(3, 6)
    expect(range.far).toBeCloseTo(5, 6)
  })

  it('acompanha a câmera quando ela se move e vira', () => {
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 0, 5)
    camera.lookAt(0, 0, 0)
    const box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))

    const range = depthRangeFromBox(box, camera)

    expect(range.near).toBeCloseTo(4, 6)
    expect(range.far).toBeCloseTo(6, 6)
  })

  // Sem folga de propósito: a superfície mais próxima sai branca e a mais
  // distante preta, usando os 256 níveis inteiros.
  it('não deixa o perto ir a zero nem a faixa degenerar', () => {
    const camera = new THREE.PerspectiveCamera()
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0))

    const range = depthRangeFromBox(box, camera)

    expect(range.near).toBe(MIN_DEPTH_NEAR)
    expect(range.far).toBeGreaterThanOrEqual(range.near + MIN_DEPTH_SPAN)
  })
})

describe('computeDepthRange', () => {
  it('sai da cena inteira, pelo conteúdo visível', () => {
    const scene = new THREE.Scene()
    scene.add(cubo('figure-f1', [0, 0, -4]))
    const camera = new THREE.PerspectiveCamera()

    const range = computeDepthRange(scene, camera)!

    expect(range.near).toBeCloseTo(3, 6)
    expect(range.far).toBeCloseTo(5, 6)
  })

  it('sem conteúdo, devolve `null` em vez de inventar uma faixa', () => {
    expect(computeDepthRange(new THREE.Scene(), new THREE.PerspectiveCamera())).toBeNull()
  })
})

describe('sanitizeDepthRange', () => {
  it('grampeia o perto e garante um vão mínimo até o longe', () => {
    expect(sanitizeDepthRange(-3, 2)).toEqual({ near: MIN_DEPTH_NEAR, far: 2 })
    expect(sanitizeDepthRange(5, 5)).toEqual({ near: 5, far: 5 + MIN_DEPTH_SPAN })
    expect(sanitizeDepthRange(8, 2)).toEqual({ near: 8, far: 8 + MIN_DEPTH_SPAN })
  })

  it('não deixa passar número inválido — um campo vazio no painel viraria NaN', () => {
    expect(sanitizeDepthRange(Number.NaN, Number.NaN)).toEqual({
      near: MIN_DEPTH_NEAR,
      far: MIN_DEPTH_NEAR + MIN_DEPTH_SPAN,
    })
  })
})

describe('resolveDepthRange', () => {
  function cenaComBoneco() {
    const scene = new THREE.Scene()
    scene.add(cubo('figure-f1', [0, 0, -4]))
    return scene
  }

  it('automática: mede o conteúdo visível', () => {
    const range = resolveDepthRange(cenaComBoneco(), new THREE.PerspectiveCamera(), {
      autoRange: true,
      nearM: 2,
      farM: 6,
    })

    expect(range.near).toBeCloseTo(3, 6)
  })

  it('travada: usa os números do painel e ignora o conteúdo', () => {
    const range = resolveDepthRange(cenaComBoneco(), new THREE.PerspectiveCamera(), {
      autoRange: false,
      nearM: 2,
      farM: 6,
    })

    expect(range).toEqual({ near: 2, far: 6 })
  })

  // Cena vazia com faixa automática não pode gerar uma imagem preta: cai nos
  // números do painel, que é o que o usuário vê escrito lá.
  it('automática sem conteúdo cai na faixa do painel', () => {
    const range = resolveDepthRange(new THREE.Scene(), new THREE.PerspectiveCamera(), {
      autoRange: true,
      nearM: 2,
      farM: 6,
    })

    expect(range).toEqual({ near: 2, far: 6 })
  })
})

describe('createDepthMaterials', () => {
  it('carrega a faixa nos dois materiais, e `updateDepthMaterials` a troca sem recompilar', () => {
    const materials = createDepthMaterials({ near: 2, far: 6 })
    expect(materials.content.uniforms.depthNear.value).toBe(2)
    expect(materials.ground.uniforms.depthFar.value).toBe(6)

    updateDepthMaterials(materials, { near: 1, far: 3 })
    expect(materials.content.uniforms.depthNear.value).toBe(1)
    expect(materials.ground.uniforms.depthNear.value).toBe(1)
  })

  /**
   * O recorte é a diferença inteira entre os dois. O CONTEÚDO nunca recorta:
   * com uma faixa travada mais curta que o boneco, ele tem de clarear ou
   * escurecer nas pontas, nunca sumir.
   */
  it('só o material do CHÃO recorta fora da faixa', () => {
    const materials = createDepthMaterials({ near: 1, far: 2 })

    expect(materials.content.uniforms.clipOutside.value).toBe(0)
    expect(materials.ground.uniforms.clipOutside.value).toBe(1)
  })

  // O plano de cena é uma folha sem espessura: de um lado ele sumiria do mapa.
  it('desenha os dois lados', () => {
    expect(createDepthMaterials({ near: 1, far: 2 }).content.side).toBe(THREE.DoubleSide)
  })
})

/** Uma cena com os três papéis que o passe distingue. */
function cenaViva() {
  const scene = new THREE.Scene()
  const fundo = new THREE.Color('#808080')
  scene.background = fundo
  const boneco = cubo('figure-f1')
  const chao = cubo('ground')
  const elipse = cubo('figure-shadow-f1')
  const materialDoBoneco = boneco.material
  const materialDoChao = chao.material
  scene.add(boneco, chao, elipse)
  return { scene, fundo, boneco, chao, elipse, materialDoBoneco, materialDoChao }
}

describe('applyDepthMaterials — o chão', () => {
  /**
   * O conflito que o usuário apontou: a faixa é medida só pelos bonecos, então
   * o chão em primeiro plano cai fora dela e, grampeado, vira uma cunha branca
   * chapada na metade de baixo do quadro — no mesmo branco que deveria ser da
   * superfície mais próxima do boneco.
   */
  it('`clipped` (padrão) dá ao chão o material que RECORTA, e ao resto o que grampeia', () => {
    const { scene, boneco, chao } = cenaViva()
    const materials = createDepthMaterials({ near: 1, far: 5 })

    applyDepthMaterials(scene, materials, 'clipped')

    expect(chao.material).toBe(materials.ground)
    expect(boneco.material).toBe(materials.content)
  })

  it('`hidden` apaga o chão, como a elipse de contato', () => {
    const { scene, boneco, chao } = cenaViva()

    applyDepthMaterials(scene, createDepthMaterials({ near: 1, far: 5 }), 'hidden')

    expect(chao.visible).toBe(false)
    expect(boneco.visible).toBe(true)
  })

  it('`full` trata o chão como todo o resto — o comportamento anterior', () => {
    const { scene, chao } = cenaViva()
    const materials = createDepthMaterials({ near: 1, far: 5 })

    applyDepthMaterials(scene, materials, 'full')

    expect(chao.material).toBe(materials.content)
    expect(chao.visible).toBe(true)
  })

  it('a elipse de contato some nos três modos — é regra do modo, não opção', () => {
    for (const mode of ['clipped', 'hidden', 'full'] as const) {
      const { scene, elipse } = cenaViva()
      applyDepthMaterials(scene, createDepthMaterials({ near: 1, far: 5 }), mode)
      expect(elipse.visible).toBe(false)
    }
  })

  /**
   * A vista na tela reaplica a cada quadro, para alcançar um boneco criado
   * depois. Sem a guarda da marca, a segunda passada gravaria o MATERIAL DE
   * PROFUNDIDADE como "original" e a restauração não devolveria nada.
   */
  it('é idempotente: aplicar duas vezes não perde o material original', () => {
    const { scene, boneco, materialDoBoneco } = cenaViva()
    const materials = createDepthMaterials({ near: 1, far: 5 })

    applyDepthMaterials(scene, materials, 'clipped')
    applyDepthMaterials(scene, materials, 'clipped')
    restoreDepthMaterials(scene)

    expect(boneco.material).toBe(materialDoBoneco)
  })
})

describe('attachDepthMaterials', () => {
  it('devolve material, visibilidade e as marcas de `userData` como estavam', () => {
    const { scene, boneco, chao, elipse, materialDoBoneco, materialDoChao } = cenaViva()

    attachDepthMaterials(scene, createDepthMaterials({ near: 1, far: 5 }), 'hidden')()

    expect(boneco.material).toBe(materialDoBoneco)
    expect(chao.material).toBe(materialDoChao)
    expect(chao.visible).toBe(true)
    expect(elipse.visible).toBe(true)
    expect(boneco.userData.depthOriginalMaterial).toBeUndefined()
    expect(chao.userData.depthHidden).toBeUndefined()
  })

  // Quem cuida do fundo na TELA é o `Viewport`, por React: dois donos para a
  // mesma propriedade fariam a vista ficar presa no preto ao desligar o modo.
  it('não mexe no fundo — esse é do Viewport', () => {
    const { scene, fundo } = cenaViva()

    attachDepthMaterials(scene, createDepthMaterials({ near: 1, far: 5 }))

    expect(scene.background).toBe(fundo)
  })
})

describe('applyDepthPass', () => {
  // É a forma que a exportação de vídeo usa: um par de materiais para centenas
  // de quadros, trocando apenas os uniformes da faixa.
  it('reaproveita os materiais recebidos e ainda assim escurece o fundo', () => {
    const { scene, chao } = cenaViva()
    const materials = createDepthMaterials({ near: 1, far: 5 })

    const restore = applyDepthPass(scene, materials, 'clipped')
    expect(chao.material).toBe(materials.ground)
    expect((scene.background as THREE.Color).getHexString()).toBe('000000')

    restore()
    // Não descarta os materiais: quem os criou é que os descarta, no fim do laço.
    expect(materials.content.uniforms.depthNear.value).toBe(1)
    expect((scene.background as THREE.Color).getHexString()).toBe('808080')
  })
})

describe('applyDepthMaterial', () => {
  it('na SAÍDA, o fundo vai a preto e volta exatamente ao que era', () => {
    const { scene, fundo, boneco, materialDoBoneco } = cenaViva()

    const restore = applyDepthMaterial(scene, { near: 2, far: 6 })
    expect((scene.background as THREE.Color).getHexString()).toBe(
      new THREE.Color(DEPTH_BACKGROUND).getHexString(),
    )
    expect(boneco.material).not.toBe(materialDoBoneco)

    restore()
    expect(scene.background).toBe(fundo)
    expect(boneco.material).toBe(materialDoBoneco)
  })
})

describe('suspendDepthMaterial', () => {
  /**
   * A saída normal não pode herdar a visualização de tela: as três escolhas são
   * independentes (decisão do usuário na fase 13). Ver profundidade na tela e
   * capturar um PNG normal tem de dar um PNG normal — com elipse, chão inteiro
   * e fundo do ambiente.
   */
  it('desfaz a visualização de profundidade durante uma saída normal', () => {
    const { scene, boneco, chao, elipse, materialDoBoneco, materialDoChao } = cenaViva()
    attachDepthMaterials(scene, createDepthMaterials({ near: 1, far: 5 }), 'hidden')

    const restore = suspendDepthMaterial(scene, '#808080')
    expect(boneco.material).toBe(materialDoBoneco)
    expect(chao.material).toBe(materialDoChao)
    expect(chao.visible).toBe(true)
    expect(elipse.visible).toBe(true)
    expect((scene.background as THREE.Color).getHexString()).toBe('808080')

    // E recompõe exatamente o que estava: a tela continua em profundidade.
    restore()
    expect(boneco.material).not.toBe(materialDoBoneco)
    expect(chao.visible).toBe(false)
    expect(elipse.visible).toBe(false)
  })

  it('sem nada ligado, é inofensiva — e é por isso que a captura sempre a chama', () => {
    const { scene, boneco, chao, materialDoBoneco, materialDoChao } = cenaViva()

    suspendDepthMaterial(scene, '#808080')()

    expect(boneco.material).toBe(materialDoBoneco)
    expect(chao.material).toBe(materialDoChao)
    expect(chao.visible).toBe(true)
  })
})


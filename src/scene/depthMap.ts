import * as THREE from 'three'
import { GROUND_NAME } from './constants'
import type { RestoreScene } from './sceneCapture'

/**
 * **Mapa de profundidade (fase 13).** Uma forma alternativa de ver e de
 * exportar a mesma cena: perto claro, longe escuro. Nada do que já existia
 * muda de comportamento — o modo normal continua sendo o modo normal, e a
 * profundidade é uma escolha por saída (tela, PNG e MP4, independentes).
 *
 * **Rota B, decidida pelo usuário:** um `ShaderMaterial` próprio com a
 * distância LINEAR em espaço de vista, e não o `MeshDepthMaterial` do three. O
 * material nativo emite `1 - fragCoordZ`, que segue a distribuição em `1/z` da
 * projeção em perspectiva: com `near 0,1 / far 100` o boneco inteiro ocuparia
 * cerca de três níveis de 256, e mesmo com a faixa apertada o primeiro metro
 * comeria metade da escala. A rampa reta é o que ferramentas de fora
 * (ControlNet, compositing, relighting) esperam encontrar.
 *
 * **O cinza no arquivo é o dado.** O shader não inclui `<tonemapping_fragment>`
 * nem `<colorspace_fragment>`, então o valor escrito é exatamente
 * `1 - (d - perto) / (longe - perto)`, sem gama por cima. O teto é o PNG de 8
 * bits por canal (256 níveis) — irrelevante para leitura visual, e o limite
 * para quem quantiza de novo.
 *
 * O que é testável sem GPU mora aqui e está testado: a faixa, o que entra no
 * passe e a restauração exata. O pixel na tela é conferência visual, como a
 * captura de PNG desde a fase 5.
 */

/** Perto e longe, em metros, medidos no eixo de visão da câmera. */
export interface DepthRange {
  near: number
  far: number
}

/** Faixa do painel enquanto a automática não tem o que medir. */
export const DEFAULT_DEPTH_RANGE: DepthRange = { near: 2, far: 6 }

/** Distância mínima aceita para o "perto" — zero achataria a rampa inteira. */
export const MIN_DEPTH_NEAR = 0.01

/** Vão mínimo entre perto e longe, para a divisão do shader nunca degenerar. */
export const MIN_DEPTH_SPAN = 0.01

/**
 * O fundo durante o passe de profundidade. O cinza do ambiente continuaria
 * sendo desenhado e leria como distância média; preto é "infinitamente longe",
 * que é o que o fundo de fato é.
 */
export const DEPTH_BACKGROUND = '#000000'

/** Prefixo do nó de boneco e do de objeto de cena (ver `Figure.tsx` e `SceneProps.tsx`). */
const FIGURE_PREFIX = 'figure-'
const FIGURE_SHADOW_PREFIX = 'figure-shadow-'
const PROP_PREFIX = 'prop-'

/**
 * O que conta como CONTEÚDO para medir a faixa: bonecos e objetos de cena.
 *
 * O chão fica de fora de propósito (decisão do usuário): ele é desenhado no
 * mapa — dá contato e leitura de volume —, mas um plano de 20 m entrando na
 * conta viraria uma rampa gigante que espremeria o boneco em poucos níveis de
 * cinza. A elipse de contato também fica de fora, e por dois motivos: não é
 * volume, e nem sequer é desenhada no passe.
 */
export function isDepthContent(object: THREE.Object3D): boolean {
  const { name } = object
  if (name.startsWith(FIGURE_SHADOW_PREFIX)) return false
  return name.startsWith(FIGURE_PREFIX) || name.startsWith(PROP_PREFIX)
}

/** Soma na caixa a geometria de `object` e a de seus filhos VISÍVEIS. */
function expandByVisible(box: THREE.Box3, object: THREE.Object3D): void {
  if (!object.visible) return

  object.updateWorldMatrix(false, false)
  const geometry = (object as THREE.Mesh).geometry
  if (geometry) {
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    if (geometry.boundingBox) {
      box.union(geometry.boundingBox.clone().applyMatrix4(object.matrixWorld))
    }
  }

  for (const child of object.children) expandByVisible(box, child)
}

/**
 * Caixa envolvente do conteúdo visível, em coordenadas de mundo; `null` quando
 * não há nenhum boneco nem objeto na cena.
 *
 * Não usa `Box3.setFromObject` porque ele **ignora a visibilidade**: um boneco
 * desligado no painel continuaria esticando a faixa, e a imagem se
 * renormalizaria por causa de algo que nem aparece nela.
 */
export function depthContentBox(scene: THREE.Object3D): THREE.Box3 | null {
  const box = new THREE.Box3().makeEmpty()

  const visit = (object: THREE.Object3D) => {
    if (!object.visible) return
    if (isDepthContent(object)) {
      expandByVisible(box, object)
      return
    }
    for (const child of object.children) visit(child)
  }

  scene.updateMatrixWorld(true)
  visit(scene)

  return box.isEmpty() ? null : box
}

/**
 * Perto e longe a partir da caixa, medidos **no eixo de visão da câmera** — a
 * mesma grandeza que o shader escreve (`-viewPosition.z`), e não a distância
 * euclidiana ao olho.
 *
 * Sem folga nenhuma: a superfície mais próxima sai branca e a mais distante,
 * preta. É o que usa os 256 níveis inteiros, que é justamente o que faltava com
 * o `near 0,1 / far 100` da câmera.
 */
export function depthRangeFromBox(box: THREE.Box3, camera: THREE.Camera): DepthRange {
  // A matriz de vista é normalmente mantida pelo renderizador, e aqui a conta
  // acontece ANTES de renderizar — inclusive sobre câmeras descartáveis
  // montadas quadro a quadro pela exportação de vídeo.
  camera.updateMatrixWorld()
  const view = new THREE.Matrix4().copy(camera.matrixWorld).invert()

  let near = Number.POSITIVE_INFINITY
  let far = Number.NEGATIVE_INFINITY

  const corner = new THREE.Vector3()
  for (let i = 0; i < 8; i += 1) {
    corner.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    )
    const depth = -corner.applyMatrix4(view).z
    near = Math.min(near, depth)
    far = Math.max(far, depth)
  }

  return sanitizeDepthRange(near, far)
}

/** Faixa válida a partir de dois números quaisquer — inclusive de um campo de painel vazio. */
export function sanitizeDepthRange(near: number, far: number): DepthRange {
  const safeNear = Math.max(MIN_DEPTH_NEAR, Number.isFinite(near) ? near : MIN_DEPTH_NEAR)
  const safeFar = Number.isFinite(far) ? far : safeNear
  return { near: safeNear, far: Math.max(safeFar, safeNear + MIN_DEPTH_SPAN) }
}

/** A faixa automática: o que a cena tem para mostrar, visto de onde a câmera está. */
export function computeDepthRange(scene: THREE.Object3D, camera: THREE.Camera): DepthRange | null {
  const box = depthContentBox(scene)
  return box ? depthRangeFromBox(box, camera) : null
}

/** O que o painel de Cena guarda sobre a faixa (ver `store/depthStore.ts`). */
export interface DepthRangeSettings {
  autoRange: boolean
  nearM: number
  farM: number
}

/**
 * A faixa que vale para uma saída: a medida do conteúdo, ou a travada no
 * painel.
 *
 * A automática é o padrão óbvio e o que dá a melhor imagem de um quadro
 * isolado; a travada é o que dá uma SEQUÊNCIA com escala estável — sem ela,
 * cada quadro se renormaliza e a animação "respira".
 */
export function resolveDepthRange(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  settings: DepthRangeSettings,
): DepthRange {
  const manual = sanitizeDepthRange(settings.nearM, settings.farM)
  if (!settings.autoRange) return manual
  return computeDepthRange(scene, camera) ?? manual
}

/**
 * O que o CHÃO faz no mapa (pedido do usuário logo depois da fase 13, ao ver o
 * conflito com os bonecos).
 *
 * A faixa é medida só pelos bonecos e objetos, então o chão em primeiro plano
 * cai FORA dela — e, grampeado, vira uma cunha branca chapada ocupando a metade
 * de baixo do quadro, no mesmo branco que deveria pertencer à superfície mais
 * próxima do boneco. Com a câmera padrão o chão entra no quadro a ~2,5 m e o
 * boneco está a ~5 m: são dois metros e meio de branco liso antes de a rampa
 * útil começar.
 *
 * - `clipped` (padrão): o chão só é desenhado onde a profundidade dele cai
 *   dentro da faixa. Sobra o "tapete" em volta dos pés, indo de branco a preto,
 *   e a cunha some. O recorte é POR PROFUNDIDADE, não por geometria — a borda
 *   acompanha a distância, e não um retângulo no mundo.
 * - `hidden`: o chão some do mapa, como a elipse de contato. Silhueta limpa
 *   sobre preto, que é o formato que fluxos de composição costumam querer.
 * - `full`: o comportamento anterior, com a rampa inteira e o grampeamento.
 */
export const GROUND_MODES = ['clipped', 'hidden', 'full'] as const

export type GroundMode = (typeof GROUND_MODES)[number]

export const DEFAULT_GROUND_MODE: GroundMode = 'clipped'

const DEPTH_VERTEX_SHADER = /* glsl */ `
  varying float vViewDepth;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    // Distância ao PLANO da câmera, positiva para a frente. É a mesma grandeza
    // que depthRangeFromBox mede, e é o que torna a rampa linear.
    vViewDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`

const DEPTH_FRAGMENT_SHADER = /* glsl */ `
  uniform float depthNear;
  uniform float depthFar;
  uniform float clipOutside;
  varying float vViewDepth;

  void main() {
    float span = max(depthFar - depthNear, ${MIN_DEPTH_SPAN.toFixed(4)});
    float t = (vViewDepth - depthNear) / span;
    // Com o recorte ligado, o que está fora da faixa não é desenhado, em vez de
    // ser grampeado — é o que impede o chão em primeiro plano de virar uma cunha
    // branca. O material do CONTEUDO nunca recorta: uma faixa travada mais curta
    // que o boneco tem de clareá-lo ou escurecê-lo, nunca sumir com ele.
    if (clipOutside > 0.5 && (t < 0.0 || t > 1.0)) discard;
    // Perto = branco, longe = preto — a polaridade que o usuário pediu.
    gl_FragColor = vec4(vec3(1.0 - clamp(t, 0.0, 1.0)), 1.0);
  }
`

/**
 * Os dois materiais do passe — o MESMO shader, diferindo só no recorte. Como o
 * código-fonte é idêntico, o three compila um programa só e o compartilha.
 *
 * Os nomes dos uniformes levam prefixo (`depthNear`, e não `near`) para não
 * esbarrarem em nada que o three injete no shader.
 */
export interface DepthMaterials {
  /** Bonecos, objetos e tudo o mais: grampeia nas pontas, nunca recorta. */
  content: THREE.ShaderMaterial
  /** Só o chão, e só no modo `clipped`: some fora da faixa. */
  ground: THREE.ShaderMaterial
}

function createMaterial(range: DepthRange, clipOutside: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      depthNear: { value: range.near },
      depthFar: { value: range.far },
      clipOutside: { value: clipOutside ? 1 : 0 },
    },
    vertexShader: DEPTH_VERTEX_SHADER,
    fragmentShader: DEPTH_FRAGMENT_SHADER,
    // O plano de cena é uma folha sem espessura: com um lado só, ele
    // desapareceria do mapa quando a câmera passasse para trás dele.
    side: THREE.DoubleSide,
  })
}

export function createDepthMaterials(range: DepthRange): DepthMaterials {
  return { content: createMaterial(range, false), ground: createMaterial(range, true) }
}

/** Troca a faixa sem recompilar o shader — é o que permite atualizar a cada quadro. */
export function updateDepthMaterials(materials: DepthMaterials, range: DepthRange): void {
  for (const material of [materials.content, materials.ground]) {
    material.uniforms.depthNear.value = range.near
    material.uniforms.depthFar.value = range.far
  }
}

export function disposeDepthMaterials(materials: DepthMaterials): void {
  materials.content.dispose()
  materials.ground.dispose()
}

/**
 * Marcas de `userData` deixadas pelo passe.
 *
 * São elas — e não uma lista guardada numa closure — que permitem a QUALQUER
 * passe desfazer o que outro fez. É o que torna as três escolhas independentes
 * de verdade: com a vista em profundidade ligada, uma captura normal precisa
 * devolver os materiais originais sem ter participado da troca, e recompor
 * exatamente o que estava depois (ver `suspendDepthMaterial`).
 *
 * A troca é material a material, e não pelo `scene.overrideMaterial`, porque o
 * chão precisa de um material DIFERENTE do resto — que é a razão de o modo
 * `clipped` existir. O `overrideMaterial` é um só para a cena inteira.
 */
const ORIGINAL_MATERIAL = 'depthOriginalMaterial'
const HIDDEN_BY_DEPTH = 'depthHidden'

type MaterialHolder = THREE.Object3D & { material?: THREE.Material | THREE.Material[] }

function swapMaterial(object: MaterialHolder, material: THREE.Material | THREE.Material[]): void {
  if (object.userData[ORIGINAL_MATERIAL] === undefined) {
    object.userData[ORIGINAL_MATERIAL] = object.material
  }
  object.material = material
}

function hideForDepth(object: THREE.Object3D): void {
  if (!object.visible) return
  object.visible = false
  object.userData[HIDDEN_BY_DEPTH] = true
}

/** Acende de volta só o que ESTE passe apagou — nunca o que já estava apagado. */
function revealFromDepth(object: THREE.Object3D): void {
  if (object.userData[HIDDEN_BY_DEPTH] !== true) return
  object.visible = true
  delete object.userData[HIDDEN_BY_DEPTH]
}

/**
 * Põe a cena viva em modo profundidade, **sem tocar no fundo**. Idempotente:
 * chamar de novo sobre uma cena já trocada não perde o material original, e é
 * assim que a vista na tela alcança um boneco ou um objeto criado depois.
 *
 * O fundo fica de fora de propósito: na tela quem o define é o `Viewport`, por
 * React, e dois donos para a mesma propriedade deixariam a vista presa no preto
 * ao desligar o modo — a ordem entre o commit do R3F e a limpeza do efeito não
 * está sob nosso controle.
 */
export function applyDepthMaterials(
  scene: THREE.Object3D,
  materials: DepthMaterials,
  groundMode: GroundMode = DEFAULT_GROUND_MODE,
): void {
  scene.traverse((object) => {
    // A elipse de contato é `transparent` com `depthWrite` desligado: sob um
    // material de profundidade viraria um disco opaco no chão, mentindo sobre a
    // distância. Some SEMPRE — é regra do modo, e não a opção "ocultar
    // grade/gizmos", que continua valendo para grade, gizmos, régua e cebola.
    if (object.name.startsWith(FIGURE_SHADOW_PREFIX)) {
      hideForDepth(object)
      return
    }

    const holder = object as MaterialHolder
    if (!holder.material) return

    if (object.name === GROUND_NAME) {
      if (groundMode === 'hidden') {
        hideForDepth(object)
        return
      }
      // Trocar de modo com a vista ligada tem de ACENDER o chão de volta: a
      // reaplicação por quadro é o único lugar que vê a troca acontecer.
      revealFromDepth(object)
      swapMaterial(holder, groundMode === 'clipped' ? materials.ground : materials.content)
      return
    }

    swapMaterial(holder, materials.content)
  })
}

/** Devolve material e visibilidade a quem carrega as marcas do passe. */
export function restoreDepthMaterials(scene: THREE.Object3D): void {
  scene.traverse((object) => {
    const holder = object as MaterialHolder
    const original = holder.userData[ORIGINAL_MATERIAL] as THREE.Material | THREE.Material[] | undefined
    if (original !== undefined) {
      holder.material = original
      delete holder.userData[ORIGINAL_MATERIAL]
    }
    revealFromDepth(object)
  })
}

/** `applyDepthMaterials` no molde `RestoreScene` do `sceneCapture.ts`. */
export function attachDepthMaterials(
  scene: THREE.Scene,
  materials: DepthMaterials,
  groundMode: GroundMode = DEFAULT_GROUND_MODE,
): RestoreScene {
  applyDepthMaterials(scene, materials, groundMode)
  return () => restoreDepthMaterials(scene)
}

/**
 * O passe de uma SAÍDA em profundidade com os materiais já prontos: acrescenta
 * o fundo preto ao que o `attachDepthMaterials` faz.
 *
 * É a forma que a exportação de vídeo usa — ela reaproveita os materiais por
 * centenas de quadros, trocando só os uniformes da faixa.
 */
export function applyDepthPass(
  scene: THREE.Scene,
  materials: DepthMaterials,
  groundMode: GroundMode = DEFAULT_GROUND_MODE,
): RestoreScene {
  const previousBackground = scene.background
  const restoreAttach = attachDepthMaterials(scene, materials, groundMode)
  scene.background = new THREE.Color(DEPTH_BACKGROUND)

  return () => {
    scene.background = previousBackground
    restoreAttach()
  }
}

/**
 * O passe completo de uma saída avulsa — o PNG: cria os materiais da faixa, os
 * aplica e os descarta na restauração.
 */
export function applyDepthMaterial(
  scene: THREE.Scene,
  range: DepthRange,
  groundMode: GroundMode = DEFAULT_GROUND_MODE,
): RestoreScene {
  const materials = createDepthMaterials(range)
  const restorePass = applyDepthPass(scene, materials, groundMode)

  return () => {
    restorePass()
    disposeDepthMaterials(materials)
  }
}

/**
 * O oposto: força o modo NORMAL enquanto durar uma saída, desfazendo a
 * visualização de profundidade que possa estar ligada na tela — e recompondo
 * exatamente o que estava, material e visibilidade, na restauração.
 *
 * As três escolhas são independentes (decisão do usuário): ver profundidade na
 * tela e capturar um PNG normal tem de produzir um PNG normal, com elipse, chão
 * inteiro, fundo do ambiente e tudo. Sem nada ligado é inofensiva — e é por isso
 * que a captura simplesmente sempre a chama, em vez de perguntar antes.
 */
export function suspendDepthMaterial(
  scene: THREE.Scene,
  background: THREE.ColorRepresentation,
): RestoreScene {
  const swapped: Array<{ object: MaterialHolder; material: THREE.Material | THREE.Material[] }> = []
  const hidden: THREE.Object3D[] = []

  scene.traverse((object) => {
    const holder = object as MaterialHolder
    if (holder.userData[ORIGINAL_MATERIAL] !== undefined && holder.material) {
      swapped.push({ object: holder, material: holder.material })
    }
    if (object.userData[HIDDEN_BY_DEPTH] === true) hidden.push(object)
  })

  restoreDepthMaterials(scene)
  const previousBackground = scene.background
  scene.background = new THREE.Color(background)

  return () => {
    scene.background = previousBackground
    for (const { object, material } of swapped) swapMaterial(object, material)
    for (const object of hidden) hideForDepth(object)
  }
}

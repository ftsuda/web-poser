import type { BackgroundTone } from '../store/figuresStore'
import { DEFAULT_FOCAL_MM, focalLengthToFov } from './lens'

export const BACKGROUND_COLORS: Record<BackgroundTone, string> = {
  light: '#b3b3b3',
  medium: '#808080',
  dark: '#404040',
}

export const CAMERA_DEFAULTS = {
  position: [3, 2, 4] as [number, number, number],
  // Em GRAUS, mas quem manda é a lente: 35 mm (ver `lens.ts`).
  fov: focalLengthToFov(DEFAULT_FOCAL_MM),
  near: 0.1,
  far: 100,
}

export const GROUND_SIZE = 20
export const GRID_DIVISIONS = 20

/**
 * Nome do plano do chão. Não é overlay — sai no PNG e no MP4 como conteúdo —,
 * mas o mapa de profundidade precisa distingui-lo de todo o resto para poder
 * recortá-lo ou escondê-lo (ver `depthMap.GroundMode`). Constante para os dois
 * lados lerem o mesmo nome.
 */
export const GROUND_NAME = 'ground'

/**
 * Quão escura é a sombra projetada no chão, de 0 (nenhuma) a 1 (o padrão do
 * three, preto cheio). Baixada a pedido do usuário: com os objetos de cena
 * (item 42) somando volumes ao cenário, a sombra a 1 empastelava o chão e
 * competia com o boneco, que é o assunto da referência.
 *
 * **É propriedade da LUZ, não de quem projeta** (`light.shadow.intensity`):
 * uma sombra por objeto exigiria outra técnica inteira. Então este número
 * clareia junto a sombra dos bonecos — o que é coerente, já que as duas caem
 * no mesmo chão e sob a mesma luz.
 *
 * Não confundir com a elipse de contato do boneco (`FigureShadow`), que é um
 * *mesh* translúcido e tem opacidade própria.
 */
export const SHADOW_INTENSITY = 0.45

/** Distância entre duas linhas da grade do chão, em metros. */
export const GRID_SPACING_M = GROUND_SIZE / GRID_DIVISIONS

/**
 * Régua vertical do viewport (fase 9, item 11). Altura acima do boneco mais
 * alto possível (1,90 m), com folga para poses erguidas; traços finos a cada
 * 10 cm entre as marcas de metro. Onde ela fica não é constante: a régua é
 * ancorada no boneco selecionado, acompanhando o gizmo de translação (o
 * `RULER_POSITION` fixo num cruzamento da grade saiu daqui — DECISOES.md #33).
 */
export const RULER_HEIGHT_M = 2.5
export const RULER_MINOR_STEP_M = 0.1

/**
 * Nomes dos objetos que são "apoio de tela", não conteúdo da cena — a captura
 * de instantâneo os esconde quando "ocultar grade/gizmos" está ligado
 * (`SnapshotCapture.tsx`). Fonte única para não sair do ar quando um overlay
 * novo é adicionado (foi o que aconteceu na fase 9 com o indicador de grade e
 * a régua vertical).
 */
export const OVERLAY_NAMES = {
  grid: 'scene-grid',
  gridAlignment: 'scene-grid-alignment',
  verticalRuler: 'scene-vertical-ruler',
  /**
   * Papel-cebola (item 31). Entrar nesta lista é o que garante que os fantasmas
   * fiquem só na tela: o PNG e o MP4 já escondem tudo o que está aqui, com uma
   * regra só. Um grupo, não um objeto por fantasma — esconder o pai basta.
   */
  onionSkin: 'scene-onion-skin',
  /**
   * Gizmo da câmera de cena (fase 11): apoio de tela por definição — a câmera
   * não pode aparecer na própria foto, e o modo visão-câmera também o esconde.
   */
  sceneCamera: 'scene-camera-gizmo',
  /**
   * Linhas de gesto (item 9). Entram aqui por decisão do usuário: somem sempre
   * no MP4 e nas miniaturas, e no PNG obedecem à chave "ocultar grade/gizmos"
   * do painel de instantâneo — quem quiser a folha impressa COM a linha de ação
   * desliga a chave, e quem quiser a figura limpa não mexe em nada.
   */
  gestureLines: 'scene-gesture-lines',
} as const

/**
 * Cores das linhas de gesto (item 9). Escolhidas FORA da paleta já ocupada: o
 * gizmo de transformação usa vermelho/verde/azul puros nos eixos e a junta
 * selecionada acende em amarelo — magenta e ciano claro não colidem com
 * nenhum dos dois, e ambos se separam do cinza do ambiente nos três fundos.
 */
export const GESTURE_ACTION_COLOR = '#ff3d9a'
export const GESTURE_TRANSVERSE_COLOR = '#3dd6ff'

/**
 * Raio do tubo das linhas de gesto, em metros. Fino o bastante para não virar
 * um cano sobre o boneco, grosso o bastante para ler a 100% de zoom — e tubo,
 * não `line`, porque `lineBasicMaterial` ignora espessura em WebGL.
 */
export const GESTURE_LINE_RADIUS_M = 0.008

export const OVERLAY_NAME_LIST: readonly string[] = Object.values(OVERLAY_NAMES)

/**
 * Marca de `userData` do objeto de cena escondido **só da bancada** (item 42).
 *
 * É o SIMÉTRICO dos `OVERLAY_NAMES`: aqueles aparecem na tela e somem no
 * arquivo; este some da tela e **aparece** no arquivo. A captura procura esta
 * marca para reacender o objeto no instante de renderizar (ver
 * `sceneCapture.revealEditorHidden`) — sem ela, um cenário tirado da frente
 * para posar sumiria também do PNG e do MP4, que é o oposto do que a opção
 * promete.
 */
export const EDITOR_HIDDEN_FLAG = 'editorHidden'

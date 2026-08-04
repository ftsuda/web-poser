/**
 * Preferências de layout da UI persistidas em `localStorage` (fase 9, item
 * 8): quais painéis laterais estão recolhidos.
 *
 * Fica numa chave PRÓPRIA (`webposer:ui:v1`), separada do autosave do
 * workspace (`autosave.ts`), de propósito: o estado recolhido/expandido é
 * preferência de quem está usando o app, não conteúdo da cena — se entrasse
 * no mesmo bloco, viajaria junto no arquivo da cena e no `workspace.json`,
 * poluindo um formato que o Blender também lê. Continua sendo gravado
 * automaticamente, sem ação do usuário, como o resto do autosave.
 */

import { DEFAULT_FIGURE_STYLE, FIGURE_STYLES, type FigureStyle } from '../figure/skeleton'
import { FRAME_MASK_SOURCES, type FrameMaskSource } from '../scene/frameMask'

const UI_PREFERENCES_KEY = 'webposer:ui:v1'

/** Aceita só os três valores conhecidos: um arquivo editado à mão não pode ligar uma máscara inexistente. */
function isFrameMaskSource(value: unknown): value is FrameMaskSource {
  return FRAME_MASK_SOURCES.includes(value as FrameMaskSource)
}

function isFigureStyle(value: unknown): value is FigureStyle {
  return FIGURE_STYLES.includes(value as FigureStyle)
}

/**
 * Painéis recolhíveis, na ordem em que aparecem no `AppShell` — os seis
 * laterais mais a barra da linha do tempo (`timeline`), que é do RODAPÉ e não
 * uma coluna, mas recolhe pelo mesmo mecanismo e persiste no mesmo lugar
 * (item 29).
 */
export const PANEL_KEYS = [
  'figures',
  'properties',
  'camera',
  'snapshots',
  'animation',
  'scenes',
  'timeline',
] as const

export type PanelKey = (typeof PANEL_KEYS)[number]

export type CollapsedPanels = Record<PanelKey, boolean>

export function createExpandedPanels(): CollapsedPanels {
  return Object.fromEntries(PANEL_KEYS.map((key) => [key, false])) as CollapsedPanels
}

/**
 * Seções recolhíveis DENTRO de um painel (pedido do usuário, 2026-07-31).
 * Não são painéis do `AppShell` — por isso não entram em `PANEL_KEYS` —, mas
 * recolhem e persistem pelo mesmo mecanismo.
 *
 * O prefixo diz de qual painel a seção é: as chaves convivem num objeto só, e
 * "poses" sem dono seria adivinhação na hora de ler o `localStorage` de um
 * usuário. Só as do animador não levam prefixo próprio por serem as primeiras
 * — `animation*` já é o prefixo delas.
 */
export const SECTION_KEYS = [
  'animationClips',
  'animationVideo',
  'animationLibrary',
  'poses',
  'poseTransfer',
  'symmetry',
  'cameraFraming',
  'cameraViews',
  'cameraMove',
  'cameraOrtho',
  'cameraBookmarks',
  /** Configurações do painel de Cenas — hoje, a faixa do mapa de profundidade (fase 13). */
  'sceneSettings',
  /** Foto de referência + marcação de pose (item 7 / pose por marcação manual), no painel de Propriedades. */
  'referencePhoto',
] as const

export type SectionKey = (typeof SECTION_KEYS)[number]

export type CollapsedSections = Record<SectionKey, boolean>

/**
 * Quais seções nascem RECOLHIDAS: as de uso ocasional. Ficam abertas as duas
 * que são o motivo de o painel existir — escolher e aplicar uma pose, e
 * enquadrar a câmera. Recolher o que se usa o tempo todo seria trocar rolagem
 * por cliques.
 */
const SECTIONS_COLLAPSED_BY_DEFAULT: readonly SectionKey[] = SECTION_KEYS.filter(
  (key) => key !== 'poses' && key !== 'cameraFraming',
)

export function createCollapsedSections(): CollapsedSections {
  const sections = Object.fromEntries(SECTION_KEYS.map((key) => [key, false])) as CollapsedSections
  for (const key of SECTIONS_COLLAPSED_BY_DEFAULT) sections[key] = true
  return sections
}

/**
 * Painéis que nascem RECOLHIDOS na primeira visita: a Animação e a barra da
 * linha do tempo. Com sete colunas, seis painéis abertos já espremem o
 * viewport, e o animador é o único que não faz parte do fluxo de posar e
 * capturar — a barra do rodapé, pela mesma razão, não tira altura de quem só
 * está posando.
 */
const COLLAPSED_BY_DEFAULT: readonly PanelKey[] = ['animation', 'timeline']

export interface UIPreferences {
  collapsedPanels: CollapsedPanels
  /** Seções recolhidas dentro dos painéis — ver `SECTION_KEYS`. */
  collapsedSections: CollapsedSections
  /**
   * Régua vertical do viewport (fase 9, item 11). Fica aqui, e não no
   * `environment` da cena (junto da grade), porque é apoio de tela: no
   * `environment` viajaria no arquivo da cena e no `workspace.json`,
   * mudando um contrato de arquivo que o Blender também lê — sem nenhum
   * ganho, já que a régua não é conteúdo da composição.
   */
  rulerVisible: boolean
  /**
   * Qual saída a máscara de enquadramento está mostrando — nenhuma, a do
   * instantâneo (PNG) ou a da animação (MP4). Mesmo raciocínio da régua: é
   * apoio de tela, não conteúdo da composição.
   */
  frameMaskSource: FrameMaskSource
  /**
   * Se aplicar uma pose em dupla também põe o outro boneco na metade
   * correspondente (DECISOES.md #41). Ligado de fábrica — é o comportamento
   * que o usuário pediu naquele item; desligar é para quem quer montar o par à
   * mão.
   */
  pairPoseEnabled: boolean
  /**
   * Casca visual do boneco — manequim de madeira ou palito de juntas grandes
   * (DECISOES.md #81). Mesmo raciocínio da régua e da máscara: é modo de
   * VISUALIZAÇÃO, não conteúdo. Guardar no `environment` da cena a faria viajar
   * no arquivo da cena e no `workspace.json`, mudando um contrato de arquivo
   * que o Blender também lê para descrever algo que nem existe fora da tela.
   *
   * Por ser preferência de tela e não de cena, ela também vale para TODOS os
   * bonecos ao mesmo tempo: dois bonecos em cascas diferentes na mesma cena
   * seriam dois desenhos do mesmo objeto, sem nenhum uso.
   */
  figureStyle: FigureStyle
  /**
   * Modo SILHUETA (item 8): os bonecos em preto chapado, para checar a leitura
   * da pose — a primeira coisa que um ilustrador confere. Mesmo regime da
   * casca: modo de visualização, preferência de tela, vale para todos os
   * bonecos ao mesmo tempo.
   */
  figureSilhouette: boolean
}

/** Padrão de fábrica: tudo expandido menos o animador, régua e máscara desligadas, par automático ligado, manequim de madeira. */
function createDefaults(): UIPreferences {
  const collapsedPanels = createExpandedPanels()
  for (const key of COLLAPSED_BY_DEFAULT) collapsedPanels[key] = true
  return {
    collapsedPanels,
    collapsedSections: createCollapsedSections(),
    rulerVisible: false,
    frameMaskSource: 'off',
    pairPoseEnabled: true,
    figureStyle: DEFAULT_FIGURE_STYLE,
    figureSilhouette: false,
  }
}

/** Lê as preferências, sempre devolvendo um objeto completo (defaults para o que faltar ou estiver corrompido). */
export function loadUIPreferences(): UIPreferences {
  const preferences = createDefaults()
  if (typeof localStorage === 'undefined') return preferences

  let raw: string | null
  try {
    raw = localStorage.getItem(UI_PREFERENCES_KEY)
  } catch {
    return preferences
  }
  if (!raw) return preferences

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return preferences
  }

  const source = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
  const stored = (
    typeof source.collapsedPanels === 'object' && source.collapsedPanels !== null
      ? source.collapsedPanels
      : {}
  ) as Record<string, unknown>

  // Lê os DOIS valores, não só `true`: com um painel que nasce recolhido,
  // aceitar apenas `true` faria o `false` gravado ao expandi-lo ser ignorado, e
  // ele voltaria recolhido a cada sessão.
  for (const key of PANEL_KEYS) {
    if (typeof stored[key] === 'boolean') preferences.collapsedPanels[key] = stored[key]
  }

  // Mesma leitura dos dois valores, e pela mesma razão: as seções nascem
  // recolhidas, então aceitar só `true` faria o `false` gravado ao abrir uma
  // delas ser ignorado a cada sessão.
  const storedSections = (
    typeof source.collapsedSections === 'object' && source.collapsedSections !== null
      ? source.collapsedSections
      : {}
  ) as Record<string, unknown>
  for (const key of SECTION_KEYS) {
    if (typeof storedSections[key] === 'boolean') preferences.collapsedSections[key] = storedSections[key]
  }
  if (source.rulerVisible === true) preferences.rulerVisible = true
  if (isFrameMaskSource(source.frameMaskSource)) preferences.frameMaskSource = source.frameMaskSource
  // Lê os dois valores, e não só `true`: o padrão aqui é ligado, então aceitar
  // apenas `true` faria o desligamento gravado ser ignorado a cada sessão.
  if (typeof source.pairPoseEnabled === 'boolean') preferences.pairPoseEnabled = source.pairPoseEnabled
  if (isFigureStyle(source.figureStyle)) preferences.figureStyle = source.figureStyle
  if (source.figureSilhouette === true) preferences.figureSilhouette = true
  return preferences
}

/** Grava as preferências; "melhor esforço", nunca lança (mesma política do autosave). */
export function saveUIPreferences(preferences: UIPreferences): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ version: 1, ...preferences }))
  } catch {
    // Cota estourada ou `localStorage` indisponível — preferência de layout
    // não vale quebrar a aplicação.
  }
}

/**
 * Preferências de layout da UI persistidas em `localStorage` (fase 9, item
 * 8): quais painéis laterais estão recolhidos.
 *
 * Fica numa chave PRÓPRIA (`virtual-mockup:ui:v1`), separada do autosave do
 * workspace (`autosave.ts`), de propósito: o estado recolhido/expandido é
 * preferência de quem está usando o app, não conteúdo da cena — se entrasse
 * no mesmo bloco, viajaria junto no `extras` do `.glb` e no `workspace.json`,
 * poluindo um formato que o Blender também lê. Continua sendo gravado
 * automaticamente, sem ação do usuário, como o resto do autosave.
 */

import { FRAME_MASK_SOURCES, type FrameMaskSource } from '../scene/frameMask'

const UI_PREFERENCES_KEY = 'virtual-mockup:ui:v1'

/** Aceita só os três valores conhecidos: um arquivo editado à mão não pode ligar uma máscara inexistente. */
function isFrameMaskSource(value: unknown): value is FrameMaskSource {
  return FRAME_MASK_SOURCES.includes(value as FrameMaskSource)
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
 * Painéis que nascem RECOLHIDOS na primeira visita: a Animação e a barra da
 * linha do tempo. Com sete colunas, seis painéis abertos já espremem o
 * viewport, e o animador é o único que não faz parte do fluxo de posar e
 * capturar — a barra do rodapé, pela mesma razão, não tira altura de quem só
 * está posando.
 */
const COLLAPSED_BY_DEFAULT: readonly PanelKey[] = ['animation', 'timeline']

export interface UIPreferences {
  collapsedPanels: CollapsedPanels
  /**
   * Régua vertical do viewport (fase 9, item 11). Fica aqui, e não no
   * `environment` da cena (junto da grade), porque é apoio de tela: no
   * `environment` viajaria no `extras` do `.glb` e no `workspace.json`,
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
}

/** Padrão de fábrica: tudo expandido menos o animador, régua e máscara desligadas, par automático ligado. */
function createDefaults(): UIPreferences {
  const collapsedPanels = createExpandedPanels()
  for (const key of COLLAPSED_BY_DEFAULT) collapsedPanels[key] = true
  return { collapsedPanels, rulerVisible: false, frameMaskSource: 'off', pairPoseEnabled: true }
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
  if (source.rulerVisible === true) preferences.rulerVisible = true
  if (isFrameMaskSource(source.frameMaskSource)) preferences.frameMaskSource = source.frameMaskSource
  // Lê os dois valores, e não só `true`: o padrão aqui é ligado, então aceitar
  // apenas `true` faria o desligamento gravado ser ignorado a cada sessão.
  if (typeof source.pairPoseEnabled === 'boolean') preferences.pairPoseEnabled = source.pairPoseEnabled
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

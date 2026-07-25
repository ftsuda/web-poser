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

const UI_PREFERENCES_KEY = 'virtual-mockup:ui:v1'

/** Painéis laterais recolhíveis, na ordem em que aparecem no `AppShell`. */
export const PANEL_KEYS = ['figures', 'properties', 'camera', 'keyframes', 'scenes'] as const

export type PanelKey = (typeof PANEL_KEYS)[number]

export type CollapsedPanels = Record<PanelKey, boolean>

export function createExpandedPanels(): CollapsedPanels {
  return Object.fromEntries(PANEL_KEYS.map((key) => [key, false])) as CollapsedPanels
}

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
}

/** Padrão de fábrica: tudo expandido, régua desligada. */
function createDefaults(): UIPreferences {
  return { collapsedPanels: createExpandedPanels(), rulerVisible: false }
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

  for (const key of PANEL_KEYS) {
    if (stored[key] === true) preferences.collapsedPanels[key] = true
  }
  if (source.rulerVisible === true) preferences.rulerVisible = true
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

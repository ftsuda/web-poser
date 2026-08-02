/**
 * Escolha da CASCA da aplicação (item 44): a completa (`AppShell`) ou o
 * módulo de poses (`PosesShell`), a casca de toque para celular e tablet.
 *
 * A decisão acontece UMA vez, no carregamento — os stores restauram o
 * autosave no init de módulo, e a chave de autosave depende da casca (o
 * módulo de poses tem sessão própria, decisão do usuário). Trocar de casca em
 * runtime é, portanto, gravar o override e recarregar a página.
 *
 * Este módulo não importa NADA de store — ele roda antes de todos eles.
 */

export type ShellKey = 'desktop' | 'poses'

/** `auto` = detectar pelo aparelho; os outros dois são escolha explícita do usuário. */
export type ShellOverride = ShellKey | 'auto'

export const SHELL_OVERRIDE_KEY = 'webposer:shell:v1'

// ---------------------------------------------------------------------------
// Migração das chaves legadas: o app nasceu "virtual-mockup" e foi renomeado
// para "webposer" (2026-08-02, DECISOES.md #102). Roda no escopo de módulo —
// este é o módulo-folha que TODO leitor de storage importa primeiro (ver o
// comentário da identidade de sessão, abaixo), então a cópia acontece antes de
// qualquer `getItem` com o prefixo novo. Sem ela, o rename apagaria a sessão
// de quem já usa o app.
// ---------------------------------------------------------------------------

const LEGACY_STORAGE_PREFIX = 'virtual-mockup:'
const STORAGE_PREFIX = 'webposer:'
/** Todas as chaves que o app já gravou — as três daqui e a de preferências de UI. */
const MIGRATED_KEY_SUFFIXES = ['shell:v1', 'workspace:v1', 'poses:v1', 'ui:v1'] as const

/** Exportada só para os testes; no app roda uma vez, na avaliação deste módulo. */
export function migrateLegacyLocalStorage(): void {
  if (typeof localStorage === 'undefined') return
  try {
    for (const suffix of MIGRATED_KEY_SUFFIXES) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_PREFIX + suffix)
      if (legacy === null) continue
      // A chave nova só recebe se ainda não existir — quem já gravou sessão
      // com o nome novo não pode ser atropelado por uma legada mais velha.
      if (localStorage.getItem(STORAGE_PREFIX + suffix) === null) {
        localStorage.setItem(STORAGE_PREFIX + suffix, legacy)
      }
      localStorage.removeItem(LEGACY_STORAGE_PREFIX + suffix)
    }
  } catch {
    // Melhor esforço, como todo storage do app (cota, modo privado).
  }
}

migrateLegacyLocalStorage()

export interface ShellEnvironment {
  /** `(pointer: coarse)` — o ponteiro principal é um dedo, não um mouse. */
  coarsePointer: boolean
  /** A menor dimensão do viewport cabe num tablet — ver `NARROW_VIEWPORT_MAX_PX`. */
  narrowViewport: boolean
}

/**
 * Teto da MENOR dimensão do viewport para valer como "tela estreita". Pega
 * celulares em qualquer orientação e tablets até o iPad Pro (1024 lógicos no
 * lado menor); um monitor touch de desktop fica de fora pela dimensão, além
 * de normalmente ter mouse (ponteiro fino).
 */
const NARROW_VIEWPORT_MAX_PX = 1024

export function decideShell(override: ShellOverride, environment: ShellEnvironment): ShellKey {
  if (override !== 'auto') return override
  return environment.coarsePointer && environment.narrowViewport ? 'poses' : 'desktop'
}

export function readShellOverride(): ShellOverride {
  if (typeof localStorage === 'undefined') return 'auto'
  try {
    const raw = localStorage.getItem(SHELL_OVERRIDE_KEY)
    return raw === 'poses' || raw === 'desktop' ? raw : 'auto'
  } catch {
    return 'auto'
  }
}

/** `auto` limpa a chave — o estado "sem escolha" é a ausência, não um literal a validar para sempre. */
export function writeShellOverride(value: ShellOverride): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (value === 'auto') localStorage.removeItem(SHELL_OVERRIDE_KEY)
    else localStorage.setItem(SHELL_OVERRIDE_KEY, value)
  } catch {
    // Melhor esforço, como todo storage do app: sem storage, fica a detecção.
  }
}

/** Lê o aparelho com as guardas de jsdom (sem `matchMedia`, tudo `false` → desktop). */
export function detectShellEnvironment(): ShellEnvironment {
  if (typeof window === 'undefined') return { coarsePointer: false, narrowViewport: false }
  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const narrowViewport =
    Math.min(window.innerWidth ?? Infinity, window.innerHeight ?? Infinity) <= NARROW_VIEWPORT_MAX_PX
  return { coarsePointer, narrowViewport }
}

/**
 * Casca pedida na URL (`?shell=poses|desktop`) — é o que o ATALHO do PWA usa
 * (item 56): o manifest não escreve em `localStorage`, então o atalho aponta
 * para uma URL com a escolha. Vence o override gravado por ser o gesto mais
 * explícito; valor desconhecido (ou ausência) devolve `null` e a decisão
 * segue o caminho normal.
 */
export function readShellQuery(): ShellKey | null {
  if (typeof window === 'undefined') return null
  try {
    const value = new URLSearchParams(window.location.search).get('shell')
    return value === 'poses' || value === 'desktop' ? value : null
  } catch {
    return null
  }
}

/** A casca desta sessão: URL primeiro, override persistido depois, aparelho por fim. */
export function resolveShell(): ShellKey {
  return readShellQuery() ?? decideShell(readShellOverride(), detectShellEnvironment())
}

/**
 * Troca de casca pelos botões (Toolbar ✋ / barra do módulo): grava o override
 * e recarrega — REMOVENDO o `?shell=` da URL, senão um app aberto pelo atalho
 * do PWA ficaria preso à casca da URL, que vence o override de propósito.
 */
export function switchShell(target: ShellKey): void {
  writeShellOverride(target)
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('shell')
  window.location.href = url.toString()
}

// ---------------------------------------------------------------------------
// Identidade da SESSÃO de autosave — mora aqui, e não no `autosave.ts`, por
// causa do ciclo de import: o `figuresStore` chama o load do autosave durante
// a própria avaliação do ciclo, quando o corpo do `autosave.ts` ainda não
// rodou (as consts de lá estariam em TDZ). Este módulo é folha e é sempre o
// primeiro import do `autosave.ts`, então está inicializado a tempo.
// ---------------------------------------------------------------------------

export const WORKSPACE_AUTOSAVE_KEY = 'webposer:workspace:v1'

/**
 * Sessão PRÓPRIA do módulo de poses (item 44, decisão do usuário): a casca de
 * toque autossalva o mesmo formato de workspace, mas noutra chave — abrir o
 * módulo no mesmo aparelho não atropela a sessão do desktop, nem o contrário.
 */
export const POSES_AUTOSAVE_KEY = 'webposer:poses:v1'

/** A chave de autosave desta sessão, decidida pela casca em vigor. */
export function resolveAutosaveKey(): string {
  return resolveShell() === 'poses' ? POSES_AUTOSAVE_KEY : WORKSPACE_AUTOSAVE_KEY
}

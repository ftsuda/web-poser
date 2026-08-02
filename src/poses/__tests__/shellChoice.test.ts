import { afterEach, describe, expect, it } from 'vitest'
import {
  POSES_AUTOSAVE_KEY,
  SHELL_OVERRIDE_KEY,
  WORKSPACE_AUTOSAVE_KEY,
  decideShell,
  detectShellEnvironment,
  migrateLegacyLocalStorage,
  readShellOverride,
  resolveShell,
  writeShellOverride,
} from '../shellChoice'

afterEach(() => {
  localStorage.clear()
})

/**
 * O app nasceu "virtual-mockup" e foi renomeado para "webposer" (2026-08-02).
 * As chaves de `localStorage` mudaram de prefixo, e a migração carrega o que
 * já estava gravado — senão o rename apagaria a sessão de quem já usa o app.
 */
describe('migração das chaves legadas (virtual-mockup → webposer)', () => {
  it('as chaves novas usam o prefixo webposer', () => {
    expect(SHELL_OVERRIDE_KEY).toBe('webposer:shell:v1')
    expect(WORKSPACE_AUTOSAVE_KEY).toBe('webposer:workspace:v1')
    expect(POSES_AUTOSAVE_KEY).toBe('webposer:poses:v1')
  })

  it('copia as quatro chaves legadas para o prefixo novo e remove as antigas', () => {
    localStorage.setItem('virtual-mockup:shell:v1', 'poses')
    localStorage.setItem('virtual-mockup:workspace:v1', '{"version":1}')
    localStorage.setItem('virtual-mockup:poses:v1', '{"version":2}')
    localStorage.setItem('virtual-mockup:ui:v1', '{"version":3}')

    migrateLegacyLocalStorage()

    expect(localStorage.getItem('webposer:shell:v1')).toBe('poses')
    expect(localStorage.getItem('webposer:workspace:v1')).toBe('{"version":1}')
    expect(localStorage.getItem('webposer:poses:v1')).toBe('{"version":2}')
    expect(localStorage.getItem('webposer:ui:v1')).toBe('{"version":3}')
    expect(localStorage.getItem('virtual-mockup:shell:v1')).toBeNull()
    expect(localStorage.getItem('virtual-mockup:workspace:v1')).toBeNull()
    expect(localStorage.getItem('virtual-mockup:poses:v1')).toBeNull()
    expect(localStorage.getItem('virtual-mockup:ui:v1')).toBeNull()
  })

  it('não atropela uma chave nova já gravada — a legada só some', () => {
    localStorage.setItem('virtual-mockup:workspace:v1', '{"velho":true}')
    localStorage.setItem('webposer:workspace:v1', '{"novo":true}')

    migrateLegacyLocalStorage()

    expect(localStorage.getItem('webposer:workspace:v1')).toBe('{"novo":true}')
    expect(localStorage.getItem('virtual-mockup:workspace:v1')).toBeNull()
  })

  it('sem chave legada nenhuma, é um no-op', () => {
    migrateLegacyLocalStorage()
    expect(localStorage.length).toBe(0)
  })
})

describe('decideShell', () => {
  it('sem override, exige ponteiro grosso E tela estreita para escolher o módulo de poses', () => {
    expect(decideShell('auto', { coarsePointer: true, narrowViewport: true })).toBe('poses')
    expect(decideShell('auto', { coarsePointer: true, narrowViewport: false })).toBe('desktop')
    expect(decideShell('auto', { coarsePointer: false, narrowViewport: true })).toBe('desktop')
    expect(decideShell('auto', { coarsePointer: false, narrowViewport: false })).toBe('desktop')
  })

  it('override explícito vence a detecção nos dois sentidos', () => {
    expect(decideShell('poses', { coarsePointer: false, narrowViewport: false })).toBe('poses')
    expect(decideShell('desktop', { coarsePointer: true, narrowViewport: true })).toBe('desktop')
  })
})

describe('override persistido', () => {
  it('sem nada gravado, vale "auto"', () => {
    expect(readShellOverride()).toBe('auto')
  })

  it('grava e lê de volta', () => {
    writeShellOverride('poses')
    expect(readShellOverride()).toBe('poses')
    expect(localStorage.getItem(SHELL_OVERRIDE_KEY)).toBe('poses')
    writeShellOverride('desktop')
    expect(readShellOverride()).toBe('desktop')
  })

  it('valor desconhecido no storage cai para "auto"', () => {
    localStorage.setItem(SHELL_OVERRIDE_KEY, 'banana')
    expect(readShellOverride()).toBe('auto')
  })

  it('gravar "auto" limpa a chave em vez de gravar o literal', () => {
    writeShellOverride('poses')
    writeShellOverride('auto')
    expect(localStorage.getItem(SHELL_OVERRIDE_KEY)).toBeNull()
    expect(readShellOverride()).toBe('auto')
  })
})

describe('atalho por URL (?shell=..., o atalho do PWA)', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('?shell=poses abre o módulo mesmo sem override gravado e sem toque', () => {
    window.history.replaceState({}, '', '/?shell=poses')
    expect(resolveShell()).toBe('poses')
  })

  it('a URL vence o override gravado: é o gesto mais explícito', () => {
    writeShellOverride('poses')
    window.history.replaceState({}, '', '/?shell=desktop')
    expect(resolveShell()).toBe('desktop')
  })

  it('valor desconhecido na URL é ignorado', () => {
    window.history.replaceState({}, '', '/?shell=banana')
    expect(resolveShell()).toBe('desktop')
  })
})

describe('resolveShell (ambiente real)', () => {
  it('em jsdom (sem matchMedia de ponteiro grosso), resolve para o desktop', () => {
    expect(resolveShell()).toBe('desktop')
  })

  it('a detecção de ambiente não explode sem matchMedia', () => {
    const environment = detectShellEnvironment()
    expect(typeof environment.coarsePointer).toBe('boolean')
    expect(typeof environment.narrowViewport).toBe('boolean')
  })

  it('com override gravado, resolve para o módulo de poses mesmo em jsdom', () => {
    writeShellOverride('poses')
    expect(resolveShell()).toBe('poses')
  })
})

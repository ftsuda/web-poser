import { describe, expect, it } from 'vitest'
import { formatSnapshotFilename, slugifySceneName } from '../snapshotNaming'

describe('slugifySceneName', () => {
  it('replaces spaces with hyphens', () => {
    expect(slugifySceneName('Cena 1')).toBe('Cena-1')
  })

  it('trims leading/trailing whitespace before slugifying', () => {
    expect(slugifySceneName('  minha cena  ')).toBe('minha-cena')
  })

  it('collapses runs of whitespace into a single hyphen', () => {
    expect(slugifySceneName('cena   com    espaços')).toBe('cena-com-espaços')
  })

  it('replaces filesystem-unsafe characters with a hyphen and collapses repeats', () => {
    expect(slugifySceneName('cena/teste:x?y*z')).toBe('cena-teste-x-y-z')
  })

  it('trims stray leading/trailing hyphens produced by sanitizing', () => {
    expect(slugifySceneName('/cena/')).toBe('cena')
  })

  it('falls back to a neutral ASCII name when the result would otherwise be empty', () => {
    expect(slugifySceneName('')).toBe('scene')
    expect(slugifySceneName('   ')).toBe('scene')
    expect(slugifySceneName('///')).toBe('scene')
  })

  it('preserves accented letters (valid in filenames on modern filesystems)', () => {
    expect(slugifySceneName('Cená')).toBe('Cená')
  })
})

describe('formatSnapshotFilename', () => {
  /**
   * Data injetada em todo teste: o nome carrega o carimbo `_AAAA-MM-DD-HHmm`
   * (pedido do usuário, 2026-08-07, ver `exportTimestamp.ts`), e sem injetar o
   * instante o teste passaria a depender do relógio da máquina.
   */
  const quando = new Date(2026, 7, 7, 14, 32)

  it('zero-pads the sequence number to 3 digits', () => {
    expect(formatSnapshotFilename('Cena 1', 1, { now: quando })).toBe('Cena-1_snap001_2026-08-07-1432.png')
    expect(formatSnapshotFilename('Cena 1', 42, { now: quando })).toBe('Cena-1_snap042_2026-08-07-1432.png')
  })

  it('extends the padding instead of truncating once the sequence reaches 4 digits', () => {
    expect(formatSnapshotFilename('Cena 1', 1000, { now: quando })).toBe('Cena-1_snap1000_2026-08-07-1432.png')
  })

  it('slugifies the scene name as part of the filename', () => {
    expect(formatSnapshotFilename('Minha Cena Legal', 1, { now: quando })).toBe(
      'Minha-Cena-Legal_snap001_2026-08-07-1432.png',
    )
  })

  /**
   * Fase 13: profundidade é uma saída ALTERNATIVA — quem quer as duas versões
   * captura duas vezes, e os números da sequência ficam diferentes. O sufixo é
   * o que permite reconhecer qual arquivo é qual na pasta.
   */
  it('marca o mapa de profundidade com o sufixo `_depth`, antes do carimbo de hora', () => {
    expect(formatSnapshotFilename('Cena 1', 2, { depth: true, now: quando })).toBe(
      'Cena-1_snap002_depth_2026-08-07-1432.png',
    )
  })

  it('sem a opção, o nome é o de sempre mais o carimbo', () => {
    expect(formatSnapshotFilename('Cena 1', 2, { depth: false, now: quando })).toBe(
      'Cena-1_snap002_2026-08-07-1432.png',
    )
  })

  /**
   * O contador NÃO some com a chegada do carimbo: duas capturas no mesmo minuto
   * têm a mesma data, e é a sequência que impede uma sobrescrever a outra.
   */
  it('sem instante injetado, carimba a hora corrente e mantém a sequência', () => {
    expect(formatSnapshotFilename('Cena 1', 7)).toMatch(/^Cena-1_snap007_\d{4}-\d{2}-\d{2}-\d{4}\.png$/)
  })
})

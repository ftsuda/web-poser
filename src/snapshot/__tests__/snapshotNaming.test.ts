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
  it('zero-pads the sequence number to 3 digits', () => {
    expect(formatSnapshotFilename('Cena 1', 1)).toBe('Cena-1_snap001.png')
    expect(formatSnapshotFilename('Cena 1', 42)).toBe('Cena-1_snap042.png')
  })

  it('extends the padding instead of truncating once the sequence reaches 4 digits', () => {
    expect(formatSnapshotFilename('Cena 1', 1000)).toBe('Cena-1_snap1000.png')
  })

  it('slugifies the scene name as part of the filename', () => {
    expect(formatSnapshotFilename('Minha Cena Legal', 1)).toBe('Minha-Cena-Legal_snap001.png')
  })
})

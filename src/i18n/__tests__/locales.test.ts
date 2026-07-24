import { describe, expect, it } from 'vitest'
import ptBR from '../locales/pt-BR.json'
import en from '../locales/en.json'

function flattenKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return flattenKeys(value as object, path)
    }
    return [path]
  })
}

describe('i18n locale dictionaries', () => {
  it('pt-BR and en expose exactly the same set of translation keys', () => {
    const ptKeys = flattenKeys(ptBR).sort()
    const enKeys = flattenKeys(en).sort()

    expect(enKeys).toEqual(ptKeys)
  })

  it('has no empty translation values in either dictionary', () => {
    const emptyEntries = (dict: object) =>
      flattenKeys(dict).filter((key) => {
        const value = key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], dict)
        return typeof value !== 'string' || value.trim() === ''
      })

    expect(emptyEntries(ptBR)).toEqual([])
    expect(emptyEntries(en)).toEqual([])
  })
})

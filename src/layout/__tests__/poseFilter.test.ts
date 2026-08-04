import { describe, expect, it } from 'vitest'
import { matchesPoseFilter } from '../poseFilter'

describe('matchesPoseFilter (item 35)', () => {
  it('filtro vazio (ou só espaços) aceita qualquer nome', () => {
    expect(matchesPoseFilter('Em pé', '')).toBe(true)
    expect(matchesPoseFilter('Em pé', '   ')).toBe(true)
  })

  it('compara sem diferenciar caixa', () => {
    expect(matchesPoseFilter('Sentado', 'sen')).toBe(true)
    expect(matchesPoseFilter('sentado', 'SEN')).toBe(true)
  })

  it('compara sem diferenciar acento — "em pe" acha "Em pé"', () => {
    expect(matchesPoseFilter('Em pé', 'em pe')).toBe(true)
    expect(matchesPoseFilter('Agachado', 'ágàchado')).toBe(true)
  })

  it('é busca por trecho, em qualquer posição do nome', () => {
    expect(matchesPoseFilter('Chute (dando)', 'dando')).toBe(true)
    expect(matchesPoseFilter('Chute (dando)', 'soco')).toBe(false)
  })
})

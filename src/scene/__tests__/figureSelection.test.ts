import { describe, expect, it } from 'vitest'
import { isFigureInteractive } from '../figureSelection'

describe('isFigureInteractive — isolar a seleção no viewport', () => {
  it('sem isolar, todo boneco responde ao clique', () => {
    expect(isFigureInteractive('figure-2', 'figure-1', false)).toBe(true)
    expect(isFigureInteractive('figure-1', 'figure-1', false)).toBe(true)
    expect(isFigureInteractive('figure-1', null, false)).toBe(true)
  })

  it('isolando, só o boneco selecionado responde', () => {
    expect(isFigureInteractive('figure-1', 'figure-1', true)).toBe(true)
    expect(isFigureInteractive('figure-2', 'figure-1', true)).toBe(false)
  })

  it('isolando SEM ninguém selecionado, todos voltam a responder', () => {
    // Do contrário a cena inteira ficaria morta ao clique, e não haveria como
    // escolher um boneco pelo viewport — só pela lista do painel.
    expect(isFigureInteractive('figure-1', null, true)).toBe(true)
    expect(isFigureInteractive('figure-2', null, true)).toBe(true)
  })
})

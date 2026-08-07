import { describe, expect, it } from 'vitest'
import { shouldHighlightUpdate } from '../updateHighlight'

/**
 * O destaque do "Regravar" no card do keyframe (pedido do usuário, 2026-08-07):
 * o botão avisa que há algo na cena que aquele keyframe ainda não guardou.
 *
 * Nasceu com DUAS origens — a bancada ter mudado, e o card ter recebido uma
 * cópia do vizinho. A segunda morreu no mesmo dia: desde que copiar leva a
 * bancada para o keyframe atualizado (#137.2), o card e a cena não têm mais
 * como divergir por uma cópia, e acender ali seria mentir. Sobrou a regra que
 * de fato responde à pergunta.
 */
describe('shouldHighlightUpdate', () => {
  const base = {
    keyframeId: 'k2',
    visitedKeyframeId: 'k2',
    benchPristine: true,
  }

  it('keyframe na bancada e cena intocada: nada a gravar, nada a piscar', () => {
    expect(shouldHighlightUpdate(base)).toBe(false)
  })

  it('mexeu na cena com o keyframe na bancada: o "Regravar" dele acende', () => {
    expect(shouldHighlightUpdate({ ...base, benchPristine: false })).toBe(true)
  })

  /**
   * A cena mudada é UMA só, e "Regravar" grava nela o card em que se estava —
   * acender o botão de todos os keyframes diria que todos estão dessincronizados,
   * o que é verdade e inútil: só um deles é o que se está editando.
   */
  it('a cena mudada não acende o card que não está na bancada', () => {
    expect(shouldHighlightUpdate({ ...base, keyframeId: 'k3', benchPristine: false })).toBe(false)
  })

  it('sem keyframe nenhum na bancada, mexer na cena não acende nada', () => {
    expect(shouldHighlightUpdate({ ...base, visitedKeyframeId: null, benchPristine: false })).toBe(false)
  })
})

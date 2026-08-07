import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * As DUAS marcas do card de keyframe têm de continuar distinguíveis (pedido do
 * usuário, 2026-08-06):
 *
 * - a da **bancada** (item 40), que diz qual keyframe o "Ir para" carregou na
 *   cena editável — é ela que responde "o que 'Regravar' vai reescrever";
 * - a do **playhead**, que diz qual keyframe o viewport está mostrando enquanto
 *   se navega pela linha do tempo.
 *
 * Elas nasceram as duas em `--text-h` e caem no MESMO card depois de um "Ir
 * para" (que leva o playhead junto). Enquanto se navega, porém, elas se
 * separam — e ler duas marcas da mesma cor em cards diferentes não dizia qual
 * era qual. A do playhead passou a ser azul.
 *
 * Cor é conferência visual, não comportamento: jsdom não resolve variável de
 * CSS nenhuma. O que dá para travar é a regra na folha de estilo — mesmo
 * expediente do `panelFieldset.test.ts` (#125), e pela mesma razão: impedir que
 * alguém unifique as duas cores sem saber por que elas eram diferentes.
 */
const CSS = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

/** Corpo de uma regra do CSS, pelo seletor exato. */
function corpoDaRegra(seletor: string): string {
  const inicio = CSS.indexOf(`\n${seletor} {`)
  expect(inicio, `seletor ausente no index.css: ${seletor}`).toBeGreaterThanOrEqual(0)
  const abre = CSS.indexOf('{', inicio)
  const fecha = CSS.indexOf('}', abre)
  return CSS.slice(abre + 1, fecha)
}

describe('marcas do card de keyframe', () => {
  it('a cor do playhead existe nos dois temas', () => {
    // O `:root` claro abre o arquivo; o escuro é o de dentro do `@media`.
    const escuroDaqui = CSS.indexOf('prefers-color-scheme: dark')
    expect(CSS.slice(0, escuroDaqui)).toMatch(/--playhead:\s*#[0-9a-f]{3,8}/i)
    expect(CSS.slice(escuroDaqui)).toMatch(/--playhead:\s*#[0-9a-f]{3,8}/i)
  })

  it('a marca da bancada continua na cor de destaque', () => {
    expect(corpoDaRegra('.animation-panel__keyframe--visited')).toMatch(/var\(--text-h\)/)
    expect(corpoDaRegra('.animation-panel__keyframe--visited')).not.toMatch(/var\(--playhead\)/)
  })

  it('a marca do playhead usa a cor própria, e não a de destaque', () => {
    const regra = corpoDaRegra('.animation-panel__keyframe--playhead')

    expect(regra).toMatch(/var\(--playhead\)/)
    expect(regra).not.toMatch(/var\(--text-h\)/)
  })

  /** No mesmo card as duas convivem: o contorno da bancada e a tarja azul. */
  it('com as duas no mesmo card, cada uma mantém a sua cor', () => {
    const regra = corpoDaRegra(
      '.animation-panel__keyframe--visited.animation-panel__keyframe--playhead',
    )

    expect(regra).toMatch(/inset 0 0 0 1px var\(--text-h\)/)
    expect(regra).toMatch(/inset 3px 0 0 var\(--playhead\)/)
  })

  it('o ▶ do título segue a mesma cor do playhead', () => {
    expect(corpoDaRegra('.animation-panel__playhead')).toMatch(/color:\s*var\(--playhead\)/)
  })
})

/**
 * O destaque do "Regravar" (pedido do usuário, 2026-08-07) é a TERCEIRA marca do
 * card, e a única que se move. Duas coisas precisam continuar valendo, e nenhuma
 * das duas o jsdom mede — daí travá-las na folha, como o #125 e as marcas acima:
 *
 * - ela pulsa, e pulsa no FUNDO. Contorno parado viraria mais uma marca estática
 *   ao lado das outras duas, e animar a BORDA mexeria na caixa do botão, fazendo
 *   a lista inteira tremer;
 * - ela para de pulsar sob `prefers-reduced-motion`. Animação infinita é o caso
 *   exemplar da preferência, e o destaque tem de sobreviver a ela — desligar o
 *   movimento não pode desligar o aviso.
 */
describe('destaque do "Regravar"', () => {
  it('pulsa por animação, e o que muda é o fundo — não a borda', () => {
    const regra = corpoDaRegra('.animation-panel__update--pending')

    expect(regra).toMatch(/animation:\s*animation-panel-pending/)
    expect(CSS).toMatch(/@keyframes animation-panel-pending/)
    // `var(--border)` como COR de fundo pode; o que não pode é a propriedade
    // `border`, que muda a caixa.
    expect(corpoDaRegra('@keyframes animation-panel-pending')).not.toMatch(/^\s*border[\w-]*\s*:/m)
  })

  it('sob prefers-reduced-motion o movimento sai e o destaque fica', () => {
    const bloco = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'))
    const regra = bloco.slice(0, bloco.indexOf('\n}\n\n'))

    expect(regra).toMatch(/\.animation-panel__update--pending/)
    expect(regra).toMatch(/animation:\s*none/)
    expect(regra).toMatch(/background:/)
  })
})

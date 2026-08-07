import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * O `<fieldset>` nasce com `min-inline-size: min-content` por padrão do
 * navegador, e o mínimo da linha de rotação é dominado pela largura
 * INTRÍNSECA do `<input type="range">` (129 px no Chrome). O `min-width: 0`
 * da linha não entra nessa conta — ele só permite encolher depois que a
 * largura do contêiner já está definida. Resultado medido antes da correção:
 * o grupo "Rotação (°)" media 256 px numa coluna de 235 px em Propriedades e
 * 224 px numa de 215 px em Câmera, e os dois painéis ganhavam barra de
 * rolagem HORIZONTAL (o `overflow-y: auto` de `.panel` faz o `overflow-x`
 * deixar de ser `visible`).
 *
 * jsdom não calcula layout, então nada disso se vê montando o componente — o
 * que dá para travar é a regra na folha de estilo. Este teste é o guarda.
 */
const CSS = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

/** Corpo de uma regra do CSS, pelo seletor exato. */
function corpoDaRegra(seletor: string): string {
  const inicio = CSS.indexOf(seletor)
  expect(inicio, `seletor ausente no index.css: ${seletor}`).toBeGreaterThanOrEqual(0)
  const abre = CSS.indexOf('{', inicio)
  const fecha = CSS.indexOf('}', abre)
  return CSS.slice(abre + 1, fecha)
}

describe('fieldsets dos painéis de Propriedades e Câmera', () => {
  it.each([['.panel--properties fieldset'], ['.panel--camera fieldset']])(
    '%s destrava a largura mínima, senão o grupo de rotação rola na horizontal',
    (seletor) => {
      expect(corpoDaRegra(seletor)).toMatch(/min-inline-size:\s*0/)
    },
  )
})

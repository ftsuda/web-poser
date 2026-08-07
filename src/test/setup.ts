import '@testing-library/jest-dom/vitest'
import './setup-comum'

/**
 * Setup do projeto `interface` (PLANO.md item 23): o que só faz sentido com
 * jsdom montado — os matchers de DOM do jest-dom e o aviso ao React de que
 * estamos num ambiente de `act`. O reset de limites articulares, que vale
 * também para o projeto `unidade`, mora no `setup-comum.ts` importado acima.
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true

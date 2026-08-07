import { beforeEach } from 'vitest'
import { resetJointLimitOverrides } from '../figure/skeleton'

/**
 * O que vale para OS DOIS projetos da suíte (PLANO.md item 23): os limites
 * customizados por workspace (DECISOES.md #29) são estado global do módulo
 * `skeleton.ts` — sem este reset, um teste que instala limites vaza para os
 * seguintes, e isso não tem nada a ver com haver ou não navegador.
 *
 * O que é do jsdom mora no `setup.ts`, que carrega este.
 */
beforeEach(() => {
  resetJointLimitOverrides()
})

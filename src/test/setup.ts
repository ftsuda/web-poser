import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'
import { resetJointLimitOverrides } from '../figure/skeleton'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Os limites customizados por workspace (DECISOES.md #29) são estado global do
// módulo `skeleton.ts` — sem este reset, um teste que instala limites vaza para
// os seguintes.
beforeEach(() => {
  resetJointLimitOverrides()
})

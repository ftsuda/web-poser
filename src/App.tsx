import './i18n'
import { AppShell } from './layout/AppShell'
import { PosesShell } from './poses/PosesShell'
import { resolveShell } from './poses/shellChoice'

/**
 * A casca é decidida UMA vez, no carregamento (`shellChoice.ts`): ponteiro
 * grosso + tela estreita abrem o módulo de poses; o override persistido
 * (botão na Toolbar / no próprio módulo) vence a detecção. Trocar de casca
 * recarrega a página — o autosave de cada casca tem chave própria, restaurada
 * no init dos stores.
 */
const shell = resolveShell()

function App() {
  return shell === 'poses' ? <PosesShell /> : <AppShell />
}

export default App

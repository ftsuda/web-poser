// PRIMEIRO import de propósito: avalia o módulo-folha da casca — e com ele a
// migração das chaves legadas de localStorage (virtual-mockup → webposer,
// DECISOES.md #102) — antes de qualquer módulo que leia storage no init.
import './poses/shellChoice'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

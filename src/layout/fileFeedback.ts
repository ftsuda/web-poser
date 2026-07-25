import { SceneFileError } from '../persistence/sceneFile'

/**
 * Traduz uma falha de importação de arquivo na chave i18n exibida ao usuário
 * (fase 9, item 4). Antes, qualquer erro de importação era engolido — a
 * promessa rejeitada morria no `void handle...()` do painel e o usuário via
 * apenas "nada aconteceu" (ou, pior, a cena substituída por uma vazia).
 *
 * Fonte única para os três pontos de importação (cena, boneco, bookmarks de
 * câmera) e para a abertura de workspace em pasta.
 */
export function importErrorKey(error: unknown): string {
  if (error instanceof SceneFileError) {
    return error.reason === 'missingAppData'
      ? 'errors.importMissingAppData'
      : 'errors.importUnreadable'
  }
  return 'errors.importFailed'
}

/**
 * Quem responde ao clique no viewport quando a chave "Isolar seleção" está
 * ligada (pedido do usuário, 2026-08-04).
 *
 * É a facilidade que o módulo de poses já tinha de nascença — lá o
 * `PosesViewport` só passa `onSelectJoint` ao boneco em edição, para que numa
 * tela onde o alvo é o dedo ninguém edite por engano quem estava passando na
 * frente (PLANO.md, item 44). Na bancada isso vira uma CHAVE, porque lá o
 * mouse acerta e trocar de boneco pelo viewport é o gesto normal.
 *
 * Módulo puro à parte do componente por dois motivos: a regra tem um caso de
 * borda que merece teste (ninguém selecionado) e a alternativa seria testá-la
 * por dentro do `SceneFigures`, que é `react-three-fiber`.
 */
export function isFigureInteractive(
  figureId: string,
  selectedFigureId: string | null,
  isolateSelection: boolean,
): boolean {
  if (!isolateSelection) return true
  // Sem ninguém selecionado a chave não isola nada: isolar a cena inteira
  // deixaria o viewport morto ao clique, e escolher um boneco só pela lista do
  // painel pareceria defeito.
  if (selectedFigureId === null) return true
  return figureId === selectedFigureId
}

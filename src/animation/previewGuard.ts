import { useAnimationStore } from '../store/animationStore'
import { useFiguresStore } from '../store/figuresStore'

/**
 * A rede que impede a bancada de "travar" (DECISOES.md #134).
 *
 * A pré-visualização do animador é desenhada **no lugar** da cena de trabalho
 * (`SceneFigures`), e é isso que faz dela uma armadilha: com ela na tela, editar
 * uma junta continua acontecendo — no store, de verdade — mas nada muda no
 * viewport. Do lado de quem usa, o app "entrou num modo e não sai", e a única
 * saída conhecida era "Parar", que devolve a régua ao zero.
 *
 * O #133 fechou esse buraco controle por controle, e o usuário voltou a
 * esbarrar nele por dois que ficaram de fora. Enumerar controles é frágil: o
 * próximo botão de navegação que alguém acrescentar reabre o problema, e o
 * sintoma não aponta para a causa. Esta regra vale para todos de uma vez:
 *
 * > **Mexeu na cena de trabalho, a pré-visualização sai da frente.**
 *
 * Reprodução e exportação ficam de fora, e por motivos diferentes: enquanto TOCA
 * a pré-visualização é o que se está olhando (e o quadro muda sozinho, então
 * ninguém espera editar ali), e durante a exportação ela é o mecanismo — cada
 * quadro do arquivo passa por ela, com a cena de trabalho intocada por baixo.
 *
 * Compara `figures` por REFERÊNCIA: toda ação do store faz atualização imutável,
 * então qualquer edição — junta, colocação, altura, boneco a mais ou a menos —
 * troca o array. É a mesma premissa do `undoEquality` e da marca de bancada
 * intocada do `sceneStashActions`.
 *
 * Devolve a função que desliga a assinatura.
 */
export function installPreviewGuard(): () => void {
  return useFiguresStore.subscribe((state, previous) => {
    if (state.figures === previous.figures) return

    const animation = useAnimationStore.getState()
    if (!animation.preview || animation.playing || animation.exportPhase === 'running') return

    animation.setPreview(null)
  })
}

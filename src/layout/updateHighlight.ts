/**
 * Quando o "Regravar" de um card de keyframe pede atenção (pedido do usuário,
 * 2026-08-07).
 *
 * O botão grava no keyframe o que está na cena de trabalho. O problema que o
 * destaque resolve é que **nada na tela dizia que os dois se separaram**: quem
 * ajusta uma junta depois de carregar um keyframe vê a cena mudar e o card
 * continuar igual, e só descobre que esqueceu de gravar ao tocar a animação.
 *
 * Quem responde "a bancada mudou?" é a marca de "intocado" do `sceneStashStore`,
 * que já existia para a guarda (#127) — comparação por referência do array de
 * bonecos. Não há estado novo por trás desta regra.
 *
 * Só o card que está NA BANCADA acende. Acender todos diria que todos estão
 * dessincronizados — verdade, e inútil: "Regravar" grava a cena no card em que
 * se está, e um destaque que aparece em toda a lista não aponta para lugar
 * nenhum.
 *
 * **Houve uma segunda origem, e ela durou um dia:** o card que recebia uma
 * cópia do vizinho também acendia, porque o keyframe mudava e a bancada ficava
 * como estava. Desde que copiar leva a bancada para o keyframe atualizado
 * (#137.2), os dois não têm mais como divergir por uma cópia — e o destaque
 * teria virado um aviso sobre coisa nenhuma.
 */
export interface UpdateHighlightInput {
  keyframeId: string
  /** O keyframe carregado na bancada (item 40), ou `null` se a cena é trabalho solto. */
  visitedKeyframeId: string | null
  /** A bancada ainda é o retrato que foi carregado nela, sem ninguém ter mexido? */
  benchPristine: boolean
}

export function shouldHighlightUpdate({
  keyframeId,
  visitedKeyframeId,
  benchPristine,
}: UpdateHighlightInput): boolean {
  return keyframeId === visitedKeyframeId && !benchPristine
}

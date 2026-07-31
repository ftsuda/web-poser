import { useCameraStore } from './cameraStore'
import { useFiguresStore } from './figuresStore'

/**
 * **O que está selecionado na cena** — um lugar só, para as três coisas
 * selecionáveis.
 *
 * Até os objetos de cena (item 42) havia duas, e a exclusividade entre elas era
 * feita à mão: o `SceneCameraGizmo` chamava `selectFigure(null)` ao ser
 * clicado, e o `Viewport` mantinha um `useEffect` que apagava a câmera quando
 * um boneco era escolhido. Com uma terceira, esse arranjo vira três pares para
 * manter em dia — e a chance de um caminho novo esquecer um deles.
 *
 * O estado continua morando onde sempre morou (`figuresStore` para boneco e
 * objeto, `cameraStore` para a câmera): mover tudo para um store novo tocaria
 * quinze arquivos sem mudar comportamento nenhum, e a seleção já está fora do
 * histórico de undo nos dois lugares. O que este módulo acrescenta é o
 * PONTO ÚNICO de leitura (`useSelection`) e de escrita (`selectTarget`), e é
 * por ele que todo caminho novo deve passar.
 *
 * Ele importa os dois stores, e nenhum store importa ele — é o que mantém a
 * dependência numa direção só, sem ciclo de módulos.
 */

export type SelectionKind = 'figure' | 'prop' | 'camera'

export interface Selection {
  kind: SelectionKind
  /** Id do boneco ou do objeto; `null` para a câmera de cena, que é única. */
  id: string | null
}

/**
 * Seleciona uma coisa e **desmarca as outras duas**. `null` limpa tudo (o
 * clique no vazio do viewport).
 */
export function selectTarget(target: Selection | null): void {
  const figures = useFiguresStore.getState()
  const camera = useCameraStore.getState()

  if (target === null) {
    figures.selectFigure(null)
    camera.setCameraSelected(false)
    return
  }

  switch (target.kind) {
    case 'figure':
      // `selectFigure` já limpa o objeto selecionado (e vice-versa): a
      // exclusividade entre os dois é regra do store que os guarda.
      figures.selectFigure(target.id)
      camera.setCameraSelected(false)
      return
    case 'prop':
      figures.selectProp(target.id)
      camera.setCameraSelected(false)
      return
    case 'camera':
      figures.selectFigure(null)
      camera.setCameraSelected(true)
      return
  }
}

/** Leitura reativa do que está selecionado — para painéis e gizmos ramificarem num lugar só. */
export function useSelection(): Selection | null {
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const selectedPropId = useFiguresStore((state) => state.selectedPropId)
  const cameraSelected = useCameraStore((state) => state.cameraSelected)

  if (selectedFigureId) return { kind: 'figure', id: selectedFigureId }
  if (selectedPropId) return { kind: 'prop', id: selectedPropId }
  if (cameraSelected) return { kind: 'camera', id: null }
  return null
}

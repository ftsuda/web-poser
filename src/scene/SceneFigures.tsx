import { useCallback } from 'react'
import * as THREE from 'three'
import { Figure } from '../figure/Figure'
import { isDraggableJoint } from '../figure/dragSolver'
import { getLockedJoints } from '../figure/jointLocks'
import { ROOT_JOINT_NAME, type FigureStyle } from '../figure/skeleton'
import { useAnimationStore } from '../store/animationStore'
import { useFiguresStore, type Figure as FigureData } from '../store/figuresStore'
import { useUIStore } from '../store/uiStore'
import { isFigureInteractive } from './figureSelection'

export interface SceneFiguresProps {
  onJointRef: (figureId: string, jointName: string, object: THREE.Group | null) => void
}

/**
 * Os bonecos da cena, renderizados **de dentro** do `<Canvas>`.
 *
 * Parece um detalhe de organização e não é: é o que torna a exportação de vídeo
 * fiel. O `<Canvas>` do R3F entrega os `children` ao reconciliador dele por um
 * `root.render()` chamado dentro de uma função **assíncrona** (ele espera o
 * `configure` antes) — então tudo que chega à cena vindo do componente pai
 * atravessa um microtask e **escapa de qualquer `flushSync`**. Enquanto os
 * bonecos vinham de lá, o laço de exportação renderizava sempre a cena do
 * quadro ANTERIOR: o primeiro quadro do arquivo era a cena de trabalho e o
 * último nunca aparecia (DECISOES.md #55).
 *
 * Assinando as duas lojas aqui dentro, uma mudança de estado vira trabalho
 * direto no root do R3F — que o `flushSync` do próprio `@react-three/fiber`
 * esvazia na hora, que é o que o exportador precisa.
 *
 * Quem manda na tela é a PRÉ-VISUALIZAÇÃO quando ela existe: durante a
 * reprodução e a exportação a cena de trabalho fica intocada por baixo, e
 * parar devolve tudo (ver `AnimationPlayer.tsx` e DECISOES.md #52).
 */
export function SceneFigures({ onJointRef }: SceneFiguresProps) {
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const selectedJointName = useFiguresStore((state) => state.selectedJointName)
  const selectFigure = useFiguresStore((state) => state.selectFigure)
  const selectJoint = useFiguresStore((state) => state.selectJoint)
  const jointLocks = useFiguresStore((state) => state.jointLocks)
  const jointPins = useFiguresStore((state) => state.jointPins)
  const gizmoMode = useUIStore((state) => state.gizmoMode)
  const figureStyle = useUIStore((state) => state.figureStyle)
  const figureSilhouette = useUIStore((state) => state.figureSilhouette)
  const isolateSelection = useUIStore((state) => state.isolateSelection)
  const previewFigures = useAnimationStore((state) => state.preview?.figures ?? null)

  const rendered = previewFigures ?? figures

  // Destaque de juntas travadas (decisão com o usuário, DECISOES.md #77): só
  // enquanto o gizmo de translação de junta está ativo — a mesma condição que
  // o `Viewport` usa para mostrar o `JointDragGizmo` — e só no boneco
  // selecionado, avisando ANTES do arrasto o que vai ficar rígido.
  const dragGizmoActive =
    selectedJointName !== null &&
    selectedJointName !== ROOT_JOINT_NAME &&
    gizmoMode === 'translate' &&
    isDraggableJoint(selectedJointName)

  const handleSelectJoint = (figureId: string, jointName: string) => {
    if (selectedFigureId !== figureId) selectFigure(figureId)
    selectJoint(jointName)
  }

  return (
    <>
      {rendered.map((figure) => (
        <SceneFigure
          key={figure.id}
          figure={figure}
          selectedJointName={figure.id === selectedFigureId ? selectedJointName : null}
          lockedJointNames={
            dragGizmoActive && figure.id === selectedFigureId
              ? getLockedJoints(jointLocks, figure.id)
              : null
          }
          // Âncora (item 62) sempre visível: diferente da trava, ela congela
          // colocação e ancestrais — o efeito precisa se explicar sem gizmo.
          pinnedJointNames={jointPins[figure.id] ?? null}
          style={figureStyle}
          silhouette={figureSilhouette}
          // Isolar a seleção: sem o `onSelectJoint`, as peças do boneco deixam
          // de ter tratador e o raio do clique passa direto por elas — quem
          // está sendo editado não é mais trocado por engano ao mirar numa
          // junta que tem um figurante atrás (`figureSelection.ts`).
          onSelectJoint={
            isFigureInteractive(figure.id, selectedFigureId, isolateSelection)
              ? (jointName) => handleSelectJoint(figure.id, jointName)
              : undefined
          }
          onJointRef={onJointRef}
        />
      ))}
    </>
  )
}

interface SceneFigureProps {
  figure: FigureData
  selectedJointName: string | null
  lockedJointNames: readonly string[] | null
  pinnedJointNames: readonly string[] | null
  style: FigureStyle
  silhouette: boolean
  onSelectJoint?: (jointName: string) => void
  onJointRef: (figureId: string, jointName: string, object: THREE.Group | null) => void
}

/**
 * Um boneco da cena. Existe como componente só para poder ter um `useCallback`
 * PRÓPRIO: o `onJointRef` que o `Figure` recebe vira o `ref` de cada uma das 32
 * juntas, e o React reexecuta um `ref` sempre que a IDENTIDADE do callback muda
 * — o anterior com `null`, o novo com o objeto.
 *
 * Com a seta inline que ficava no `map` acima, cada re-render do viewport
 * desregistrava e registrava as 32 juntas de cada boneco, e cada registro é um
 * `setState` no `Viewport`, que re-renderiza os bonecos: um laço de re-render
 * que só parava sozinho. Medido no navegador com UM boneco, andar um quadro na
 * linha do tempo custava ~740 registros, 17 renders do viewport e ~1 s de
 * script — por clique (DECISOES.md #132).
 */
function SceneFigure({ figure, onJointRef, ...rest }: SceneFigureProps) {
  const figureId = figure.id
  const registerJoint = useCallback(
    (jointName: string, object: THREE.Group | null) => onJointRef(figureId, jointName, object),
    [onJointRef, figureId],
  )

  return <Figure figure={figure} onJointRef={registerJoint} {...rest} />
}

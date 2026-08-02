import * as THREE from 'three'
import { Figure } from '../figure/Figure'
import { isDraggableJoint } from '../figure/dragSolver'
import { getLockedJoints } from '../figure/jointLocks'
import { ROOT_JOINT_NAME } from '../figure/skeleton'
import { useAnimationStore } from '../store/animationStore'
import { useFiguresStore } from '../store/figuresStore'
import { useUIStore } from '../store/uiStore'

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
        <Figure
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
          onSelectJoint={(jointName) => handleSelectJoint(figure.id, jointName)}
          onJointRef={(jointName, object) => onJointRef(figure.id, jointName, object)}
        />
      ))}
    </>
  )
}

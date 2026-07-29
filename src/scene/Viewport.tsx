import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type * as THREE from 'three'
import { useTranslation } from 'react-i18next'
import { ROOT_PIVOT_REF_NAME } from '../figure/Figure'
import { getLimbEndEffector } from '../figure/ikSolver'
import { ROOT_JOINT_NAME } from '../figure/skeleton'
import { useFiguresStore } from '../store/figuresStore'
import { useIKStore } from '../store/ikStore'
import { useAnimationStore } from '../store/animationStore'
import { useUIStore } from '../store/uiStore'
import { AnimationPlayer } from './AnimationPlayer'
import { CameraRig } from './CameraRig'
import { FrameMaskCamera } from './FrameMaskCamera'
import { FrameMaskOverlay } from './FrameMaskOverlay'
import { BACKGROUND_COLORS, CAMERA_DEFAULTS } from './constants'
import { GridAlignmentIndicator } from './GridAlignmentIndicator'
import { IKTargetGizmo } from './IKTargetGizmo'
import { SnapshotCapture } from './SnapshotCapture'
import { SceneContent } from './SceneContent'
import { OnionSkin } from './OnionSkin'
import { SceneFigures } from './SceneFigures'
import { SelectionGizmo } from './SelectionGizmo'
import { VerticalRuler } from './VerticalRuler'

export function Viewport() {
  const { t } = useTranslation()
  const environment = useFiguresStore((state) => state.environment)
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const selectedJointName = useFiguresStore((state) => state.selectedJointName)
  const selectFigure = useFiguresStore((state) => state.selectFigure)
  const rootGizmoMode = useUIStore((state) => state.rootGizmoMode)

  const limbEndEffector = selectedJointName ? getLimbEndEffector(selectedJointName) : null
  const limbIKEnabled = useIKStore((state) =>
    selectedFigureId && limbEndEffector ? state.isLimbEnabled(selectedFigureId, limbEndEffector) : false,
  )
  // Ombro/cotovelo (ou quadril/joelho) perdem o gizmo de rotação FK enquanto
  // o membro está em IK — só o pulso/tornozelo (junta-efetuador) continua
  // com seu próprio gizmo, já que tem grau de liberdade que o IK não cobre
  // (torção) — mesma regra da fase 3 do painel de Propriedades.
  const isIKControlledJoint = limbIKEnabled && limbEndEffector !== null && selectedJointName !== limbEndEffector
  const ikTarget = useIKStore((state) =>
    selectedFigureId && limbEndEffector ? state.getTarget(selectedFigureId, limbEndEffector) : undefined,
  )
  const rulerVisible = useUIStore((state) => state.rulerVisible)
  const animationPlaying = useAnimationStore((state) => state.playing)

  const orbitControlsRef = useRef<OrbitControlsImpl>(null)
  const [jointObjects, setJointObjects] = useState(() => new Map<string, THREE.Object3D>())
  const [isGizmoDragging, setIsGizmoDragging] = useState(false)

  const handleJointRef = (figureId: string, jointName: string, object: THREE.Group | null) => {
    const key = `${figureId}:${jointName}`
    setJointObjects((previous) => {
      const next = new Map(previous)
      if (object) next.set(key, object)
      else next.delete(key)
      return next
    })
  }

  // Girar a raiz precisa do grupo INTERNO (o que carrega `figure.rotation`);
  // mover precisa do externo (que carrega `figure.position`) — ver
  // `ROOT_PIVOT_REF_NAME` e DECISOES.md #7.
  const gizmoJointKey =
    selectedJointName === ROOT_JOINT_NAME && rootGizmoMode === 'rotate'
      ? ROOT_PIVOT_REF_NAME
      : selectedJointName

  const gizmoTarget =
    selectedFigureId && gizmoJointKey
      ? (jointObjects.get(`${selectedFigureId}:${gizmoJointKey}`) ?? null)
      : null

  // Qual posição o indicador de alinhamento acompanha (fase 9, item 10): a
  // colocação do boneco, ou o alvo de IK quando é ele que está sendo
  // arrastado. Rotação da raiz e rotação de junta não mexem em X/Z, então não
  // acendem nada.
  const selectedFigure = figures.find((figure) => figure.id === selectedFigureId)
  const draggedPosition: readonly [number, number, number] | null =
    limbIKEnabled && limbEndEffector
      ? (ikTarget ?? null)
      : selectedJointName === ROOT_JOINT_NAME && rootGizmoMode === 'translate' && selectedFigure
        ? selectedFigure.position
        : null

  return (
    <div className="viewport" role="img" aria-label={t('viewport.label')}>
      <Canvas
        shadows
        camera={{ position: CAMERA_DEFAULTS.position, fov: CAMERA_DEFAULTS.fov }}
        onPointerMissed={() => selectFigure(null)}
      >
        <color attach="background" args={[BACKGROUND_COLORS[environment.background]]} />
        <SceneContent grid={environment.grid} />
        {/* Ancorada no boneco selecionado, no mesmo ponto do gizmo de
            translação; sem seleção não há o que medir (DECISOES.md #33). */}
        {rulerVisible && <VerticalRuler position={selectedFigure?.position ?? null} />}
        {/* Só enquanto se arrasta: fora do arrasto o destaque seria ruído
            permanente na tela (fase 9, item 10). */}
        {isGizmoDragging && draggedPosition && <GridAlignmentIndicator position={draggedPosition} />}
        {/* Os bonecos assinam as lojas LÁ DENTRO, em vez de descer daqui como
            `children`: é o que permite ao exportador de vídeo commitar a cena
            de cada quadro de forma síncrona (ver `SceneFigures.tsx`). */}
        <SceneFigures onJointRef={handleJointRef} />
        {/* Papel-cebola (item 31) DEPOIS dos bonecos: os fantasmas são
            translúcidos e sem escrita de profundidade, e desenhar por último é
            o que os deixa somar por cima em vez de recortar a cena. */}
        <OnionSkin />
        {gizmoTarget && selectedFigureId && selectedJointName && !isIKControlledJoint && (
          <SelectionGizmo
            figureId={selectedFigureId}
            jointName={selectedJointName}
            target={gizmoTarget}
            rootMode={rootGizmoMode}
            onDraggingChange={setIsGizmoDragging}
          />
        )}
        {selectedFigureId && limbEndEffector && limbIKEnabled && (
          <IKTargetGizmo
            figureId={selectedFigureId}
            endEffector={limbEndEffector}
            onDraggingChange={setIsGizmoDragging}
          />
        )}
        <CameraRig controlsRef={orbitControlsRef} />
        <FrameMaskCamera controlsRef={orbitControlsRef} />
        <AnimationPlayer controlsRef={orbitControlsRef} />
        <SnapshotCapture />
        {/* Órbita desligada enquanto a animação toca: a câmera é dela, e
            arrastar no meio disputaria o mesmo objeto. */}
        <OrbitControls ref={orbitControlsRef} makeDefault enabled={!isGizmoDragging && !animationPlaying} />
      </Canvas>
      {/* Por CIMA da tela de desenho, e nunca dentro dela: o que a máscara
          escurece não entra no PNG nem no MP4. */}
      <FrameMaskOverlay />
    </div>
  )
}

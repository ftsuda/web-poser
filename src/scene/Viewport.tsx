import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type * as THREE from 'three'
import { useTranslation } from 'react-i18next'
import { ROOT_PIVOT_REF_NAME } from '../figure/Figure'
import { isDraggableJoint } from '../figure/dragSolver'
import { ROOT_JOINT_NAME } from '../figure/skeleton'
import { useFiguresStore } from '../store/figuresStore'
import { useCameraStore } from '../store/cameraStore'
import { selectTarget } from '../store/selection'
import { useUIStore } from '../store/uiStore'
import { AnimationPlayer } from './AnimationPlayer'
import { CameraRig } from './CameraRig'
import { SceneCameraGizmo } from './SceneCameraGizmo'
import { FrameMaskCamera } from './FrameMaskCamera'
import { FrameMaskOverlay } from './FrameMaskOverlay'
import { BACKGROUND_COLORS, CAMERA_DEFAULTS } from './constants'
import { GridAlignmentIndicator } from './GridAlignmentIndicator'
import { JointDragGizmo } from './JointDragGizmo'
import { SnapshotCapture } from './SnapshotCapture'
import { SceneContent } from './SceneContent'
import { getViewportOrthographicCamera, getViewportPerspectiveCamera } from './viewportCameras'
import { OnionSkin } from './OnionSkin'
import { SceneFigures } from './SceneFigures'
import { SceneProps } from './SceneProps'
import { SelectionGizmo } from './SelectionGizmo'
import { VerticalRuler } from './VerticalRuler'

export function Viewport() {
  const { t } = useTranslation()
  const environment = useFiguresStore((state) => state.environment)
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const selectedPropId = useFiguresStore((state) => state.selectedPropId)
  const selectedJointName = useFiguresStore((state) => state.selectedJointName)
  const gizmoMode = useUIStore((state) => state.gizmoMode)
  const rulerVisible = useUIStore((state) => state.rulerVisible)
  const viewMode = useCameraStore((state) => state.viewMode)
  const projection = useCameraStore((state) => state.projection)
  const setCameraSelected = useCameraStore((state) => state.setCameraSelected)

  const orbitControlsRef = useRef<OrbitControlsImpl>(null)
  const [jointObjects, setJointObjects] = useState(() => new Map<string, THREE.Object3D>())
  const [isGizmoDragging, setIsGizmoDragging] = useState(false)

  // Seleção exclusiva (fase 11, estendida no item 42): escolher um boneco OU um
  // objeto de cena desseleciona a câmera. É a rede de segurança para quem
  // chama `selectFigure`/`selectProp` direto (o clique no viewport e os
  // painéis); o caminho canônico é o `selectTarget` de `store/selection.ts`.
  useEffect(() => {
    if (selectedFigureId || selectedPropId) setCameraSelected(false)
  }, [selectedFigureId, selectedPropId, setCameraSelected])

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
    selectedJointName === ROOT_JOINT_NAME && gizmoMode === 'rotate'
      ? ROOT_PIVOT_REF_NAME
      : selectedJointName

  const gizmoTarget =
    selectedFigureId && gizmoJointKey
      ? (jointObjects.get(`${selectedFigureId}:${gizmoJointKey}`) ?? null)
      : null

  // Modo W/E numa junta arrastável mostra o gizmo de translação de junta
  // (arrasto de cadeia, `dragSolver.ts`) em vez do de rotação; juntas sem
  // arrasto (mão/dedos, spine/hip.*) mostram rotação nos dois modos.
  const useJointDrag =
    selectedJointName !== null &&
    selectedJointName !== ROOT_JOINT_NAME &&
    gizmoMode === 'translate' &&
    isDraggableJoint(selectedJointName)

  // Qual posição o indicador de alinhamento acompanha (fase 9, item 10): só a
  // colocação do boneco no chão — rotações e arrasto de junta não mexem na
  // colocação em X/Z, então não acendem nada.
  const selectedFigure = figures.find((figure) => figure.id === selectedFigureId)
  const draggedPosition: readonly [number, number, number] | null =
    selectedJointName === ROOT_JOINT_NAME && gizmoMode === 'translate' && selectedFigure
      ? selectedFigure.position
      : null

  return (
    <div className="viewport" role="img" aria-label={t('viewport.label')}>
      <Canvas
        shadows
        camera={{ position: CAMERA_DEFAULTS.position, fov: CAMERA_DEFAULTS.fov }}
        onPointerMissed={() => selectTarget(null)}
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
        {/* Objetos de cena (item 42) — cenário, e portanto conteúdo: entram
            na cena como os bonecos, e não como apoio de tela. */}
        <SceneProps onDraggingChange={setIsGizmoDragging} />
        {/* Papel-cebola (item 31) DEPOIS dos bonecos: os fantasmas são
            translúcidos e sem escrita de profundidade, e desenhar por último é
            o que os deixa somar por cima em vez de recortar a cena. */}
        <OnionSkin />
        {gizmoTarget && selectedFigureId && selectedJointName && !useJointDrag && (
          <SelectionGizmo
            figureId={selectedFigureId}
            jointName={selectedJointName}
            target={gizmoTarget}
            rootMode={gizmoMode}
            onDraggingChange={setIsGizmoDragging}
          />
        )}
        {gizmoTarget && selectedFigureId && selectedJointName && useJointDrag && (
          <JointDragGizmo
            figureId={selectedFigureId}
            jointName={selectedJointName}
            jointObject={gizmoTarget}
            onDraggingChange={setIsGizmoDragging}
          />
        )}
        {/* A câmera de cena como elemento visível da bancada (fase 11):
            clicável, arrastável e girável como um boneco. */}
        <SceneCameraGizmo onDraggingChange={setIsGizmoDragging} />
        <CameraRig controlsRef={orbitControlsRef} />
        <FrameMaskCamera controlsRef={orbitControlsRef} />
        <AnimationPlayer />
        <SnapshotCapture />
        {/* Órbita só no modo edição: no modo visão-câmera a vista é o quadro
            da câmera de cena, travado (ajustes pelo painel ou pelo gizmo, de
            volta na edição). Durante a REPRODUÇÃO a bancada fica livre — a
            animação move a câmera de cena, não mais a vista de trabalho.
            A prop `camera` é EXPLÍCITA e sempre aponta para a câmera da
            bancada: sem ela o drei rebinda os controles na câmera padrão do
            R3F, e entrar no modo visão-câmera fazia o `update()` da órbita
            torcer a câmera de cena para o alvo antigo (ver viewportCameras.ts). */}
        <OrbitControls
          ref={orbitControlsRef}
          camera={projection === 'orthographic' ? getViewportOrthographicCamera() : getViewportPerspectiveCamera()}
          makeDefault
          enabled={!isGizmoDragging && viewMode === 'edit'}
        />
      </Canvas>
      {/* Por CIMA da tela de desenho, e nunca dentro dela: o que a máscara
          escurece não entra no PNG nem no MP4. */}
      <FrameMaskOverlay />
      {/* Aviso de modo (fase 11): destacado no modo visão-câmera, discreto na
          edição — o usuário sempre sabe por qual olho está olhando. */}
      <div
        className={`viewport__mode-badge viewport__mode-badge--${viewMode}`}
        role="status"
      >
        {t(viewMode === 'camera' ? 'viewport.modeCamera' : 'viewport.modeEdit')}
      </div>
    </div>
  )
}

import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type * as THREE from 'three'
import { useTranslation } from 'react-i18next'
import { Figure } from '../figure/Figure'
import { getLimbEndEffector } from '../figure/ikSolver'
import { useFiguresStore } from '../store/figuresStore'
import { useIKStore } from '../store/ikStore'
import { CameraRig } from './CameraRig'
import { BACKGROUND_COLORS, CAMERA_DEFAULTS } from './constants'
import { IKTargetGizmo } from './IKTargetGizmo'
import { KeyframeCapture } from './KeyframeCapture'
import { SceneContent } from './SceneContent'
import { SelectionGizmo } from './SelectionGizmo'

export function Viewport() {
  const { t } = useTranslation()
  const environment = useFiguresStore((state) => state.environment)
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const selectedJointName = useFiguresStore((state) => state.selectedJointName)
  const selectFigure = useFiguresStore((state) => state.selectFigure)
  const selectJoint = useFiguresStore((state) => state.selectJoint)

  const limbEndEffector = selectedJointName ? getLimbEndEffector(selectedJointName) : null
  const limbIKEnabled = useIKStore((state) =>
    selectedFigureId && limbEndEffector ? state.isLimbEnabled(selectedFigureId, limbEndEffector) : false,
  )
  // Ombro/cotovelo (ou quadril/joelho) perdem o gizmo de rotação FK enquanto
  // o membro está em IK — só o pulso/tornozelo (junta-efetuador) continua
  // com seu próprio gizmo, já que tem grau de liberdade que o IK não cobre
  // (torção) — mesma regra da fase 3 do painel de Propriedades.
  const isIKControlledJoint = limbIKEnabled && limbEndEffector !== null && selectedJointName !== limbEndEffector

  const orbitControlsRef = useRef<OrbitControlsImpl>(null)
  const [jointObjects, setJointObjects] = useState(() => new Map<string, THREE.Object3D>())
  const [isGizmoDragging, setIsGizmoDragging] = useState(false)

  const handleSelectJoint = (figureId: string, jointName: string) => {
    if (selectedFigureId !== figureId) selectFigure(figureId)
    selectJoint(jointName)
  }

  const handleJointRef = (figureId: string, jointName: string, object: THREE.Group | null) => {
    const key = `${figureId}:${jointName}`
    setJointObjects((previous) => {
      const next = new Map(previous)
      if (object) next.set(key, object)
      else next.delete(key)
      return next
    })
  }

  const gizmoTarget =
    selectedFigureId && selectedJointName
      ? (jointObjects.get(`${selectedFigureId}:${selectedJointName}`) ?? null)
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
        {figures.map((figure) => (
          <Figure
            key={figure.id}
            figure={figure}
            selectedJointName={figure.id === selectedFigureId ? selectedJointName : null}
            onSelectJoint={(jointName) => handleSelectJoint(figure.id, jointName)}
            onJointRef={(jointName, object) => handleJointRef(figure.id, jointName, object)}
          />
        ))}
        {gizmoTarget && selectedFigureId && selectedJointName && !isIKControlledJoint && (
          <SelectionGizmo
            figureId={selectedFigureId}
            jointName={selectedJointName}
            target={gizmoTarget}
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
        <KeyframeCapture />
        <OrbitControls ref={orbitControlsRef} makeDefault enabled={!isGizmoDragging} />
      </Canvas>
    </div>
  )
}

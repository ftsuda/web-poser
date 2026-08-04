import { useTranslation } from 'react-i18next'
import {
  ROOT_JOINT_NAME,
  getDefaultJointLimits,
  getJointAxes,
  type Axis,
} from '../figure/skeleton'
import { JOINT_GROUPS } from '../figure/jointGroups'
import { getLockedRootAxes, rootAxisLockToken } from '../figure/jointLocks'
import { frozenJointsByPins, isPlacementPinned } from '../figure/jointPins'
import { resolvePosePreset } from '../figure/posePresets'
import { JOINT_GROUP_LABEL_KEYS } from '../layout/jointGroupLabels'
import { effectiveLockedJoints, useFiguresStore } from '../store/figuresStore'
import { usePosesShellStore } from '../store/posesShellStore'
import { UNDO_BATCH_POINTER_PROPS } from '../store/undoBatch'
import { AXIS_COLORS } from './gizmoStyle'
import { isNudgeableJoint, nudgeJoint } from './posesEdit'
import { POSES_VIEWS } from './posesViews'
import type { NudgeDirection } from './posesViews'

/**
 * Aba "Junta" do módulo de poses: trava, reset, as SETAS (o arrasto em
 * passos, ver `posesEdit.ts`) e um slider de ROTAÇÃO POR EIXO de DOF (item
 * 60) — a antiga torção era só o eixo Y destes; o gesto de dois dedos no
 * viewport continua nele (`jointTwist.ts`). As cores por eixo são as mesmas
 * do gizmo e dos anéis gimbal (`gizmoStyle.ts`). Tudo chama ações que já
 * existem no `figuresStore`; nenhuma rotina nova de edição.
 */

/** Passos dos botões de ajuste fino ao lado dos sliders (item 51): dedo em slider é impreciso. */
const FINE_DELTAS = [-5, -1, 1, 5] as const

/** Eixos da raiz: rotação de colocação, livre nos três (sem limite articular). */
const ROOT_AXES: readonly Axis[] = ['x', 'y', 'z']

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`
}
export function PosesJointTab() {
  const { t } = useTranslation()
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const selectedJointName = useFiguresStore((state) => state.selectedJointName)
  const jointLocks = useFiguresStore((state) => state.jointLocks)
  const jointPins = useFiguresStore((state) => state.jointPins)
  const jointLimits = useFiguresStore((state) => state.jointLimits)
  const selectJoint = useFiguresStore((state) => state.selectJoint)
  const toggleJointLock = useFiguresStore((state) => state.toggleJointLock)
  const clearJointLocks = useFiguresStore((state) => state.clearJointLocks)
  const toggleJointPin = useFiguresStore((state) => state.toggleJointPin)
  const clearJointPins = useFiguresStore((state) => state.clearJointPins)
  const resetJointRotation = useFiguresStore((state) => state.resetJointRotation)
  const setJointRotation = useFiguresStore((state) => state.setJointRotation)
  const setJointRotations = useFiguresStore((state) => state.setJointRotations)
  const setRootRotation = useFiguresStore((state) => state.setRootRotation)
  const setPosition = useFiguresStore((state) => state.setPosition)
  const viewKey = usePosesShellStore((state) => state.viewKey)
  const freeEditEnabled = usePosesShellStore((state) => state.freeEditEnabled)

  const figure = figures.find((candidate) => candidate.id === selectedFigureId) ?? null
  if (!figure) {
    return <p className="poses-tab__empty">{t('poses.joint.noFigure')}</p>
  }

  const joint = selectedJointName
  const isRoot = joint === ROOT_JOINT_NAME
  const lockedJoints = jointLocks[figure.id] ?? []
  const locked = joint ? lockedJoints.includes(joint) : false
  // Trava por eixo da raiz (item 64): um cadeado por slider, no lugar do
  // botão geral — que nunca funcionou na raiz (`toggleJointLock` a ignora).
  const lockedRootAxes = getLockedRootAxes(jointLocks, figure.id)
  // Âncora (item 62): a própria junta ancorada, as congeladas por ela (os
  // ancestrais) e a colocação — cada uma desabilita um pedaço diferente.
  const pinned = joint ? (jointPins[figure.id] ?? []).includes(joint) : false
  const frozen = joint ? frozenJointsByPins(jointPins, figure.id).includes(joint) : false
  const placementPinned = isPlacementPinned(jointPins, figure.id)
  const viewEditable = POSES_VIEWS[viewKey].editable

  const handleNudge = (direction: NudgeDirection) => {
    if (!joint) return
    const held = effectiveLockedJoints({ jointLocks, jointPins }, figure.id)
    const edit = nudgeJoint(viewKey, figure, joint, direction, held)
    if (!edit) return
    if (edit.kind === 'position') setPosition(figure.id, edit.position)
    else setJointRotations(figure.id, edit.rotations, edit.rootRotation)
  }

  // Setas mortas: raiz com colocação congelada, ou junta cuja cadeia inteira
  // está congelada (a ancorada e as acima dela) — desabilitar diz o porquê
  // antes de o toque não fazer nada.
  const nudgeBlocked = isRoot ? placementPinned : pinned || frozen

  // Um slider por eixo de DOF (item 60): a raiz gira livre nos três; as
  // demais mostram só o que a junta tem (o joelho, dobradiça, tem um único).
  const rotationAxes: readonly Axis[] = joint ? (isRoot ? ROOT_AXES : getJointAxes(joint)) : []

  /** ⟲ do item 61: devolve SÓ um eixo à referência — a MESMA do `resetJointRotation`. */
  const handleAxisReset = (axis: Axis) => {
    if (!joint) return
    if (isRoot) {
      setRootRotation(figure.id, { [axis]: 0 })
      return
    }
    const reference = resolvePosePreset('standing')[joint]?.[axis] ?? 0
    setJointRotation(figure.id, joint, { [axis]: reference })
  }

  return (
    <div className="poses-tab">
      {/* O MESMO combo de juntas do painel de Propriedades do desktop —
          mesmos grupos (`JOINT_GROUPS`), mesmos rótulos de optgroup. Tocar na
          junta no viewport e escolher aqui são o mesmo `selectJoint`. */}
      <label className="poses-tab__field" htmlFor="poses-joint-select">
        {t('panels.properties.jointSelect')}
        <select
          id="poses-joint-select"
          value={joint ?? ''}
          onChange={(event) => selectJoint(event.target.value === '' ? null : event.target.value)}
        >
          {!joint && <option value="">{t('poses.joint.selectPlaceholder')}</option>}
          <option value={ROOT_JOINT_NAME}>{t('panels.properties.jointSelectRoot')}</option>
          {JOINT_GROUPS.map((group) => (
            <optgroup key={group.key} label={t(JOINT_GROUP_LABEL_KEYS[group.key])}>
              {group.joints.map((jointName) => (
                <option key={jointName} value={jointName}>
                  {jointName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {!joint && <p className="poses-tab__empty">{t('poses.joint.none')}</p>}

      {joint && (
        <>
          {/* Na raiz o botão geral de travar não existe (item 64): os
              cadeados são por eixo, nos sliders lá embaixo — e "Destravar
              todas" solta também esses. */}
          {isRoot ? (
            <button type="button" className="panel-action" onClick={() => clearJointLocks(figure.id)}>
              {t('poses.joint.clearLocks')}
            </button>
          ) : (
            <div className="panel-actions">
              <button type="button" onClick={() => toggleJointLock(figure.id, joint)}>
                {locked ? t('poses.joint.unlock') : t('poses.joint.lock')}
              </button>
              <button type="button" onClick={() => clearJointLocks(figure.id)}>
                {t('poses.joint.clearLocks')}
              </button>
            </div>
          )}
          {/* Âncora (item 62), par do cadeado: cadeado congela os ÂNGULOS da
              junta; âncora congela a POSIÇÃO (ancestrais + colocação). */}
          <div className="panel-actions">
            <button
              type="button"
              disabled={isRoot}
              onClick={() => toggleJointPin(figure.id, joint)}
            >
              {pinned ? t('poses.joint.unpin') : t('poses.joint.pin')}
            </button>
            <button type="button" onClick={() => clearJointPins(figure.id)}>
              {t('poses.joint.clearPins')}
            </button>
          </div>
          {pinned && <p className="poses-tab__hint">{t('poses.joint.pinnedHint')}</p>}
          {frozen && !pinned && <p className="poses-tab__hint">{t('poses.joint.frozenHint')}</p>}
          {isRoot && placementPinned && (
            <p className="poses-tab__hint">{t('poses.joint.rootPinnedHint')}</p>
          )}
          <button
            type="button"
            className="panel-action"
            onClick={() => resetJointRotation(figure.id, joint)}
          >
            {t('poses.joint.reset')}
          </button>

          {!viewEditable ? (
            // As setas do painel não existem na Livre nem destravada (decisão
            // do usuário, #93): lá a translação fina é o gizmo do viewport.
            <p className="poses-tab__hint">
              {t(freeEditEnabled ? 'poses.joint.freeViewGizmoHint' : 'poses.joint.freeViewHint')}
            </p>
          ) : isNudgeableJoint(joint) ? (
            <div className="poses-nudge" role="group" aria-label={t('poses.joint.nudgeGroup')}>
              <button type="button" className="poses-nudge__up" disabled={nudgeBlocked} onClick={() => handleNudge('up')}>
                {t('poses.joint.nudgeUp')}
              </button>
              <button type="button" className="poses-nudge__left" disabled={nudgeBlocked} onClick={() => handleNudge('left')}>
                {t('poses.joint.nudgeLeft')}
              </button>
              <button type="button" className="poses-nudge__right" disabled={nudgeBlocked} onClick={() => handleNudge('right')}>
                {t('poses.joint.nudgeRight')}
              </button>
              <button type="button" className="poses-nudge__down" disabled={nudgeBlocked} onClick={() => handleNudge('down')}>
                {t('poses.joint.nudgeDown')}
              </button>
            </div>
          ) : (
            <p className="poses-tab__hint">{t('poses.joint.nudgeUnavailable')}</p>
          )}

          {rotationAxes.map((axis) => {
            // A raiz gira livre (colocação, sem limite articular); as juntas
            // usam os limites EFETIVOS — o override do workspace vale aqui.
            const limit = isRoot
              ? { min: -180, max: 180 }
              : (jointLimits[joint]?.[axis] ??
                getDefaultJointLimits(joint)[axis] ?? { min: -180, max: 180 })
            const value = isRoot ? figure.rotation[axis] : (figure.pose[joint]?.[axis] ?? 0)
            // Raiz: colocação congelada por âncora OU eixo com o próprio
            // cadeado (item 64); junta: trava OU congelada pela âncora de uma
            // junta abaixo (a ancorada em si segue livre).
            const axisLocked = isRoot && lockedRootAxes.includes(axis)
            const disabled = isRoot ? placementPinned || axisLocked : locked || frozen
            const axisLabel = axis.toUpperCase()
            const setAxis = (next: number) => {
              const clamped = Math.min(limit.max, Math.max(limit.min, next))
              if (isRoot) setRootRotation(figure.id, { [axis]: clamped })
              else setJointRotation(figure.id, joint, { [axis]: clamped })
            }
            const fineButton = (delta: number) => (
              <button
                key={delta}
                type="button"
                disabled={disabled}
                aria-label={t('poses.joint.rotationDelta', {
                  axis: axisLabel,
                  delta: formatDelta(delta),
                })}
                onClick={() => setAxis(value + delta)}
              >
                {formatDelta(delta)}°
              </button>
            )
            return (
              <div key={axis} className="poses-slider-block">
                <label className="poses-tab__slider">
                  <span style={{ color: AXIS_COLORS[axis] }}>
                    {t('poses.joint.rotation', { axis: axisLabel, value: Math.round(value) })}
                  </span>
                  <input
                    type="range"
                    min={limit.min}
                    max={limit.max}
                    step={1}
                    value={value}
                    disabled={disabled}
                    style={{ accentColor: AXIS_COLORS[axis] }}
                    onChange={(event) => setAxis(Number(event.target.value))}
                    // Um passo de undo por arrasto do slider (DECISOES.md #118).
                    {...UNDO_BATCH_POINTER_PROPS}
                  />
                </label>
                {/* [−5°, −1°, ⟲, +1°, +5°] — o ⟲ no meio devolve SÓ este eixo
                    ao valor inicial (item 61). Na raiz a linha ganha o CADEADO
                    DO EIXO (item 64) na ponta — mesmo rótulo do desktop. */}
                <div className={`poses-fine${isRoot ? ' poses-fine--root' : ''}`}>
                  {FINE_DELTAS.slice(0, 2).map(fineButton)}
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={t('poses.joint.rotationReset', { axis: axisLabel })}
                    onClick={() => handleAxisReset(axis)}
                  >
                    ⟲
                  </button>
                  {FINE_DELTAS.slice(2).map(fineButton)}
                  {isRoot && (
                    <button
                      type="button"
                      aria-pressed={axisLocked}
                      aria-label={t(
                        axisLocked
                          ? 'panels.properties.unlockRootAxis'
                          : 'panels.properties.lockRootAxis',
                        { axis: axisLabel },
                      )}
                      onClick={() => toggleJointLock(figure.id, rootAxisLockToken(axis))}
                    >
                      {axisLocked ? '\u{1F512}' : '\u{1F513}'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

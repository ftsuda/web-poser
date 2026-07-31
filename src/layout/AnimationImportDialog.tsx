import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { animationDurationMs, keyframeStartTimesMs, type AnimationKeyframe } from '../animation/animation'
import { importedAnimationRoles } from '../animation/animationRemap'
import type { ImportedAnimation } from '../persistence/animationsFile'
import type { AnimationImportMode, Figure } from '../store/figuresStore'
import { ModalDialog } from './ModalDialog'

/**
 * O que fazer com a animação lida de um arquivo (fase 12). O arquivo não entra
 * na biblioteca: ou ele SUBSTITUI a animação de trabalho, ou é ANEXADO ao final
 * dela — e quem decide é quem importa, aqui (decisão do usuário).
 *
 * A outra escolha é de elenco: **remapear** para os bonecos que já estão em
 * cena (o padrão — a animação é uma coreografia, e quem a executa são os seus
 * bonecos) ou **recriar** os bonecos gravados, que é o modo fiel aos nomes,
 * cores e alturas de origem e a única saída quando a cena tem menos bonecos do
 * que a animação usa.
 *
 * **Terceira saída (pedido do usuário, 2026-07-31): enxertar.** Em vez de
 * escrever a linha do tempo, o arquivo entra A PARTIR de um keyframe escolhido,
 * trocando só as poses dos bonecos que receberam papel — e as câmeras, se a
 * caixa estiver marcada. Os papéis sem boneco ("— ninguém —") são justamente os
 * bonecos de ORIGEM que ficam de fora; o combo de cada papel é quem escolhe o
 * boneco de DESTINO. É o gesto de trocar a coreografia de um figurante no meio
 * de uma cena já montada, sem remontar o resto dela.
 */

/** Segundos com uma casa, como no resto do painel de animação. */
function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

/** As opções extras do enxerto — só valem no modo `substitute`. */
export interface SubstituteChoice {
  startIndex: number
  replaceCamera: boolean
}

interface AnimationImportDialogProps {
  imported: ImportedAnimation
  sceneFigures: readonly Figure[]
  /** Os keyframes da bancada: sem eles não há onde anexar nem o que enxertar. */
  workingKeyframes: readonly AnimationKeyframe[]
  onConfirm: (
    mode: AnimationImportMode,
    assignment: readonly string[] | null,
    substitute?: SubstituteChoice,
  ) => void
  onCancel: () => void
}

export function AnimationImportDialog({
  imported,
  sceneFigures,
  workingKeyframes,
  onConfirm,
  onCancel,
}: AnimationImportDialogProps) {
  const { t } = useTranslation()

  const roles = importedAnimationRoles(imported.keyframes)
  const enoughFigures = sceneFigures.length >= roles.length && roles.length > 0
  const hasWorkingKeyframes = workingKeyframes.length > 0

  const [remap, setRemap] = useState(enoughFigures)
  const [assignment, setAssignment] = useState<string[]>(() =>
    roles.map((_, role) => sceneFigures[role]?.id ?? ''),
  )
  /** Onde o enxerto começa, e se as câmeras gravadas entram junto com as poses. */
  const [startIndex, setStartIndex] = useState(0)
  const [replaceCamera, setReplaceCamera] = useState(true)

  const durationMs = animationDurationMs({ id: '', name: imported.name, speed: imported.speed, keyframes: imported.keyframes })
  const startTimes = keyframeStartTimesMs({ id: '', name: '', speed: 1, keyframes: [...workingKeyframes] })

  // Enxertar precisa do remapeamento: é o mapa papel → boneco que diz quem sai
  // e quem entra. "Recriar os gravados" traz o elenco do arquivo, e trocar o
  // elenco no meio de uma linha do tempo não é enxerto, é outra animação.
  const canSubstitute = hasWorkingKeyframes && remap && assignment.some((id) => id !== '')
  // Quanto o enxerto passa do fim da linha do tempo — o que não couber vira
  // keyframe novo, e é melhor dizer isso antes do clique.
  const overflow = Math.max(0, startIndex + imported.keyframes.length - workingKeyframes.length)

  const confirm = (mode: AnimationImportMode) => {
    onConfirm(mode, remap ? assignment : null, { startIndex, replaceCamera })
  }

  return (
    <ModalDialog
      title={t('panels.animation.importTitle')}
      className="animation-import"
      onCancel={onCancel}
    >
      <p className="animation-import__summary">
        {t('panels.animation.importSummary', {
          name: imported.name,
          count: imported.keyframes.length,
          duration: formatSeconds(durationMs),
          figures: roles.length,
        })}
      </p>

      <fieldset className="animation-import__cast">
        <legend>{t('panels.animation.importCast')}</legend>

        <label className="animation-import__option">
          <input
            type="radio"
            name="animation-import-cast"
            checked={remap}
            disabled={!enoughFigures}
            onChange={() => setRemap(true)}
          />
          {t('panels.animation.importRemap')}
        </label>
        <label className="animation-import__option">
          <input
            type="radio"
            name="animation-import-cast"
            checked={!remap}
            onChange={() => setRemap(false)}
          />
          {t('panels.animation.importRecreate')}
        </label>

        <p className="animation-panel__hint">
          {remap ? t('panels.animation.importRemapHint') : t('panels.animation.importRecreateHint')}
        </p>

        {!enoughFigures && (
          <p role="alert" className="animation-panel__hint">
            {t('panels.animation.importNotEnoughFigures', {
              needed: roles.length,
              available: sceneFigures.length,
            })}
          </p>
        )}
      </fieldset>

      {remap && (
        <fieldset className="animation-import__roles">
          <legend>{t('panels.animation.importRoles')}</legend>
          {roles.map((role, index) => (
            <label
              key={role.id}
              htmlFor={`animation-import-role-${index}`}
              className="animation-panel__field"
            >
              {t('panels.animation.importRole', { role: index + 1, name: role.name })}
              <select
                id={`animation-import-role-${index}`}
                value={assignment[index] ?? ''}
                onChange={(event) =>
                  setAssignment((current) =>
                    current.map((id, position) => (position === index ? event.target.value : id)),
                  )
                }
              >
                <option value="">{t('panels.animation.importRoleNobody')}</option>
                {sceneFigures.map((figure) => (
                  <option key={figure.id} value={figure.id}>
                    {figure.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p className="animation-panel__hint">{t('panels.animation.importRolesHint')}</p>
        </fieldset>
      )}

      {/* Enxerto (pedido do usuário): a faixa começa no keyframe escolhido e
          vai até onde o arquivo alcançar. Só aparece com bancada montada —
          sobre a linha do tempo vazia não há o que substituir. */}
      {hasWorkingKeyframes && (
        <fieldset className="animation-import__graft">
          <legend>{t('panels.animation.importSubstituteFrom')}</legend>

          <label htmlFor="animation-import-start" className="animation-panel__field">
            {t('panels.animation.importStartKeyframe')}
            <select
              id="animation-import-start"
              value={startIndex}
              onChange={(event) => setStartIndex(Number(event.target.value))}
            >
              {workingKeyframes.map((keyframe, index) => (
                <option key={keyframe.id} value={index}>
                  {`${index + 1} — ${formatSeconds(startTimes[index])}`}
                </option>
              ))}
            </select>
          </label>

          <label className="animation-import__option">
            <input
              type="checkbox"
              checked={replaceCamera}
              onChange={(event) => setReplaceCamera(event.target.checked)}
            />
            {t('panels.animation.importSubstituteCamera')}
          </label>

          <p className="animation-panel__hint">
            {replaceCamera
              ? t('panels.animation.importSubstituteHint')
              : t('panels.animation.importSubstituteKeepCameraHint')}
          </p>

          {overflow > 0 && (
            <p className="animation-panel__hint">
              {t('panels.animation.importSubstituteOverflow', { count: overflow })}
            </p>
          )}

          {!remap && (
            <p className="animation-panel__hint">{t('panels.animation.importSubstituteNeedsRemap')}</p>
          )}
        </fieldset>
      )}

      <div className="animation-import__actions">
        <button type="button" onClick={() => confirm('replace')} title={t('panels.animation.importReplaceHint')}>
          {t('panels.animation.importReplace')}
        </button>
        <button
          type="button"
          onClick={() => confirm('append')}
          disabled={!hasWorkingKeyframes}
          title={t('panels.animation.importAppendHint')}
        >
          {t('panels.animation.importAppend')}
        </button>
        {hasWorkingKeyframes && (
          <button
            type="button"
            onClick={() => confirm('substitute')}
            disabled={!canSubstitute}
            title={t('panels.animation.importSubstituteHint')}
          >
            {t('panels.animation.importSubstitute', { index: startIndex + 1 })}
          </button>
        )}
        <button type="button" onClick={onCancel}>
          {t('panels.animation.importCancel')}
        </button>
      </div>

      {!hasWorkingKeyframes && (
        <p className="animation-panel__hint">{t('panels.animation.importAppendEmpty')}</p>
      )}
    </ModalDialog>
  )
}

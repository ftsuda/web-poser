import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { animationDurationMs } from '../animation/animation'
import { importedAnimationRoles } from '../animation/animationRemap'
import type { ImportedAnimation } from '../persistence/animationsFile'
import { useUIStore } from '../store/uiStore'
import type { AnimationImportMode, Figure } from '../store/figuresStore'

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
 */

/** Segundos com uma casa, como no resto do painel de animação. */
function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

interface AnimationImportDialogProps {
  imported: ImportedAnimation
  sceneFigures: readonly Figure[]
  /** Há keyframes na bancada? Sem eles não há onde anexar. */
  hasWorkingKeyframes: boolean
  onConfirm: (mode: AnimationImportMode, assignment: readonly string[] | null) => void
  onCancel: () => void
}

export function AnimationImportDialog({
  imported,
  sceneFigures,
  hasWorkingKeyframes,
  onConfirm,
  onCancel,
}: AnimationImportDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const setModalOpen = useUIStore((state) => state.setModalOpen)

  const roles = importedAnimationRoles(imported.keyframes)
  const enoughFigures = sceneFigures.length >= roles.length && roles.length > 0

  const [remap, setRemap] = useState(enoughFigures)
  const [assignment, setAssignment] = useState<string[]>(() =>
    roles.map((_, role) => sceneFigures[role]?.id ?? ''),
  )

  useEffect(() => {
    setModalOpen(true)
    return () => setModalOpen(false)
  }, [setModalOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    // `showModal` dá modalidade e backdrop de verdade no navegador; o jsdom
    // (29) não o implementa, e ali o `open` do JSX já basta para o diálogo
    // existir na árvore. Um só caminho de código, os dois ambientes atendidos.
    if (!dialog || typeof dialog.showModal !== 'function') return
    if (dialog.open) dialog.close()
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const durationMs = animationDurationMs({ id: '', name: imported.name, speed: imported.speed, keyframes: imported.keyframes })

  const confirm = (mode: AnimationImportMode) => {
    onConfirm(mode, remap ? assignment : null)
  }

  // Escape cancela também quando o diálogo não é modal de verdade (jsdom, ou
  // navegador sem `showModal`); `stopPropagation` impede que a mesma tecla
  // escape para os atalhos globais.
  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    event.preventDefault()
    onCancel()
  }

  return (
    <dialog
      open
      ref={dialogRef}
      className="animation-import"
      aria-label={t('panels.animation.importTitle')}
      onCancel={onCancel}
      onKeyDown={handleKeyDown}
    >
      <h2 className="animation-import__title">{t('panels.animation.importTitle')}</h2>

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
        <button type="button" onClick={onCancel}>
          {t('panels.animation.importCancel')}
        </button>
      </div>

      {!hasWorkingKeyframes && (
        <p className="animation-panel__hint">{t('panels.animation.importAppendEmpty')}</p>
      )}
    </dialog>
  )
}

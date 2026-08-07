import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { findWorkingAnimation } from '../animation/animation'
import { ConfirmDialog } from '../layout/ConfirmDialog'
import { goToKeyframeFigures, restoreStash } from '../animation/sceneStashActions'
import { useAnimationStore } from '../store/animationStore'
import { useFiguresStore } from '../store/figuresStore'
import { usePosesShellStore } from '../store/posesShellStore'
import { useSceneStashStore } from '../store/sceneStashStore'

/**
 * Aba "Keyframes": gestão completa da linha do tempo de trabalho (decisão do
 * usuário) — navegar, regravar, reordenar e apagar, todas ações que o
 * `figuresStore` já tinha. Duração e câmera dos trechos continuam trabalho da
 * aplicação completa: regravar aqui PRESERVA a câmera gravada no keyframe,
 * diferente do desktop, que regrava com a câmera viva — o módulo não tem
 * câmera de cena para oferecer (PLANO.md, item 44).
 */
export function PosesKeyframesTab() {
  const { t } = useTranslation()
  const animations = useFiguresStore((state) => state.animations)
  const figures = useFiguresStore((state) => state.figures)
  const updateAnimationKeyframe = useFiguresStore((state) => state.updateAnimationKeyframe)
  const moveAnimationKeyframe = useFiguresStore((state) => state.moveAnimationKeyframe)
  const removeAnimationKeyframe = useFiguresStore((state) => state.removeAnimationKeyframe)
  const currentKeyframeId = usePosesShellStore((state) => state.currentKeyframeId)
  const setCurrentKeyframeId = usePosesShellStore((state) => state.setCurrentKeyframeId)
  const stash = useSceneStashStore((state) => state.stash)
  const onionSkin = useAnimationStore((state) => state.onionSkin)
  const onionSkinMode = useAnimationStore((state) => state.onionSkinMode)
  const setOnionSkin = useAnimationStore((state) => state.setOnionSkin)
  const setOnionSkinMode = useAnimationStore((state) => state.setOnionSkinMode)
  const onionSkinHiddenFigureIds = useAnimationStore((state) => state.onionSkinHiddenFigureIds)
  const setOnionSkinFigureShown = useAnimationStore((state) => state.setOnionSkinFigureShown)

  /** Keyframe cujo ✕ espera confirmação — um por vez, como no desktop. */
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)

  const working = findWorkingAnimation(animations)
  const keyframes = working?.keyframes ?? []
  // O diálogo precisa do NÚMERO do keyframe, e o card que originou o toque sai
  // de vista. Um keyframe que sumiu da lista cai fora sozinho.
  const confirmingRemoveIndex = confirmingRemoveId
    ? keyframes.findIndex((keyframe) => keyframe.id === confirmingRemoveId)
    : -1

  // O estado dos checkboxes é DERIVADO do par (ligado, modo) do
  // `animationStore` — nenhum estado novo: o desktop continua dono do modelo.
  const showPrevious = onionSkin && (onionSkinMode === 'both' || onionSkinMode === 'previous')
  const showNext = onionSkin && (onionSkinMode === 'both' || onionSkinMode === 'next')

  const applyOnion = (previous: boolean, next: boolean) => {
    if (!previous && !next) {
      setOnionSkin(false)
      return
    }
    setOnionSkin(true)
    setOnionSkinMode(previous && next ? 'both' : previous ? 'previous' : 'next')
  }

  return (
    <div className="poses-tab">
      {/* Recuperar a cena guardada pelo último "Ir para" (2026-08-06). Fica no
          TOPO da aba, e não junto dos cards: a lista rola, e o botão tem de
          estar sempre à mão. A marca do keyframe corrente não se larga — é
          contra ele que o botão alterna. */}
      <button
        type="button"
        className="panel-action poses-tab__restore"
        onClick={restoreStash}
        disabled={stash === null}
        title={t('poses.keyframes.restoreStashHint')}
      >
        {t('poses.keyframes.restoreStash')}
      </button>

      {keyframes.length === 0 ? (
        <p className="poses-tab__empty">{t('poses.keyframes.empty')}</p>
      ) : (
        <ul className="poses-keyframes">
          {keyframes.map((keyframe, index) => (
            <li
              key={keyframe.id}
              className="poses-keyframes__item"
              aria-current={keyframe.id === currentKeyframeId ? 'true' : undefined}
            >
              <span className="poses-keyframes__label">
                {t('poses.keyframes.item', { index: index + 1 })}
                {keyframe.label ? ` — ${keyframe.label}` : ''}
              </span>
              <div className="poses-keyframes__actions">
                <button
                  type="button"
                  aria-label={t('poses.keyframes.goTo', { index: index + 1 })}
                  title={t('poses.keyframes.goTo', { index: index + 1 })}
                  onClick={() => {
                    // Guarda a bancada ANTES de sobrescrevê-la (2026-08-06) —
                    // aqui não há Ctrl+Z ao alcance do polegar. E só guarda se
                    // ela mudou desde o último "Ir para": percorrer keyframes
                    // não pode apagar a cena original.
                    goToKeyframeFigures(keyframe.figures)
                    setCurrentKeyframeId(keyframe.id)
                  }}
                >
                  ⤶
                </button>
                <button
                  type="button"
                  aria-label={t('poses.keyframes.update', { index: index + 1 })}
                  title={t('poses.keyframes.update', { index: index + 1 })}
                  disabled={!working}
                  onClick={() =>
                    working && updateAnimationKeyframe(working.id, keyframe.id, keyframe.camera)
                  }
                >
                  ⟳
                </button>
                <button
                  type="button"
                  aria-label={t('poses.keyframes.moveUp', { index: index + 1 })}
                  title={t('poses.keyframes.moveUp', { index: index + 1 })}
                  disabled={!working || index === 0}
                  onClick={() => working && moveAnimationKeyframe(working.id, keyframe.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={t('poses.keyframes.moveDown', { index: index + 1 })}
                  title={t('poses.keyframes.moveDown', { index: index + 1 })}
                  disabled={!working || index === keyframes.length - 1}
                  onClick={() => working && moveAnimationKeyframe(working.id, keyframe.id, 1)}
                >
                  ↓
                </button>
                {/* Apagar confirma em MODAL (pedido do usuário, 2026-08-06):
                    aqui o ✕ é um alvo de dedo entre outros quatro, e o Ctrl+Z
                    não está ao alcance do polegar. */}
                <button
                  type="button"
                  aria-label={t('poses.keyframes.remove', { index: index + 1 })}
                  title={t('poses.keyframes.remove', { index: index + 1 })}
                  disabled={!working}
                  onClick={() => setConfirmingRemoveId(keyframe.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Papel-cebola por DOIS checkboxes (pedido do usuário, 2026-07-31):
          anterior/posterior marcados viram o modo por inferência — os dois =
          `both`, um só = aquele, nenhum = desligado. O liga/desliga geral
          deixou de existir como controle: ele É a combinação. */}
      <div className="poses-onion" role="group" aria-label={t('poses.keyframes.onionSkin')}>
        <span className="poses-onion__label">{t('poses.keyframes.onionSkin')}</span>
        <label className="poses-tab__toggle">
          <input
            type="checkbox"
            checked={showPrevious}
            onChange={(event) => applyOnion(event.target.checked, showNext)}
          />
          <span>{t('poses.keyframes.onionModes.previous')}</span>
        </label>
        <label className="poses-tab__toggle">
          <input
            type="checkbox"
            checked={showNext}
            onChange={(event) => applyOnion(showPrevious, event.target.checked)}
          />
          <span>{t('poses.keyframes.onionModes.next')}</span>
        </label>
      </div>

      {/* De quais bonecos sai o fantasma (pedido do usuário, 2026-08-06) — a
          mesma escolha do painel de Animação, lendo e escrevendo no mesmo
          `animationStore`: as duas cascas contam a mesma história. Só aparece
          com o papel-cebola ligado e dois bonecos ou mais. */}
      {onionSkin && figures.length > 1 && (
        <div className="poses-onion" role="group" aria-label={t('poses.keyframes.onionFigures')}>
          <span className="poses-onion__label">{t('poses.keyframes.onionFigures')}</span>
          {figures.map((figure) => (
            <label key={figure.id} className="poses-tab__toggle">
              <input
                type="checkbox"
                checked={!onionSkinHiddenFigureIds.includes(figure.id)}
                onChange={(event) => setOnionSkinFigureShown(figure.id, event.target.checked)}
              />
              <span>{figure.name}</span>
            </label>
          ))}
        </div>
      )}

      {working && confirmingRemoveIndex >= 0 && confirmingRemoveId && (
        <ConfirmDialog
          title={t('poses.keyframes.removeTitle')}
          detail={t('poses.keyframes.item', { index: confirmingRemoveIndex + 1 })}
          message={t('poses.keyframes.removeConfirmHint')}
          confirmLabel={t('poses.keyframes.removeConfirm')}
          onConfirm={() => {
            removeAnimationKeyframe(working.id, confirmingRemoveId)
            setConfirmingRemoveId(null)
          }}
          onCancel={() => setConfirmingRemoveId(null)}
        />
      )}
    </div>
  )
}

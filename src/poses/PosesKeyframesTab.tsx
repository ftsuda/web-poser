import { useTranslation } from 'react-i18next'
import { findWorkingAnimation } from '../animation/animation'
import { useAnimationStore } from '../store/animationStore'
import { useFiguresStore } from '../store/figuresStore'
import { usePosesShellStore } from '../store/posesShellStore'

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
  const loadFiguresFromKeyframe = useFiguresStore((state) => state.loadFiguresFromKeyframe)
  const updateAnimationKeyframe = useFiguresStore((state) => state.updateAnimationKeyframe)
  const moveAnimationKeyframe = useFiguresStore((state) => state.moveAnimationKeyframe)
  const removeAnimationKeyframe = useFiguresStore((state) => state.removeAnimationKeyframe)
  const currentKeyframeId = usePosesShellStore((state) => state.currentKeyframeId)
  const setCurrentKeyframeId = usePosesShellStore((state) => state.setCurrentKeyframeId)
  const onionSkin = useAnimationStore((state) => state.onionSkin)
  const onionSkinMode = useAnimationStore((state) => state.onionSkinMode)
  const setOnionSkin = useAnimationStore((state) => state.setOnionSkin)
  const setOnionSkinMode = useAnimationStore((state) => state.setOnionSkinMode)

  const working = findWorkingAnimation(animations)
  const keyframes = working?.keyframes ?? []

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
                    loadFiguresFromKeyframe(keyframe.figures)
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
                <button
                  type="button"
                  aria-label={t('poses.keyframes.remove', { index: index + 1 })}
                  title={t('poses.keyframes.remove', { index: index + 1 })}
                  disabled={!working}
                  onClick={() => working && removeAnimationKeyframe(working.id, keyframe.id)}
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
    </div>
  )
}

import { Fragment } from 'react'
import { findWorkingAnimation } from '../animation/animation'
import { ONION_SKIN_COLORS, ONION_SKIN_OPACITY, onionSkinFrames } from '../animation/onionSkin'
import { Figure } from '../figure/Figure'
import { useAnimationStore } from '../store/animationStore'
import { useFiguresStore } from '../store/figuresStore'
import { useUIStore } from '../store/uiStore'
import { OVERLAY_NAMES } from './constants'

/**
 * Papel-cebola (item 31): o keyframe anterior e o seguinte desenhados em
 * fantasma em volta da cena de trabalho, para ajustar uma pose vendo de onde
 * ela vem e para onde vai.
 *
 * O item previa "uma segunda lista, com material translúcido, sem gizmos e sem
 * sombra" — é isto, e o `ghost` do `Figure.tsx` é quem carrega as três coisas
 * (mais a supressão dos nomes de cena, que é o detalhe que não estava à vista).
 *
 * **Só na tela.** O grupo se chama `scene-onion-skin` e está em `OVERLAY_NAMES`,
 * então o PNG e o MP4 já o escondem pela mesma regra que esconde a grade e os
 * gizmos — nada de uma segunda regra para manter em dia.
 *
 * **Some enquanto toca ou exporta.** Durante a reprodução quem manda na tela é
 * a pré-visualização, o âncora muda a cada quadro e os fantasmas piscariam de
 * um keyframe para o outro. Papel-cebola é ferramenta de quem está PARADO,
 * ajustando um retrato.
 */
export function OnionSkin() {
  const enabled = useAnimationStore((state) => state.onionSkin)
  const mode = useAnimationStore((state) => state.onionSkinMode)
  const hiddenFigureIds = useAnimationStore((state) => state.onionSkinHiddenFigureIds)
  const playing = useAnimationStore((state) => state.playing)
  const exportPhase = useAnimationStore((state) => state.exportPhase)
  const timeMs = useAnimationStore((state) => state.timeMs)
  const animations = useFiguresStore((state) => state.animations)
  // Os fantasmas seguem a MESMA casca da cena de trabalho: um palito rodeado de
  // manequins translúcidos (ou o contrário) leria como dois modelos diferentes,
  // quando são o mesmo boneco em instantes vizinhos.
  const figureStyle = useUIStore((state) => state.figureStyle)

  const busy = playing || exportPhase === 'running'
  const frames =
    enabled && !busy
      ? onionSkinFrames(findWorkingAnimation(animations), timeMs, mode, hiddenFigureIds)
      : []

  if (frames.length === 0) return null

  return (
    <group name={OVERLAY_NAMES.onionSkin}>
      {frames.map((frame) => (
        <Fragment key={`${frame.role}-${frame.index}`}>
          {frame.figures.map((figure) => (
            <Figure
              key={figure.id}
              figure={figure}
              ghost={{ color: ONION_SKIN_COLORS[frame.role], opacity: ONION_SKIN_OPACITY }}
              style={figureStyle}
            />
          ))}
        </Fragment>
      ))}
    </group>
  )
}

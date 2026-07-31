import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  animationDurationMs,
  findWorkingAnimation,
  keyframeGroups,
  keyframeStartTimesMs,
  neighbourKeyframeTimeMs,
  planKeyframeSplit,
  stepFrameMs,
} from '../animation/animation'
import { useAnimationStore } from '../store/animationStore'
import { useFiguresStore } from '../store/figuresStore'
import { useUIStore } from '../store/uiStore'

/** Segundos com uma casa — a linha do tempo se lê melhor em segundos que em milissegundos. */
function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Barra da linha do tempo, no RODAPÉ da janela (item 29, com a posição pedida
 * pelo usuário: fora do painel de Animação, ocupando a largura toda e
 * recolhível).
 *
 * O que ela resolve: o slider antigo vivia dentro do painel, com `step={10}` e
 * nenhuma referência visual — não dava para ver onde estavam os keyframes nem
 * parar em cima de um. Aqui a régua tem as marcas dos keyframes, botões para
 * pular de keyframe em keyframe, setas que andam exatamente um quadro (1/fps) e
 * o transporte (tocar/parar/repetir) junto, que é onde a mão já está.
 *
 * O painel de Animação continua com o que é EDIÇÃO (capturar, lista de
 * keyframes, velocidade, exportar); aqui fica o que é NAVEGAÇÃO. Recolhida, a
 * barra é uma faixa fina e não tira altura de quem só está posando — por isso
 * também nasce recolhida (`uiPreferences.ts`).
 */
export function TimelineBar() {
  const { t } = useTranslation()

  const animations = useFiguresStore((state) => state.animations)
  const active = findWorkingAnimation(animations)

  const collapsed = useUIStore((state) => state.collapsedPanels.timeline)
  const togglePanel = useUIStore((state) => state.togglePanel)

  const timeMs = useAnimationStore((state) => state.timeMs)
  const playing = useAnimationStore((state) => state.playing)
  const repeat = useAnimationStore((state) => state.repeat)
  const fps = useAnimationStore((state) => state.fps)
  const exportPhase = useAnimationStore((state) => state.exportPhase)
  const visitedKeyframeId = useAnimationStore((state) => state.visitedKeyframeId)
  const requestSeek = useAnimationStore((state) => state.requestSeek)
  const setTimeMs = useAnimationStore((state) => state.setTimeMs)
  const setPreview = useAnimationStore((state) => state.setPreview)
  const play = useAnimationStore((state) => state.play)
  const pause = useAnimationStore((state) => state.pause)
  const setRepeat = useAnimationStore((state) => state.setRepeat)
  const insertAnimationKeyframeAt = useFiguresStore((state) => state.insertAnimationKeyframeAt)

  const totalMs = active ? animationDurationMs(active) : 0
  // Encurtar um trecho pode deixar a linha do tempo parada além do fim; o que
  // se mostra é sempre o instante que existe.
  const currentMs = Math.min(timeMs, totalMs)
  const startTimes = active ? keyframeStartTimesMs(active) : []
  const groups = active ? keyframeGroups(active) : []
  const canPlay = totalMs > 0 && exportPhase !== 'running'

  // Qual marca da régua é a do keyframe que o painel destaca (item 41). Lê o
  // mesmo `visitedKeyframeId` do item 40 — sem estado novo, e apagando o
  // destaque sozinho quando o keyframe é removido, porque o `findIndex` deixa
  // de achá-lo e nenhum índice bate com o -1.
  const visitedIndex = active ? active.keyframes.findIndex((k) => k.id === visitedKeyframeId) : -1

  const previousKeyframeMs = neighbourKeyframeTimeMs(startTimes, currentMs, -1)
  const nextKeyframeMs = neighbourKeyframeTimeMs(startTimes, currentMs, 1)

  // Só há o que inserir dentro de um trecho: em cima de um keyframe (ou nas
  // pontas) não há nada para cortar. Tocando também não, porque o instante
  // mudaria entre ver o botão e clicá-lo.
  const canInsert =
    active !== null && exportPhase !== 'running' && !playing && planKeyframeSplit(active, currentMs) !== null

  const title = t('timeline.title')
  const toggleLabel = collapsed ? t('panels.expand', { title }) : t('panels.collapse', { title })

  const handleScrub = (event: ChangeEvent<HTMLInputElement>) => {
    requestSeek(Number(event.target.value))
  }

  const handleStop = () => {
    pause()
    setTimeMs(0)
    setPreview(null)
  }

  // Inserir corta o trecho onde a linha do tempo está: a animação continua
  // igual, e o keyframe novo é um ponto de ajuste. Navegar até ele em seguida é
  // o passo seguinte natural — e é o que mostra na tela o que se vai editar.
  const handleInsertKeyframe = () => {
    if (!active) return
    // Arredondado aqui também, e não só lá dentro: a navegação tem de parar
    // EXATAMENTE em cima do keyframe novo, não meio milissegundo ao lado.
    const cut = Math.round(currentMs)
    if (insertAnimationKeyframeAt(active.id, cut)) requestSeek(cut)
  }

  return (
    <section className={`timeline-bar${collapsed ? ' timeline-bar--collapsed' : ''}`} aria-label={title}>
      <div className="timeline-bar__header">
        <h2>{title}</h2>
        <span className="timeline-bar__readout">
          {t('timeline.position', {
            time: formatSeconds(currentMs),
            total: formatSeconds(totalMs),
          })}
        </span>
        <button
          type="button"
          className="timeline-bar__collapse-toggle"
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          onClick={() => togglePanel('timeline')}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="timeline-bar__body">
          {/* Duas fileiras (pedido do usuário): "Inserir keyframe aqui" em cima,
              o transporte embaixo. Além de caber melhor, separa o que EDITA do
              que só navega — eram sete controles numa fila só, e o botão de
              editar ficava colado no ▶ de andar um quadro. */}
          <div className="timeline-bar__controls">
            {/* "Inserir keyframe aqui" veio do painel de Animação e ganhou o
                mesmo destaque de "Capturar keyframe": ele corta o trecho NO
                INSTANTE do playhead, e o playhead está aqui. É a única EDIÇÃO
                desta barra, e por isso a única em destaque — e a razão de ela
                ter fileira própria, acima do transporte. */}
            <button
              type="button"
              className="timeline-bar__insert"
              onClick={handleInsertKeyframe}
              disabled={!canInsert}
              title={t('panels.animation.insertHint')}
            >
              {t('panels.animation.insert')}
            </button>

            <div className="timeline-bar__transport">
              <button type="button" onClick={playing ? pause : play} disabled={!canPlay}>
                {playing ? t('panels.animation.pause') : t('panels.animation.play')}
              </button>
              <button type="button" onClick={handleStop} disabled={!active}>
                {t('panels.animation.stop')}
              </button>

              {/* Pular de keyframe em keyframe: parar EM CIMA de um é o gesto
                mais repetido de quem ajusta tempo, e com o slider solto isso
                era pontaria. */}
              <button
                type="button"
                aria-label={t('timeline.previousKeyframe')}
                title={t('timeline.previousKeyframe')}
                disabled={previousKeyframeMs === null}
                onClick={() => previousKeyframeMs !== null && requestSeek(previousKeyframeMs)}
              >
                ⏮
              </button>
              <button
                type="button"
                aria-label={t('timeline.nextKeyframe')}
                title={t('timeline.nextKeyframe')}
                disabled={nextKeyframeMs === null}
                onClick={() => nextKeyframeMs !== null && requestSeek(nextKeyframeMs)}
              >
                ⏭
              </button>

              {/* Um quadro, e não "dez milissegundos": é a unidade em que o vídeo
                sai, então é a unidade em que se ajusta. */}
              <button
                type="button"
                aria-label={t('timeline.previousFrame', { fps })}
                title={t('timeline.previousFrame', { fps })}
                disabled={!canPlay || currentMs <= 0}
                onClick={() => requestSeek(stepFrameMs(currentMs, fps, -1, totalMs))}
              >
                ◀
              </button>
              <button
                type="button"
                aria-label={t('timeline.nextFrame', { fps })}
                title={t('timeline.nextFrame', { fps })}
                disabled={!canPlay || currentMs >= totalMs}
                onClick={() => requestSeek(stepFrameMs(currentMs, fps, 1, totalMs))}
              >
                ▶
              </button>

              <label className="timeline-bar__repeat">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(event) => setRepeat(event.target.checked)}
                />
                {t('panels.animation.repeat')}
              </label>
            </div>
          </div>

          <div className="timeline-bar__track">
            <input
              id="timeline-position"
              type="range"
              aria-label={t('timeline.position', {
                time: formatSeconds(currentMs),
                total: formatSeconds(totalMs),
              })}
              min={0}
              max={Math.max(totalMs, 1)}
              step={1}
              list="timeline-keyframe-marks"
              value={currentMs}
              onChange={handleScrub}
              disabled={!canPlay}
            />
            {/* As marcas dos keyframes: `<datalist>` é o jeito nativo de o
                próprio controle mostrar onde eles estão. */}
            <datalist id="timeline-keyframe-marks">
              {startTimes.map((start, index) => (
                <option key={index} value={start} label={String(index + 1)} />
              ))}
            </datalist>

            {/* A régua numerada, ABAIXO do slider: um traço por keyframe com o
                próprio número embaixo (pedido do usuário, 2026-07-31). O
                `<datalist>` acima já tenta isso — as `<option>` têm `label` —
                mas nenhum navegador desenha o rótulo de um `datalist` de
                `range`: sai o tique e some o número. Redesenhá-los aqui é o
                que faz "estou no keyframe 3 de 7" ser coisa que se lê, e não
                que se conta.

                Fica FORA do `<input type=range>` porque ele não deixa
                estilizar as próprias marcas, e abaixo dele para não disputar o
                espaço do polegar, que é o que a mão arrasta.

                O keyframe que está na bancada (item 41) continua com marca
                própria — o mesmo traço, mais grosso e na cor de destaque. */}
            {totalMs > 0 && startTimes.length > 0 && (
              <div className="timeline-bar__marks">
                {startTimes.map((start, index) => (
                  <span
                    key={index}
                    className={`timeline-bar__mark${
                      index === visitedIndex ? ' timeline-bar__mark--visited' : ''
                    }`}
                    title={
                      index === visitedIndex
                        ? t('timeline.visitedKeyframe', { index: index + 1 })
                        : t('timeline.keyframeMark', {
                            index: index + 1,
                            time: formatSeconds(start),
                          })
                    }
                    style={{ left: `${(start / totalMs) * 100}%` }}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
            )}

            {/* Faixas dos grupos (item 38): a segunda camada da mesma régua —
                é aqui que "keyframes 1 a 5 = Andando 1" vira coisa que se vê. */}
            {totalMs > 0 && groups.length > 0 && (
              <div className="timeline-bar__groups">
                {groups.map((group) => (
                  <span
                    key={`${group.label}-${group.startIndex}`}
                    className="timeline-bar__group"
                    title={group.label}
                    style={{
                      left: `${(group.startMs / totalMs) * 100}%`,
                      width: `${((group.endMs - group.startMs) / totalMs) * 100}%`,
                    }}
                  >
                    {group.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

import { beforeEach, describe, expect, it } from 'vitest'
import { POSE_MARK_SEQUENCE } from '../../pose-import/markedPose'
import { nextMarkStep, useReferenceImageStore } from '../referenceImageStore'

/**
 * A foto de referência (item 7) e a máquina de marcação (PLANO.md > "Pose por
 * marcação manual"): estado de FERRAMENTA, só sessão — fora do undo, fora do
 * arquivo, compartilhado pelas duas cascas (a foto sobrevive à troca
 * desktop ↔ módulo de poses; recarregar a página a perde, por decisão).
 */
/** Marca o ponto CORRENTE e passa ao seguinte — o cursor não anda sozinho (#115.1). */
function markAndAdvance(x = 0.5, y = 0.5): void {
  useReferenceImageStore.getState().placeMark(x, y)
  useReferenceImageStore.getState().moveMarkCursor(1)
}

describe('referenceImageStore', () => {
  beforeEach(() => {
    useReferenceImageStore.setState(useReferenceImageStore.getInitialState())
  })

  it('carregar foto zera marcas e liga a visibilidade; limpar devolve tudo ao início', () => {
    const store = useReferenceImageStore.getState()
    store.setImage('blob:foto-1', 'pose.jpg')

    expect(useReferenceImageStore.getState().imageUrl).toBe('blob:foto-1')
    expect(useReferenceImageStore.getState().imageName).toBe('pose.jpg')
    expect(useReferenceImageStore.getState().imageVisible).toBe(true)

    useReferenceImageStore.getState().startMarking()
    useReferenceImageStore.getState().placeMark(0.5, 0.2)
    useReferenceImageStore.getState().clearImage()

    const cleared = useReferenceImageStore.getState()
    expect(cleared.imageUrl).toBeNull()
    expect(cleared.marking).toBe(false)
    expect(cleared.marks).toEqual({})
  })

  it('a marcação segue a sequência guiada: cabeça, nariz (opcional), e o braço direito inteiro', () => {
    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')
    useReferenceImageStore.getState().startMarking()

    expect(nextMarkStep(useReferenceImageStore.getState())?.key).toBe('head')
    markAndAdvance(0.5, 0.1)
    expect(useReferenceImageStore.getState().marks.head).toEqual({ x: 0.5, y: 0.1 })

    // O nariz vem agrupado com a cabeça; pulado, o eixo do tronco fecha — base
    // do pescoço (prumo, #113.1) e base do tórax (quebra, #119, opcional) —, e
    // só então entra o braço direito INTEIRO.
    expect(nextMarkStep(useReferenceImageStore.getState())).toEqual({ key: 'nose', optional: true })
    useReferenceImageStore.getState().skipMarkAtCursor()
    expect(nextMarkStep(useReferenceImageStore.getState())?.key).toBe('neck')
    markAndAdvance(0.5, 0.25)
    expect(nextMarkStep(useReferenceImageStore.getState())).toEqual({ key: 'chest', optional: true })
    markAndAdvance(0.5, 0.32)
    expect(nextMarkStep(useReferenceImageStore.getState())?.key).toBe('shoulder.R')
    markAndAdvance(0.4, 0.3)
    expect(nextMarkStep(useReferenceImageStore.getState())?.key).toBe('elbow.R')
  })

  it('o cursor da marcação é a junta CORRENTE: o toque marca ela e o cursor FICA (#115.1)', () => {
    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')
    useReferenceImageStore.getState().startMarking()

    // Entrar na marcação põe o cursor no primeiro ponto pendente.
    expect(useReferenceImageStore.getState().selectedMarkKey).toBe('head')

    useReferenceImageStore.getState().placeMark(0.5, 0.1)
    expect(useReferenceImageStore.getState().selectedMarkKey).toBe('head')

    // Tocar de novo CORRIGE a mesma junta (é o que dá o "marcar e conferir a
    // profundidade" sem o nome do painel divergir do ponto marcado).
    useReferenceImageStore.getState().setMarkDepth('head', 'front')
    useReferenceImageStore.getState().placeMark(0.52, 0.12)
    expect(useReferenceImageStore.getState().marks.head).toEqual({ x: 0.52, y: 0.12, depth: 'front' })
    expect(Object.keys(useReferenceImageStore.getState().marks)).toHaveLength(1)

    // Avançar e retroceder andam na sequência inteira, e param nas pontas.
    useReferenceImageStore.getState().moveMarkCursor(1)
    expect(useReferenceImageStore.getState().selectedMarkKey).toBe('nose')
    useReferenceImageStore.getState().moveMarkCursor(1)
    expect(useReferenceImageStore.getState().selectedMarkKey).toBe('neck')
    useReferenceImageStore.getState().moveMarkCursor(-1)
    useReferenceImageStore.getState().moveMarkCursor(-1)
    useReferenceImageStore.getState().moveMarkCursor(-1)
    expect(useReferenceImageStore.getState().selectedMarkKey).toBe('head')

    // Voltar a uma junta já marcada e tocar de novo não cria ponto nenhum.
    useReferenceImageStore.getState().placeMark(0.5, 0.15)
    expect(Object.keys(useReferenceImageStore.getState().marks)).toHaveLength(1)
  })

  it('pular anda com o cursor; marcar um ponto pulado o devolve à fila', () => {
    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')
    useReferenceImageStore.getState().startMarking()
    markAndAdvance(0.5, 0.1) // head

    // No nariz (opcional): pular registra e passa ao próximo.
    expect(useReferenceImageStore.getState().selectedMarkKey).toBe('nose')
    useReferenceImageStore.getState().skipMarkAtCursor()
    expect(useReferenceImageStore.getState().skippedKeys).toEqual(['nose'])
    expect(useReferenceImageStore.getState().selectedMarkKey).toBe('neck')

    // Voltar ao nariz e marcá-lo o tira dos pulados.
    useReferenceImageStore.getState().moveMarkCursor(-1)
    useReferenceImageStore.getState().placeMark(0.5, 0.12)
    expect(useReferenceImageStore.getState().skippedKeys).toEqual([])
    expect(useReferenceImageStore.getState().marks.nose).toBeDefined()
  })

  it('só marca com foto carregada e modo ligado; coordenadas são grampeadas a 0–1', () => {
    useReferenceImageStore.getState().placeMark(0.5, 0.5)
    expect(useReferenceImageStore.getState().marks).toEqual({})

    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')
    useReferenceImageStore.getState().startMarking()
    useReferenceImageStore.getState().placeMark(1.7, -0.3)
    expect(useReferenceImageStore.getState().marks.head).toEqual({ x: 1, y: 0 })
  })

  it('pular só vale para ponto OPCIONAL; remover uma marca a devolve à fila', () => {
    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')
    useReferenceImageStore.getState().startMarking()

    // Obrigatório não se pula: a fila continua na cabeça.
    useReferenceImageStore.getState().skipMarkAtCursor()
    expect(nextMarkStep(useReferenceImageStore.getState())?.key).toBe('head')

    // Marca a cabeça; o nariz (opcional) pula; marca do pescoço ao tornozelo
    // direito — a ponta do pé direito vem logo atrás, agrupada na perna, e pula.
    markAndAdvance() // head
    useReferenceImageStore.getState().skipMarkAtCursor() // nose
    for (const step of POSE_MARK_SEQUENCE.slice(2, 13)) {
      void step
      markAndAdvance()
    }
    expect(nextMarkStep(useReferenceImageStore.getState())?.key).toBe('foot.R')
    useReferenceImageStore.getState().skipMarkAtCursor()
    expect(nextMarkStep(useReferenceImageStore.getState())?.key).toBe('hip.L')

    // Remover o ombro esquerdo o põe de volta como o PRÓXIMO da fila.
    useReferenceImageStore.getState().removeMark('shoulder.L')
    expect(nextMarkStep(useReferenceImageStore.getState())?.key).toBe('shoulder.L')
  })

  it('mover preserva a profundidade; a profundidade é opt-in por marca e reversível', () => {
    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')
    useReferenceImageStore.getState().startMarking()
    markAndAdvance(0.5, 0.1) // head
    useReferenceImageStore.getState().skipMarkAtCursor() // nose
    markAndAdvance(0.5, 0.2) // neck
    markAndAdvance(0.5, 0.32) // chest
    markAndAdvance(0.4, 0.3) // shoulder.R

    useReferenceImageStore.getState().setMarkDepth('shoulder.R', 'front')
    expect(useReferenceImageStore.getState().marks['shoulder.R']?.depth).toBe('front')

    useReferenceImageStore.getState().moveMark('shoulder.R', 0.45, 0.32)
    expect(useReferenceImageStore.getState().marks['shoulder.R']).toEqual({ x: 0.45, y: 0.32, depth: 'front' })

    useReferenceImageStore.getState().setMarkDepth('shoulder.R', null)
    expect(useReferenceImageStore.getState().marks['shoulder.R']?.depth).toBeUndefined()
  })

  it('com tudo marcado, o toque corrige o ponto corrente; recomeçar limpa as marcas mas não a foto', () => {
    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')
    useReferenceImageStore.getState().startMarking()
    for (const step of POSE_MARK_SEQUENCE) {
      void step
      markAndAdvance()
    }
    expect(nextMarkStep(useReferenceImageStore.getState())).toBeNull()

    // O cursor parou no último ponto: tocar de novo o corrige, sem inventar marca.
    useReferenceImageStore.getState().placeMark(0.9, 0.9)
    expect(Object.keys(useReferenceImageStore.getState().marks)).toHaveLength(POSE_MARK_SEQUENCE.length)
    expect(useReferenceImageStore.getState().marks['foot.L']).toEqual({ x: 0.9, y: 0.9 })

    useReferenceImageStore.getState().clearMarks()
    expect(useReferenceImageStore.getState().marks).toEqual({})
    expect(useReferenceImageStore.getState().imageUrl).toBe('blob:foto')
  })

  it('zoom e deslocamento da foto: grampeados, recentráveis, e zerados ao trocar de foto', () => {
    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')

    useReferenceImageStore.getState().setPhotoView({ zoom: 3, offsetX: 0.4, offsetY: -0.2 })
    expect(useReferenceImageStore.getState().photoZoom).toBe(3)
    expect(useReferenceImageStore.getState().photoOffsetX).toBe(0.4)

    // O slider mexe só no zoom, mantendo o deslocamento (regrampeado se preciso).
    useReferenceImageStore.getState().setPhotoZoom(100)
    expect(useReferenceImageStore.getState().photoZoom).toBe(8)
    expect(useReferenceImageStore.getState().photoOffsetX).toBe(0.4)

    useReferenceImageStore.getState().resetPhotoView()
    expect(useReferenceImageStore.getState().photoZoom).toBe(1)
    expect(useReferenceImageStore.getState().photoOffsetX).toBe(0)
    expect(useReferenceImageStore.getState().photoOffsetY).toBe(0)

    // Foto nova = vista neutra: o enquadramento era DAQUELA foto.
    useReferenceImageStore.getState().setPhotoView({ zoom: 2, offsetX: 0.1, offsetY: 0.1 })
    useReferenceImageStore.getState().setImage('blob:foto-2', 'b.jpg')
    expect(useReferenceImageStore.getState().photoZoom).toBe(1)
    expect(useReferenceImageStore.getState().photoOffsetX).toBe(0)
  })

  it('os modos "ajustar foto" e "marcar" são exclusivos: ligar um desliga o outro', () => {
    // Sem foto, nenhum dos dois liga.
    useReferenceImageStore.getState().startAdjusting()
    expect(useReferenceImageStore.getState().adjusting).toBe(false)

    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')
    useReferenceImageStore.getState().startAdjusting()
    expect(useReferenceImageStore.getState().adjusting).toBe(true)

    useReferenceImageStore.getState().startMarking()
    expect(useReferenceImageStore.getState().marking).toBe(true)
    expect(useReferenceImageStore.getState().adjusting).toBe(false)

    useReferenceImageStore.getState().startAdjusting()
    expect(useReferenceImageStore.getState().adjusting).toBe(true)
    expect(useReferenceImageStore.getState().marking).toBe(false)

    useReferenceImageStore.getState().stopAdjusting()
    expect(useReferenceImageStore.getState().adjusting).toBe(false)
  })

  it('vídeo é um TIPO da mesma referência: carrega com kind, zera ao trocar, foto continua o padrão', () => {
    useReferenceImageStore.getState().setImage('blob:video', 'ref.mp4', 'video')
    expect(useReferenceImageStore.getState().kind).toBe('video')
    expect(useReferenceImageStore.getState().videoFps).toBe(30)

    // O espelho da reprodução (o overlay escreve; os controles leem).
    useReferenceImageStore.getState().syncVideoPlayback({ time: 2.5, duration: 10, playing: true })
    expect(useReferenceImageStore.getState().videoTime).toBe(2.5)
    expect(useReferenceImageStore.getState().videoDuration).toBe(10)
    expect(useReferenceImageStore.getState().videoPlaying).toBe(true)

    // Trocar para foto zera o estado de vídeo; sem kind, o padrão é foto.
    useReferenceImageStore.getState().setImage('blob:foto', 'pose.jpg')
    expect(useReferenceImageStore.getState().kind).toBe('image')
    expect(useReferenceImageStore.getState().videoTime).toBe(0)
    expect(useReferenceImageStore.getState().videoDuration).toBe(0)
    expect(useReferenceImageStore.getState().videoPlaying).toBe(false)
  })

  it('fps: a medição automática respeita a escolha MANUAL do usuário', () => {
    useReferenceImageStore.getState().setImage('blob:video', 'ref.mp4', 'video')

    // Medição automática (rVFC) ajusta o padrão…
    useReferenceImageStore.getState().measureVideoFps(25)
    expect(useReferenceImageStore.getState().videoFps).toBe(25)

    // …mas nunca sobrescreve o que o usuário escolheu à mão.
    useReferenceImageStore.getState().setVideoFps(60)
    useReferenceImageStore.getState().measureVideoFps(24)
    expect(useReferenceImageStore.getState().videoFps).toBe(60)

    // Vídeo novo zera a escolha (é OUTRO vídeo).
    useReferenceImageStore.getState().setImage('blob:video-2', 'ref2.mp4', 'video')
    expect(useReferenceImageStore.getState().videoFps).toBe(30)
    useReferenceImageStore.getState().measureVideoFps(24)
    expect(useReferenceImageStore.getState().videoFps).toBe(24)
  })

  it('encerrar a marcação mantém as marcas (dá para voltar); a seleção some', () => {
    useReferenceImageStore.getState().setImage('blob:foto', 'a.jpg')
    useReferenceImageStore.getState().startMarking()
    useReferenceImageStore.getState().placeMark(0.5, 0.1)
    useReferenceImageStore.getState().selectMark('head')

    useReferenceImageStore.getState().stopMarking()
    expect(useReferenceImageStore.getState().marking).toBe(false)
    expect(useReferenceImageStore.getState().selectedMarkKey).toBeNull()
    expect(useReferenceImageStore.getState().marks.head).toBeDefined()
  })
})

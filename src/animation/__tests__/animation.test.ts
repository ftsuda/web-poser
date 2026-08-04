import { describe, expect, it } from 'vitest'
import {
  ANIMATION_SPEED_STEP,
  KEYFRAME_EASINGS,
  advancePlayheadMs,
  applyEasing,
  DEFAULT_ANIMATION_SPEED,
  DEFAULT_KEYFRAME_DURATION_MS,
  MAX_ANIMATION_SPEED,
  MAX_KEYFRAME_DURATION_MS,
  MIN_ANIMATION_SPEED,
  MIN_KEYFRAME_DURATION_MS,
  animationDurationMs,
  animationOutputDurationMs,
  clampAnimationSpeed,
  clampKeyframeDuration,
  createWorkingAnimation,
  findWorkingAnimation,
  formatAnimationFilename,
  freeKeyframeLabel,
  keyframeGroups,
  keyframeIndexAtTimeMs,
  keyframeStartTimesMs,
  moveKeyframeBlock,
  neighbourKeyframeTimeMs,
  stepFrameMs,
  planKeyframeSplit,
  sanitizeAnimations,
  savedAnimations,
  uniqueKeyframeLabel,
  WORKING_ANIMATION_ID,
  type Animation,
  type AnimationKeyframe,
} from '../animation'
import { resolvePosePreset } from '../../figure/posePresets'
import type { Figure } from '../../store/figuresStore'

function figure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: resolvePosePreset('tpose'),
    ...overrides,
  }
}

function keyframe(overrides: Partial<AnimationKeyframe> = {}): AnimationKeyframe {
  return {
    id: 'k1',
    durationMs: 1000,
    figures: [figure()],
    camera: { position: [0, 1, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 50 },
    ...overrides,
  }
}

function animation(durations: readonly number[], speed = DEFAULT_ANIMATION_SPEED): Animation {
  return {
    id: 'a1',
    name: 'Animação 1',
    speed,
    keyframes: durations.map((durationMs, index) => keyframe({ id: `k${index + 1}`, durationMs })),
  }
}

describe('applyEasing (item 26)', () => {
  it('linear (e ausência de easing) devolve t intacto', () => {
    expect(applyEasing(0.25)).toBe(0.25)
    expect(applyEasing(0.25, 'linear')).toBe(0.25)
  })

  it('todas as curvas fixam as pontas: t=0 dá 0 e t=1 dá 1, exatos', () => {
    for (const easing of KEYFRAME_EASINGS) {
      expect(applyEasing(0, easing)).toBe(0)
      expect(applyEasing(1, easing)).toBe(1)
    }
  })

  it('easeInOut é o smoothstep: devagar nas duas pontas, simétrico no meio', () => {
    expect(applyEasing(0.25, 'easeInOut')).toBeCloseTo(0.15625, 10)
    expect(applyEasing(0.5, 'easeInOut')).toBeCloseTo(0.5, 10)
    expect(applyEasing(0.75, 'easeInOut')).toBeCloseTo(0.84375, 10)
  })

  it('easeIn parte devagar; easeOut chega devagar', () => {
    expect(applyEasing(0.25, 'easeIn')).toBeCloseTo(0.0625, 10)
    expect(applyEasing(0.25, 'easeOut')).toBeCloseTo(0.4375, 10)
  })
})

describe('sanitizeAnimations — easing (item 26)', () => {
  it('preserva um easing conhecido, descarta o desconhecido e omite o linear', () => {
    const lidas = sanitizeAnimations([
      {
        id: 'a1',
        keyframes: [
          { figures: [], camera: keyframe().camera },
          { figures: [], camera: keyframe().camera, easing: 'easeInOut' },
          { figures: [], camera: keyframe().camera, easing: 'zigzag' },
          { figures: [], camera: keyframe().camera, easing: 'linear' },
        ],
      },
    ])

    const [semEasing, valido, invalido, linear] = lidas[0].keyframes
    expect(semEasing.easing).toBeUndefined()
    expect(valido.easing).toBe('easeInOut')
    expect(invalido.easing).toBeUndefined()
    // 'linear' é o padrão — gravar o campo seria ruído no arquivo.
    expect('easing' in linear).toBe(false)
  })
})

describe('clampKeyframeDuration', () => {
  it('grampeia nos limites em vez de aceitar duração zero ou negativa', () => {
    expect(clampKeyframeDuration(0)).toBe(MIN_KEYFRAME_DURATION_MS)
    expect(clampKeyframeDuration(-500)).toBe(MIN_KEYFRAME_DURATION_MS)
    expect(clampKeyframeDuration(MAX_KEYFRAME_DURATION_MS * 10)).toBe(MAX_KEYFRAME_DURATION_MS)
  })

  it('arredonda para milissegundo inteiro — a unidade que o usuário digita', () => {
    expect(clampKeyframeDuration(1500.4)).toBe(1500)
    expect(clampKeyframeDuration(1500.6)).toBe(1501)
  })

  it('valor não numérico cai no padrão, em vez de virar NaN dentro da linha do tempo', () => {
    expect(clampKeyframeDuration(Number.NaN)).toBe(DEFAULT_KEYFRAME_DURATION_MS)
    expect(clampKeyframeDuration(Number.POSITIVE_INFINITY)).toBe(MAX_KEYFRAME_DURATION_MS)
  })
})

describe('animationDurationMs', () => {
  /**
   * A duração é a da transição que CHEGA a cada keyframe, então a do primeiro
   * não tem para onde ir: não existe trecho antes dele. Ela continua guardada
   * (reordenar não pode perder o valor), mas não conta no total.
   */
  it('ignora a duração do primeiro keyframe — não há trecho antes dele', () => {
    expect(animationDurationMs(animation([500, 1000, 2000]))).toBe(3000)
  })

  it('uma animação de um keyframe só dura zero', () => {
    expect(animationDurationMs(animation([800]))).toBe(0)
  })

  it('sem keyframes, dura zero', () => {
    expect(animationDurationMs(animation([]))).toBe(0)
  })
})

describe('clampAnimationSpeed', () => {
  it('arredonda à grade de 0,05 — o campo tem duas casas e não saberia mostrar 1,13 de volta', () => {
    expect(clampAnimationSpeed(1.13)).toBe(1.15)
    expect(clampAnimationSpeed(1.12)).toBe(1.1)
    expect(clampAnimationSpeed(ANIMATION_SPEED_STEP)).toBe(0.1) // abaixo do mínimo
  })

  /**
   * `23 × 0,05` dá 1.1500000000000001 em ponto flutuante. O valor tem de sair
   * IDÊNTICO ao literal digitado, senão o campo mostra um número que ninguém
   * escreveu.
   */
  it('devolve o valor exato de duas casas, sem lixo de ponto flutuante', () => {
    expect(clampAnimationSpeed(1.15)).toBe(1.15)
    expect(clampAnimationSpeed(4.85)).toBe(4.85)
    expect(String(clampAnimationSpeed(1.15))).toBe('1.15')
  })

  it('grampeia nos limites em vez de aceitar velocidade zero, negativa ou absurda', () => {
    expect(clampAnimationSpeed(0)).toBe(MIN_ANIMATION_SPEED)
    expect(clampAnimationSpeed(-2)).toBe(MIN_ANIMATION_SPEED)
    expect(clampAnimationSpeed(120)).toBe(MAX_ANIMATION_SPEED)
  })

  it('valor não numérico cai na velocidade normal, em vez de virar NaN na linha do tempo', () => {
    expect(clampAnimationSpeed(Number.NaN)).toBe(DEFAULT_ANIMATION_SPEED)
    expect(clampAnimationSpeed(undefined)).toBe(DEFAULT_ANIMATION_SPEED)
    expect(clampAnimationSpeed('1.5')).toBe(DEFAULT_ANIMATION_SPEED)
  })
})

describe('animationOutputDurationMs', () => {
  /** Multiplicador de VELOCIDADE: metade da velocidade, dobro do comprimento. */
  it('meia velocidade dobra o vídeo; 1,15 encurta os mesmos 15%', () => {
    expect(animationOutputDurationMs(animation([0, 1000, 1000], 0.5))).toBe(4000)
    // 2300/1,15 dá 2000.0000000000002 em ponto flutuante. A divisão fica
    // EXATA de propósito, sem arredondar: é ela que faz o último quadro cair
    // em cima do último keyframe (`sampleAnimationOutput`), e meio
    // bilionésimo de milissegundo não muda quadro nenhum.
    expect(animationOutputDurationMs(animation([0, 1150, 1150], 1.15))).toBeCloseTo(2000, 9)
  })

  it('na velocidade normal é a própria duração da linha do tempo', () => {
    const normal = animation([0, 1000, 2000])
    expect(animationOutputDurationMs(normal)).toBe(animationDurationMs(normal))
  })

  it('velocidade inválida vinda de arquivo não contamina o total', () => {
    expect(animationOutputDurationMs(animation([0, 1000], Number.NaN))).toBe(1000)
    expect(animationOutputDurationMs(animation([0, 1000], 0))).toBe(10_000)
  })
})

describe('keyframeStartTimesMs', () => {
  it('devolve o instante de cada keyframe, começando em zero', () => {
    expect(keyframeStartTimesMs(animation([999, 1000, 500, 2500]))).toEqual([0, 1000, 1500, 4000])
  })

  it('sem keyframes, devolve lista vazia', () => {
    expect(keyframeStartTimesMs(animation([]))).toEqual([])
  })
})

describe('sanitizeAnimations', () => {
  it('descarta o que não é animação em vez de deixar entrar dado inválido', () => {
    expect(sanitizeAnimations(null)).toEqual([])
    expect(sanitizeAnimations([{ id: 'a', name: 'x' }])).toEqual([])
    expect(sanitizeAnimations(['nada'])).toEqual([])
  })

  it('grampeia durações e descarta keyframes sem bonecos nem câmera', () => {
    const [restaurada] = sanitizeAnimations([
      {
        id: 'a1',
        name: 'Corrida',
        keyframes: [
          { id: 'k1', durationMs: -5, figures: [figure()], camera: keyframe().camera },
          { id: 'k2', durationMs: 700, figures: 'nada', camera: keyframe().camera },
          { id: 'k3', durationMs: 700, figures: [figure()], camera: keyframe().camera },
        ],
      },
    ])

    expect(restaurada.name).toBe('Corrida')
    expect(restaurada.keyframes.map((k) => k.id)).toEqual(['k1', 'k3'])
    expect(restaurada.keyframes[0].durationMs).toBe(MIN_KEYFRAME_DURATION_MS)
  })

  it('lê a velocidade do arquivo, grampeada — e sem o campo, toca na velocidade normal', () => {
    const base = { id: 'a1', name: 'A', keyframes: [keyframe()] }
    const lida = (speed?: unknown) =>
      sanitizeAnimations([speed === undefined ? base : { ...base, speed }])[0].speed

    expect(lida()).toBe(DEFAULT_ANIMATION_SPEED)
    expect(lida(0.5)).toBe(0.5)
    expect(lida(1.13)).toBe(1.15)
    expect(lida(999)).toBe(MAX_ANIMATION_SPEED)
    expect(lida('rápido')).toBe(DEFAULT_ANIMATION_SPEED)
  })

  it('grampeia a pose dos bonecos ao ler, como qualquer outro carregamento', () => {
    const [restaurada] = sanitizeAnimations([
      {
        id: 'a1',
        name: 'A',
        keyframes: [
          {
            id: 'k1',
            durationMs: 100,
            figures: [figure({ pose: { 'elbow.R': { x: 900, y: 0, z: 0 } } })],
            camera: keyframe().camera,
          },
        ],
      },
    ])

    // `elbow.*` flexiona na faixa negativa (DECISOES.md #14): 900° tem de virar
    // o extremo da faixa, não passar direto para o material do three.
    expect(restaurada.keyframes[0].figures[0].pose['elbow.R'].x).toBeLessThanOrEqual(0)
  })
})

describe('planKeyframeSplit', () => {
  it('divide o trecho no instante pedido, sem mexer no total', () => {
    // Três keyframes de 1 s: instantes 0, 1000 e 2000.
    const plano = planKeyframeSplit(animation([1000, 1000, 1000]), 600)!

    expect(plano).toEqual({ index: 1, timeMs: 600, durationMs: 600, nextDurationMs: 400 })
    // As duas metades somam o trecho original — é o que mantém tudo no lugar.
    expect(plano.durationMs + plano.nextDurationMs).toBe(1000)
  })

  it('encontra o trecho certo quando o instante cai no meio da animação', () => {
    const plano = planKeyframeSplit(animation([1000, 400, 600]), 700)!

    // 700 ms cai no segundo trecho (400 → 1000), a 300 ms do começo dele.
    expect(plano).toEqual({ index: 2, timeMs: 700, durationMs: 300, nextDurationMs: 300 })
  })

  it('recusa em cima de um keyframe: não há trecho para dividir', () => {
    const anim = animation([1000, 500, 500])
    for (const instante of [0, 500, 1000]) {
      expect(planKeyframeSplit(anim, instante)).toBeNull()
    }
  })

  it('recusa fora da linha do tempo e com menos de dois keyframes', () => {
    expect(planKeyframeSplit(animation([1000, 1000]), -10)).toBeNull()
    expect(planKeyframeSplit(animation([1000, 1000]), 5000)).toBeNull()
    expect(planKeyframeSplit(animation([1000]), 500)).toBeNull()
    expect(planKeyframeSplit(animation([]), 0)).toBeNull()
    expect(planKeyframeSplit(animation([1000, 1000]), Number.NaN)).toBeNull()
  })

  it('arredonda o instante para milissegundo inteiro, como a duração', () => {
    const plano = planKeyframeSplit(animation([1000, 1000]), 600.4)!

    expect(plano.timeMs).toBe(600)
    expect(plano.durationMs).toBe(600)
    expect(plano.nextDurationMs).toBe(400)
  })

  it('nunca produz uma metade de duração zero, mesmo a 1 ms do keyframe', () => {
    const anim = animation([1000, 1000])
    // Grampear uma metade em 1 ms (o mínimo) ALONGARIA a animação; por isso o
    // corte só vale estritamente dentro do trecho.
    expect(planKeyframeSplit(anim, 0.4)).toBeNull()
    expect(planKeyframeSplit(anim, 1)!.durationMs).toBe(1)
    expect(planKeyframeSplit(anim, 999)!.nextDurationMs).toBe(1)
  })
})

/** Item 36 — a animação de trabalho e a separação entre bancada e biblioteca. */
describe('animação de trabalho', () => {
  const salva = (id: string): Animation => ({ id, name: id, speed: 1, keyframes: [] })

  it('nasce vazia, na velocidade normal e com o id reservado', () => {
    const working = createWorkingAnimation()
    expect(working.id).toBe(WORKING_ANIMATION_ID)
    expect(working.keyframes).toEqual([])
    expect(working.speed).toBe(DEFAULT_ANIMATION_SPEED)
    expect(working.name.trim()).not.toBe('')
  })

  it('acha a de trabalho no meio da lista, e devolve null quando não há', () => {
    const working = createWorkingAnimation()
    expect(findWorkingAnimation([salva('animation-1'), working])).toBe(working)
    expect(findWorkingAnimation([salva('animation-1')])).toBeNull()
  })

  it('a biblioteca é tudo menos a de trabalho, na ordem em que está', () => {
    const lista = [createWorkingAnimation(), salva('animation-2'), salva('animation-1')]
    expect(savedAnimations(lista).map((a) => a.id)).toEqual(['animation-2', 'animation-1'])
  })

  /** O id reservado não pode ser gerado para uma animação da biblioteca. */
  it('o id da de trabalho fica fora do padrão dos ids gerados', () => {
    expect(WORKING_ANIMATION_ID).not.toMatch(/^animation-\d+$/)
  })

  it('sobrevive à ida e volta pela sanitização, com o id preservado', () => {
    const working = { ...createWorkingAnimation(), keyframes: [] }
    const [lido] = sanitizeAnimations([working])
    expect(lido.id).toBe(WORKING_ANIMATION_ID)
    expect(findWorkingAnimation([lido])).not.toBeNull()
  })
})

/** Item 27 — o laço da reprodução na tela. */
describe('advancePlayheadMs', () => {
  it('sem laço, chegar ao fim para exatamente no fim', () => {
    expect(advancePlayheadMs(900, 200, 1000, false)).toEqual({ timeMs: 1000, ended: true })
    expect(advancePlayheadMs(0, 5000, 1000, false)).toEqual({ timeMs: 1000, ended: true })
  })

  it('dentro do trecho anda o passo inteiro, com ou sem laço', () => {
    expect(advancePlayheadMs(100, 250, 1000, false)).toEqual({ timeMs: 350, ended: false })
    expect(advancePlayheadMs(100, 250, 1000, true)).toEqual({ timeMs: 350, ended: false })
  })

  /** O excedente volta para o começo: o ciclo emenda no passo em que estava. */
  it('com laço, o que passou do fim reentra pelo começo', () => {
    expect(advancePlayheadMs(900, 250, 1000, true)).toEqual({ timeMs: 150, ended: false })
    expect(advancePlayheadMs(0, 1000, 1000, true)).toEqual({ timeMs: 0, ended: false })
  })

  /** Um quadro lento pode pular a volta inteira — o passo continua constante. */
  it('com laço, um salto de várias voltas cai no lugar certo', () => {
    expect(advancePlayheadMs(0, 3200, 1000, true)).toEqual({ timeMs: 200, ended: false })
  })

  it('linha do tempo vazia termina na hora, mesmo com laço', () => {
    expect(advancePlayheadMs(0, 100, 0, true)).toEqual({ timeMs: 0, ended: true })
  })
})

/** Item 29 — navegação pela régua: pular keyframe e andar de quadro em quadro. */
describe('neighbourKeyframeTimeMs', () => {
  const marcas = [0, 1000, 1500, 4000]

  it('acha o keyframe anterior e o seguinte ao instante atual', () => {
    expect(neighbourKeyframeTimeMs(marcas, 1200, -1)).toBe(1000)
    expect(neighbourKeyframeTimeMs(marcas, 1200, 1)).toBe(1500)
  })

  /** Parado em cima de um keyframe, "próximo" é o seguinte — não ele mesmo. */
  it('em cima de uma marca, cada sentido leva à marca vizinha', () => {
    expect(neighbourKeyframeTimeMs(marcas, 1000, -1)).toBe(0)
    expect(neighbourKeyframeTimeMs(marcas, 1000, 1)).toBe(1500)
  })

  it('nas pontas não há para onde ir', () => {
    expect(neighbourKeyframeTimeMs(marcas, 0, -1)).toBeNull()
    expect(neighbourKeyframeTimeMs(marcas, 4000, 1)).toBeNull()
    expect(neighbourKeyframeTimeMs([], 0, 1)).toBeNull()
  })
})

/**
 * Em qual keyframe a linha do tempo parou — o que o painel marca depois de um
 * ⏮/⏭ (pedido do usuário).
 */
describe('keyframeIndexAtTimeMs', () => {
  const anim = animation([1000, 1000, 500])

  it('em cima de um keyframe, devolve o índice dele', () => {
    expect(keyframeIndexAtTimeMs(anim, 0)).toBe(0)
    expect(keyframeIndexAtTimeMs(anim, 1000)).toBe(1)
    expect(keyframeIndexAtTimeMs(anim, 1500)).toBe(2)
  })

  /**
   * No MEIO de um trecho não há keyframe sob o playhead — e a resposta certa é
   * "nenhum". É o que separa esta leitura do âncora do papel-cebola, que nesse
   * caso devolve o keyframe de trás.
   */
  it('no meio de um trecho, não devolve keyframe nenhum', () => {
    expect(keyframeIndexAtTimeMs(anim, 400)).toBe(-1)
    expect(keyframeIndexAtTimeMs(anim, 1499)).toBe(-1)
  })

  it('arredonda ao milissegundo, que é como os instantes chegam', () => {
    expect(keyframeIndexAtTimeMs(anim, 1000.4)).toBe(1)
    expect(keyframeIndexAtTimeMs(anim, 999.6)).toBe(1)
  })

  it('sem animação, ou passado o fim, não há keyframe nenhum', () => {
    expect(keyframeIndexAtTimeMs(null, 0)).toBe(-1)
    expect(keyframeIndexAtTimeMs(anim, 9000)).toBe(-1)
  })
})

describe('stepFrameMs', () => {
  it('em cima da grade, anda exatamente um quadro para cada lado', () => {
    expect(stepFrameMs(480, 25, 1, 10_000)).toBe(520)
    expect(stepFrameMs(480, 25, -1, 10_000)).toBe(440)
  })

  /**
   * A 60 fps o quadro dura 16,666… ms. Arredondar o resultado ao milissegundo
   * faria o passo seguinte reentrar antes da marca e a seta emperrar — este
   * teste é o que trava essa regressão.
   */
  it('a 60 fps seis passos dão seis quadros, sem emperrar no meio', () => {
    let t = 0
    const visitados: number[] = []
    for (let i = 0; i < 6; i += 1) {
      t = stepFrameMs(t, 60, 1, 10_000)
      visitados.push(t)
    }
    expect(t).toBeCloseTo(100, 6)
    expect(new Set(visitados).size).toBe(6)
  })

  it('entre dois quadros, cada seta cai no vizinho daquele lado', () => {
    expect(stepFrameMs(500, 25, 1, 10_000)).toBe(520)
    expect(stepFrameMs(500, 25, -1, 10_000)).toBe(480)
  })

  it('não sai da linha do tempo', () => {
    expect(stepFrameMs(0, 30, -1, 1000)).toBe(0)
    expect(stepFrameMs(1000, 30, 1, 1000)).toBe(1000)
  })

  it('fps inválido não mexe no instante', () => {
    expect(stepFrameMs(700, 0, 1, 1000)).toBe(700)
  })
})

/** Item 38 — grupos rotulados de keyframes. */
describe('keyframeGroups', () => {
  const comRotulos = (labels: readonly (string | undefined)[]): Animation => ({
    id: 'a1',
    name: 'A',
    speed: 1,
    keyframes: labels.map((label, index) => ({
      ...keyframe({ id: `k${index + 1}`, durationMs: 1000 }),
      ...(label === undefined ? {} : { label }),
    })),
  })

  it('junta keyframes CONSECUTIVOS com o mesmo rótulo', () => {
    const grupos = keyframeGroups(comRotulos(['Andando', 'Andando', 'Pulando', undefined]))

    expect(grupos.map((g) => [g.label, g.startIndex, g.endIndex])).toEqual([
      ['Andando', 0, 1],
      ['Pulando', 2, 2],
    ])
  })

  /** O grupo cobre até o keyframe seguinte: a transição que sai dele é parte do movimento. */
  it('mede o começo e o fim de cada grupo na linha do tempo', () => {
    const [andando, pulando] = keyframeGroups(comRotulos(['Andando', 'Andando', 'Pulando', undefined]))

    expect([andando.startMs, andando.endMs]).toEqual([0, 2000])
    expect([pulando.startMs, pulando.endMs]).toEqual([2000, 3000])
  })

  it('o último grupo termina no fim da linha do tempo', () => {
    const [grupo] = keyframeGroups(comRotulos([undefined, 'Fim', 'Fim']))
    expect([grupo.startMs, grupo.endMs]).toEqual([1000, 2000])
  })

  it('keyframes sem rótulo não formam grupo nenhum', () => {
    expect(keyframeGroups(comRotulos([undefined, undefined]))).toEqual([])
    expect(keyframeGroups(comRotulos(['  ', undefined]))).toEqual([])
  })

  /** Mesmo rótulo em dois trechos separados são DOIS grupos, não um. */
  it('não emenda trechos separados que por acaso tenham o mesmo nome', () => {
    const grupos = keyframeGroups(comRotulos(['Andando', undefined, 'Andando']))
    expect(grupos).toHaveLength(2)
  })

  it('o rótulo sobrevive à ida e volta pela sanitização, e o vazio some', () => {
    const bruto = {
      id: 'a1',
      name: 'A',
      keyframes: [
        { ...keyframe({ id: 'k1' }), label: ' Andando ' },
        { ...keyframe({ id: 'k2' }), label: '   ' },
        { ...keyframe({ id: 'k3' }), label: 42 },
      ],
    }
    const [lida] = sanitizeAnimations([bruto])

    expect(lida.keyframes.map((k) => k.label)).toEqual(['Andando', undefined, undefined])
  })
})

describe('moveKeyframeBlock (#117)', () => {
  const comRotulos = (labels: readonly (string | undefined)[]): AnimationKeyframe[] =>
    labels.map((label, index) => ({
      ...keyframe({ id: `k${index + 1}`, durationMs: 1000 }),
      ...(label === undefined ? {} : { label }),
    }))

  const ids = (keyframes: readonly AnimationKeyframe[]) => keyframes.map((k) => k.id)

  it('o bloco inteiro pula o bloco VIZINHO inteiro, com a ordem interna intacta', () => {
    const keyframes = comRotulos(['Andando', 'Andando', 'Andando', 'Correndo', 'Correndo'])

    // "Correndo" (índices 3-4) sobe: passa por cima dos TRÊS de "Andando".
    expect(ids(moveKeyframeBlock(keyframes, 3, -1))).toEqual(['k4', 'k5', 'k1', 'k2', 'k3'])
    // E desce de volta ao lugar — a operação é reversível.
    expect(ids(moveKeyframeBlock(moveKeyframeBlock(keyframes, 3, -1), 0, 1))).toEqual(ids(keyframes))
  })

  /** Meio bloco dentro do outro PARTIRIA o vizinho em dois grupos (#38). */
  it('qualquer keyframe do bloco serve de pega: o bloco anda inteiro', () => {
    const keyframes = comRotulos(['Andando', 'Andando', 'Correndo', 'Correndo'])
    expect(ids(moveKeyframeBlock(keyframes, 3, -1))).toEqual(['k3', 'k4', 'k1', 'k2'])
  })

  it('vizinho SOLTO (sem rótulo) é pulado um a um', () => {
    const keyframes = comRotulos([undefined, undefined, 'Fim', 'Fim'])
    expect(ids(moveKeyframeBlock(keyframes, 2, -1))).toEqual(['k1', 'k3', 'k4', 'k2'])
  })

  it('keyframe sem rótulo é um bloco de um só', () => {
    const keyframes = comRotulos(['Andando', 'Andando', undefined])
    expect(ids(moveKeyframeBlock(keyframes, 2, -1))).toEqual(['k3', 'k1', 'k2'])
  })

  it('nas pontas não faz nada — e devolve a MESMA lista, para não empilhar undo', () => {
    const keyframes = comRotulos(['Andando', 'Andando', 'Correndo'])
    expect(moveKeyframeBlock(keyframes, 0, -1)).toBe(keyframes)
    expect(moveKeyframeBlock(keyframes, 2, 1)).toBe(keyframes)
    expect(moveKeyframeBlock(keyframes, 9, -1)).toBe(keyframes)
  })

  it('as durações viajam com os keyframes: a linha do tempo se refaz na ordem nova', () => {
    const keyframes = [
      { ...keyframe({ id: 'k1', durationMs: 500 }), label: 'Andando' },
      { ...keyframe({ id: 'k2', durationMs: 700 }), label: 'Andando' },
      { ...keyframe({ id: 'k3', durationMs: 900 }), label: 'Correndo' },
    ]
    expect(moveKeyframeBlock(keyframes, 2, -1).map((k) => k.durationMs)).toEqual([900, 500, 700])
  })
})

describe('uniqueKeyframeLabel', () => {
  const comRotulos = (labels: readonly (string | undefined)[]): AnimationKeyframe[] =>
    labels.map((label, index) => ({
      ...keyframe({ id: `k${index + 1}` }),
      ...(label === undefined ? {} : { label }),
    }))

  it('rótulo inédito passa como está, sem sufixo', () => {
    expect(uniqueKeyframeLabel(comRotulos([undefined, undefined]), 0, 'Andando')).toBe('Andando')
  })

  it('estender o grupo vizinho é legítimo — o mesmo rótulo é aceito', () => {
    const keyframes = comRotulos(['Andando', undefined, undefined])
    expect(uniqueKeyframeLabel(keyframes, 1, 'Andando')).toBe('Andando')
  })

  /** Dois trechos de caminhada viram "Andando" e "Andando 2". */
  it('rótulo já usado em outro trecho ganha sufixo numérico', () => {
    const keyframes = comRotulos(['Andando', 'Andando', undefined, undefined])
    expect(uniqueKeyframeLabel(keyframes, 3, 'Andando')).toBe('Andando 2')
  })

  it('o sufixo continua a contagem em vez de empilhar números', () => {
    const keyframes = comRotulos(['Andando 1', undefined, 'Andando 2', undefined, undefined])
    expect(uniqueKeyframeLabel(keyframes, 4, 'Andando 1')).toBe('Andando 3')
  })

  it('texto vazio (ou só espaços) tira o keyframe do grupo', () => {
    expect(uniqueKeyframeLabel(comRotulos(['Andando']), 0, '   ')).toBe('')
  })

  it('renomear o próprio keyframe para o que ele já tinha não gera sufixo', () => {
    const keyframes = comRotulos(['Andando'])
    expect(uniqueKeyframeLabel(keyframes, 0, 'Andando')).toBe('Andando')
  })
})

describe('freeKeyframeLabel', () => {
  const comRotulos = (labels: readonly (string | undefined)[]): AnimationKeyframe[] =>
    labels.map((label, index) => ({
      ...keyframe({ id: `k${index + 1}` }),
      ...(label === undefined ? {} : { label }),
    }))

  it('rótulo inédito passa como está', () => {
    expect(freeKeyframeLabel(comRotulos([undefined]), 'Andando 1')).toBe('Andando 1')
  })

  /** Dois trechos "Andando" seguidos são dois grupos, não um bloco só. */
  it('rótulo já usado ganha sufixo mesmo estando grudado no fim', () => {
    expect(freeKeyframeLabel(comRotulos(['Andando 1', 'Andando 1']), 'Andando 1')).toBe('Andando 2')
  })

  it('continua a contagem quando os anteriores já foram numerados', () => {
    const keyframes = comRotulos(['Andando 1', 'Andando 2', 'Pulando 1'])
    expect(freeKeyframeLabel(keyframes, 'Andando 1')).toBe('Andando 3')
    expect(freeKeyframeLabel(keyframes, 'Pulando 1')).toBe('Pulando 2')
  })

  it('texto vazio continua vazio — o trecho entra sem grupo', () => {
    expect(freeKeyframeLabel(comRotulos(['Andando 1']), '  ')).toBe('')
  })
})

/**
 * Fase 13: o MP4 em profundidade é uma saída ALTERNATIVA, gerada numa
 * exportação própria — o sufixo é o que impede que ela sobrescreva o vídeo
 * normal da mesma animação, que tem exatamente o mesmo nome.
 */
describe('formatAnimationFilename', () => {
  it('sanitiza o nome da animação, como o instantâneo faz com o da cena', () => {
    expect(formatAnimationFilename('Minha Animação')).toBe('Minha-Animação.mp4')
  })

  it('marca o mapa de profundidade com o sufixo `_depth`', () => {
    expect(formatAnimationFilename('Minha Animação', { depth: true })).toBe('Minha-Animação_depth.mp4')
  })
})

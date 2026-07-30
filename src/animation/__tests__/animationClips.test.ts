import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  ANIMATION_CLIPS,
  ANIMATION_CLIP_KEYS,
  resolveClipFigure,
  type AnimationClipKey,
  type ClipFigureSpec,
} from '../animationClips'
import { lowestJointY, neutralGroundClearanceM } from '../../figure/poseGround'
import { getMirroredJointName, mirrorRotation } from '../../figure/poseMirror'
import { JOINT_NAMES, clampJointRotation } from '../../figure/skeleton'

/** Todos os (passo, papel) de um trecho, com o índice do passo. */
function figurasDoTrecho(key: AnimationClipKey): { index: number; role: 'a' | 'b'; spec: ClipFigureSpec }[] {
  const result: { index: number; role: 'a' | 'b'; spec: ClipFigureSpec }[] = []
  ANIMATION_CLIPS[key].steps.forEach((step, index) => {
    result.push({ index, role: 'a', spec: step.a })
    if (step.b) result.push({ index, role: 'b', spec: step.b })
  })
  return result
}

describe('animationClips — estrutura', () => {
  it('a lista de chaves e a tabela têm exatamente os mesmos trechos', () => {
    expect([...ANIMATION_CLIP_KEYS].sort()).toEqual(Object.keys(ANIMATION_CLIPS).sort())
  })

  it('todo trecho tem de 5 a 15 passos, com durações válidas', () => {
    for (const key of ANIMATION_CLIP_KEYS) {
      const { steps } = ANIMATION_CLIPS[key]
      expect(steps.length, key).toBeGreaterThanOrEqual(5)
      expect(steps.length, key).toBeLessThanOrEqual(15)
      for (const step of steps) expect(step.durationMs, key).toBeGreaterThanOrEqual(1)
    }
  })

  it('trecho individual nunca tem papel B; trecho em dupla tem B em TODOS os passos', () => {
    for (const key of ANIMATION_CLIP_KEYS) {
      const clip = ANIMATION_CLIPS[key]
      for (const step of clip.steps) {
        if (clip.kind === 'solo') expect(step.b, key).toBeUndefined()
        else expect(step.b, key).toBeDefined()
      }
    }
  })

  it('toda pose resolvida é completa e já está dentro dos limites das juntas', () => {
    for (const key of ANIMATION_CLIP_KEYS) {
      for (const { index, role, spec } of figurasDoTrecho(key)) {
        const { pose } = resolveClipFigure(spec, 0)
        for (const [jointName, rotation] of Object.entries(pose)) {
          expect(JOINT_NAMES, `${key} k${index + 1} ${role}`).toContain(jointName)
          expect(clampJointRotation(jointName, rotation), `${key} k${index + 1} ${role} ${jointName}`).toEqual(
            rotation,
          )
        }
      }
    }
  })
})

describe('animationClips — contato com o chão', () => {
  /**
   * Passos SEM contato com o chão de propósito: ápice e beira do salto, fase
   * aérea da corrida, quem é carregado (nas costas/no colo), o rolamento do
   * mata-leão deitado e quem termina deitado POR CIMA do outro. Tudo o mais
   * tem de estar encostado no chão — foi para isso que os passos com pernas
   * fora do preset usam o assentamento numérico (`seat`).
   */
  const NO_AR: Partial<Record<AnimationClipKey, string[]>> = {
    running: ['k2 a', 'k4 a', 'k6 a', 'k8 a'],
    jumping: ['k4 a', 'k5 a'],
    piggyback: ['k4 b', 'k5 b', 'k6 b', 'k7 b'],
    carryCradle: ['k4 b', 'k5 b', 'k6 b', 'k7 b'],
    rearChokeGround: ['k4 a', 'k4 b', 'k5 b', 'k6 b', 'k7 b'],
    kneeStrike: ['k5 b', 'k6 b', 'k7 b'],
  }

  it('todo passo apoiado fica a poucos milímetros do chão; os aéreos são exatamente os esperados', () => {
    const folga = neutralGroundClearanceM()

    for (const key of ANIMATION_CLIP_KEYS) {
      const aereos = new Set(NO_AR[key] ?? [])
      for (const { index, role, spec } of figurasDoTrecho(key)) {
        const resolved = resolveClipFigure(spec, 0)
        const maisBaixo = lowestJointY(resolved.pose, resolved.rotation) + resolved.groundOffsetM
        const rotulo = `${key} k${index + 1} ${role}`

        if (aereos.has(`k${index + 1} ${role}`)) {
          // "No ar" de verdade: bem acima da folga neutra (1 cm).
          expect(maisBaixo, rotulo).toBeGreaterThan(folga + 0.02)
        } else {
          // Apoiado: nunca atravessa mais de 2 cm nem "flutua" além do que
          // uma pose apoiada no corpo diverge por natureza — a junta é o
          // CENTRO de uma esfera, então sentado no glúteo a junta mais baixa
          // fica a ~9,5 cm (é o caso do mata-leão sentado; mesma análise de
          // divergência do #57). Os aéreos de verdade ficam bem acima disso.
          expect(maisBaixo, rotulo).toBeGreaterThan(-0.02)
          expect(maisBaixo, rotulo).toBeLessThan(0.1)
        }
      }
    }
  })
})

describe('animationClips — andar e correr', () => {
  it.each(['walking', 'running'] as const)('%s: primeiro e último passo têm a MESMA pose (ciclo emendável)', (key) => {
    const { steps } = ANIMATION_CLIPS[key]
    const primeiro = resolveClipFigure(steps[0].a, 0)
    const ultimo = resolveClipFigure(steps[steps.length - 1].a, 0)
    expect(ultimo.pose).toEqual(primeiro.pose)
    expect(ultimo.groundOffsetM).toBe(primeiro.groundOffsetM)
  })

  it.each([
    ['walking', 2.4],
    ['running', 4.4],
  ] as const)('%s: avança em linha reta até %f m, sem andar para trás', (key, totalM) => {
    const zs = ANIMATION_CLIPS[key].steps.map((step) => step.a.at[1])
    for (let i = 1; i < zs.length; i += 1) expect(zs[i]).toBeGreaterThan(zs[i - 1])
    expect(zs[zs.length - 1]).toBeCloseTo(totalM, 6)
  })

  it('a passada oposta é o espelho sagital EXATO da primeira (referência invertida L/R)', () => {
    const { steps } = ANIMATION_CLIPS.walking
    const passada = resolveClipFigure(steps[0].a, 0).pose
    const oposta = resolveClipFigure(steps[2].a, 0).pose

    for (const jointName of Object.keys(passada)) {
      const par = getMirroredJointName(jointName)
      const esperado = par
        ? clampJointRotation(jointName, mirrorRotation(passada[par]))
        : clampJointRotation(jointName, mirrorRotation(passada[jointName]))
      expect(oposta[jointName], jointName).toEqual(esperado)
    }
  })

  it('o salto sobe de verdade no ápice e volta ao chão no mesmo lugar', () => {
    const { steps } = ANIMATION_CLIPS.jumping
    const apice = resolveClipFigure(steps[3].a, 0)
    expect(apice.groundOffsetM).toBeCloseTo(0.35, 4)
    for (const step of steps) expect(step.a.at).toEqual([0, 0])
    expect(resolveClipFigure(steps[steps.length - 1].a, 0).pose).toEqual(resolveClipFigure(steps[0].a, 0).pose)
  })
})

describe('animationClips — dança pop (K-pop)', () => {
  const SOLO_KPOP = ['kpopFingerHeart', 'kpopBoxArms', 'kpopPointDance', 'kpopShoulderWave'] as const

  it('nenhum dos 4 desloca o boneco no chão — o gesto é tudo', () => {
    for (const key of SOLO_KPOP) {
      for (const step of ANIMATION_CLIPS[key].steps) expect(step.a.at, key).toEqual([0, 0])
    }
  })

  it('coração e robô: começam e terminam em pé, passando pela pose do gesto no meio', () => {
    for (const key of ['kpopFingerHeart', 'kpopBoxArms'] as const) {
      const { steps } = ANIMATION_CLIPS[key]
      expect(steps[0].a.preset, key).toBe('standing')
      expect(steps[steps.length - 1].a.preset, key).toBe('standing')
      expect(steps[1].a.preset, key).toBe(key)
    }
  })

  it('apontar e onda de ombro: o passo espelhado é o espelho sagital EXATO do passo normal', () => {
    for (const key of ['kpopPointDance', 'kpopShoulderWave'] as const) {
      const { steps } = ANIMATION_CLIPS[key]
      const normalStep = steps.find((step) => step.a.preset === key && !step.a.mirror)!
      const espelhadoStep = steps.find((step) => step.a.preset === key && step.a.mirror)!
      const normal = resolveClipFigure(normalStep.a, 0).pose
      const espelhado = resolveClipFigure(espelhadoStep.a, 0).pose

      for (const jointName of Object.keys(normal)) {
        const par = getMirroredJointName(jointName)
        const esperado = par
          ? clampJointRotation(jointName, mirrorRotation(normal[par]))
          : clampJointRotation(jointName, mirrorRotation(normal[jointName]))
        expect(espelhado[jointName], `${key} ${jointName}`).toEqual(esperado)
      }
    }
  })

  it('robô: o braço que recolhe em cada passo fica com o cotovelo reto e o ombro no neutro', () => {
    const { steps } = ANIMATION_CLIPS.kpopBoxArms
    const recolhidoL = resolveClipFigure(steps[2].a, 0).pose
    expect(recolhidoL['elbow.L'].x).toBe(0)
    expect(recolhidoL['shoulder.L'].z).toBe(0)
    // O braço direito continua erguido nesse passo.
    expect(recolhidoL['elbow.R'].x).toBe(-90)

    const recolhidoR = resolveClipFigure(steps[4].a, 0).pose
    expect(recolhidoR['elbow.R'].x).toBe(0)
    expect(recolhidoR['shoulder.R'].z).toBe(0)
    expect(recolhidoR['elbow.L'].x).toBe(-90)
  })
})

describe('animationClips — joelhada com cambalhota', () => {
  /**
   * A partir do contato, B declara `rotation` por extenso (`{x, y:0, z:180}`,
   * `z` sempre 180) em vez de `turnDeg` — ver o comentário do trecho em
   * `animationClips.ts`: compor `rotation.x` com `turnDeg` faria a matriz
   * devolver o giro espalhado em eixos DIFERENTES a cada passo, e como o
   * player interpola X/Y/Z separados pelo menor arco, isso rasgaria um giro
   * espúrio. Com Y e Z parados nesses passos, só X varia.
   */
  it('do contato até o pouso, Y e Z ficam parados e X varia em exatamente 90° por passo, sempre no mesmo sentido', () => {
    const { steps } = ANIMATION_CLIPS.kneeStrike
    const rotacoes = steps.slice(3).map((step) => resolveClipFigure(step.b!, 0).rotation)
    for (const r of rotacoes) {
      expect(r.y).toBe(0)
      expect(r.z).toBe(180)
    }
    const rotacoesX = rotacoes.map((r) => r.x)
    expect(rotacoesX).toEqual([180, 90, 0, -90, 180])
    for (let i = 1; i < rotacoesX.length; i += 1) {
      const delta = ((rotacoesX[i] - rotacoesX[i - 1] + 540) % 360) - 180
      expect(delta).toBeCloseTo(-90, 6)
    }
  })

  it('B decola À FRENTE de A e aterrissa ATRÁS dele, tendo voado por cima', () => {
    const { steps } = ANIMATION_CLIPS.kneeStrike
    const zDeA = steps[3].a.at[1]
    const zDeB = steps.slice(3).map((step) => step.b!.at[1])
    // Contato e decolagem: B ainda à frente de A.
    expect(zDeB[0]).toBeGreaterThan(zDeA)
    expect(zDeB[1]).toBeGreaterThan(zDeA)
    // Pico: passando por cima de A (bem perto da posição dele).
    expect(Math.abs(zDeB[2] - zDeA)).toBeLessThan(0.15)
    // Descida e aterrissagem: já do outro lado, atrás de A.
    expect(zDeB[3]).toBeLessThan(zDeA)
    expect(zDeB[4]).toBeLessThan(zDeA)
  })

  it('B aterrissa de COSTAS para A: a mesma orientação física do início (virado para -Z), com A atrás dele', () => {
    const { steps } = ANIMATION_CLIPS.kneeStrike
    const descanso = resolveClipFigure(steps[0].b!, 0)
    const pouso = steps[steps.length - 1]
    const resolvedPouso = resolveClipFigure(pouso.b!, 0)
    // Mesma matriz de rotação do repouso inicial — só a decomposição Euler
    // difere ({0,180,0} em pé vs {180,0,180} pós-cambalhota, ver comentário
    // acima) — comparadas por matriz, como no teste de "compõe o giro".
    const matrixOf = (rot: { x: number; y: number; z: number }) =>
      new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(rot.x),
          THREE.MathUtils.degToRad(rot.y),
          THREE.MathUtils.degToRad(rot.z),
          'XYZ',
        ),
      )
    const esperada = matrixOf(descanso.rotation)
    const obtida = matrixOf(resolvedPouso.rotation)
    esperada.elements.forEach((valor, i) => expect(obtida.elements[i]).toBeCloseTo(valor, 6))
    // A está em Z maior que B (a frente do corpo de B aponta para o lado de
    // Z menor, então A cai atrás — nas costas).
    expect(pouso.a.at[1]).toBeGreaterThan(pouso.b!.at[1])
  })

  it('a altura do voo sobe e desce (pico mais alto que decolagem e descida)', () => {
    const { steps } = ANIMATION_CLIPS.kneeStrike
    const alturas = [4, 5, 6].map((index) => steps[index].b!.hipHeightM!)
    expect(alturas[1]).toBeGreaterThan(alturas[0])
    expect(alturas[1]).toBeGreaterThan(alturas[2])
  })
})

describe('animationClips — chave de braço sentada', () => {
  it('o puxão final também encaixa no par medido, no último passo', () => {
    const { steps } = ANIMATION_CLIPS.armLock
    const pouso = steps[steps.length - 1]
    expect(pouso.a.preset).toBe('armLockPullGiving')
    expect(pouso.b!.preset).toBe('armLockPullTaking')
    expect(pouso.b!.at[0]).toBeCloseTo(pouso.a.at[0], 6)
    expect(pouso.b!.at[1] - pouso.a.at[1]).toBeCloseTo(0.238, 6)
  })

  it('B fica parado do início ao fim — quem se desloca é A, vindo de trás', () => {
    const { steps } = ANIMATION_CLIPS.armLock
    for (const step of steps) expect(step.b!.at).toEqual([0, 0.238])
  })
})

describe('animationClips — encaixes das duplas', () => {
  /**
   * O instante de contato de cada cena usa as poses em par de `posePresets.ts`
   * na MESMA distância medida em `posePairs.ts` — mudou lá, este teste acusa
   * aqui. (Assinado no eixo Z do trecho: negativo = atrás do papel A.)
   */
  it.each([
    ['handshake', 2, 'handshake', 'handshake', 0.755],
    ['punch', 2, 'punchGiving', 'punchTaking', 0.629],
    ['kick', 2, 'kickGiving', 'kickTaking', 0.815],
    ['kneeStrike', 3, 'kneeStrikeGiving', 'kneeStrikeTaking', 0.3653],
    ['armLock', 3, 'armLockPushGiving', 'armLockPushTaking', 0.238],
    ['clinch', 2, 'clinch', 'clinch', 0.4],
    ['rearChokeStanding', 2, 'chokeGiving', 'chokeTaking', 0.39],
    ['rearChokeSeated', 3, 'rearChokeKneeling', 'rearChokeSeated', 0.45],
    ['rearChokeGround', 4, 'groundChokeGiving', 'groundChokeTaking', 0.1],
    ['piggyback', 3, 'carryingPiggyback', 'carriedPiggyback', -0.16],
    ['carryCradle', 4, 'carryingCradle', 'carriedCradle', 0.28],
  ] as const)('%s: contato no passo %i com as poses do par à distância medida', (key, index, presetA, presetB, gapM) => {
    const step = ANIMATION_CLIPS[key].steps[index]
    expect(step.a.preset).toBe(presetA)
    expect(step.b!.preset).toBe(presetB)
    expect(step.b!.at[0]).toBeCloseTo(step.a.at[0], 6)
    expect(step.b!.at[1] - step.a.at[1]).toBeCloseTo(gapM, 6)
  })

  it('na dança os dois mantêm a distância do par (0,36 m) durante a volta inteira', () => {
    for (const step of ANIMATION_CLIPS.dance.steps) {
      const dx = step.b!.at[0] - step.a.at[0]
      const dz = step.b!.at[1] - step.a.at[1]
      expect(Math.hypot(dx, dz)).toBeCloseTo(0.36, 4)
      // Sempre de frente um para o outro, girando juntos.
      expect(((step.b!.turnDeg ?? 0) - (step.a.turnDeg ?? 0) + 360) % 360).toBe(180)
    }
  })

  it('a dança fecha a volta: o último passo repete o primeiro (giro de 360° embrulhado para 0)', () => {
    const { steps } = ANIMATION_CLIPS.dance
    const primeiro = { a: resolveClipFigure(steps[0].a, 0), b: resolveClipFigure(steps[0].b!, 0) }
    const ultimo = {
      a: resolveClipFigure(steps[steps.length - 1].a, 0),
      b: resolveClipFigure(steps[steps.length - 1].b!, 0),
    }
    expect(ultimo.a.rotation).toEqual(primeiro.a.rotation)
    expect(ultimo.b.rotation).toEqual(primeiro.b.rotation)
    expect(ultimo.a.offset).toEqual(primeiro.a.offset)
    expect(ultimo.b.offset).toEqual(primeiro.b.offset)
  })

  it('no empurrão pelo ombro, B parte de frente (180°) e termina DE COSTAS para A (0°), girando ≤60° por passo', () => {
    const giros = ANIMATION_CLIPS.shoulderSpin.steps.map(
      (step) => resolveClipFigure(step.b!, 0).rotation.y,
    )
    expect(giros[0]).toBe(180)
    expect(giros[giros.length - 1]).toBe(0)
    // Cada passo gira no máximo 60°: a interpolação pelo menor arco nunca
    // inverte o sentido do giro no meio do caminho.
    for (let i = 1; i < giros.length; i += 1) {
      const delta = Math.abs(((giros[i] - giros[i - 1] + 540) % 360) - 180)
      expect(delta).toBeLessThanOrEqual(60)
    }
  })

  it('nos mata-leões os dois começam EM PÉ, com B já de costas para A (pedido do usuário)', () => {
    for (const key of ['rearChokeStanding', 'rearChokeSeated', 'rearChokeGround'] as const) {
      const primeiro = ANIMATION_CLIPS[key].steps[0]
      expect(primeiro.a.preset, key).toBe('standing')
      expect(primeiro.b!.preset, key).toBe('standing')
      // Mesmo heading (nenhum girado 180°): B está de costas para A, que vem atrás.
      expect(primeiro.a.turnDeg ?? 0, key).toBe(0)
      expect(primeiro.b!.turnDeg ?? 0, key).toBe(0)
      expect(primeiro.a.at[1], key).toBeLessThan(primeiro.b!.at[1])
    }
  })
})

describe('animationClips — resolução no referencial do boneco-âncora', () => {
  it('gira deslocamento e rotação pelo heading: com A virado a 90°, "para a frente" é +X', () => {
    const resolved = resolveClipFigure({ preset: 'standing', at: [0, 2] }, 90)
    expect(resolved.offset[0]).toBeCloseTo(2, 6)
    expect(resolved.offset[1]).toBeCloseTo(0, 6)
    expect(resolved.rotation).toEqual({ x: 0, y: 90, z: 0 })
  })

  it('compõe o giro com a rotação imposta pela pose por matriz (deitado + heading), como nos pares', () => {
    // Deitado de costas (rotação -90 em X) girado 90° no chão: a orientação
    // resultante tem de ser EXATAMENTE Ry(90)·Rx(-90) — a mesma composição de
    // `resolvePairedRotation`. Somar graus em Y rolaria o corpo em torno do
    // próprio eixo; comparar matrizes mede a orientação de fato, não a
    // representação em Euler que a decomposição escolheu.
    const deitado = resolveClipFigure({ preset: 'groundChokeGiving', at: [0, 0] }, 90)
    const esperada = new THREE.Matrix4()
      .makeRotationY(Math.PI / 2)
      .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    const obtida = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(deitado.rotation.x),
        THREE.MathUtils.degToRad(deitado.rotation.y),
        THREE.MathUtils.degToRad(deitado.rotation.z),
        'XYZ',
      ),
    )
    esperada.elements.forEach((valor, i) => expect(obtida.elements[i]).toBeCloseTo(valor, 6))
  })

  it('`rotation` do passo vence a do preset — as fases de tombar/rolar', () => {
    const meioRolamento = resolveClipFigure(
      { preset: 'groundChokeGiving', rotation: { x: -60 }, hipHeightM: 0.25, at: [0, 0] },
      0,
    )
    expect(meioRolamento.rotation).toEqual({ x: -60, y: 0, z: 0 })
    expect(meioRolamento.groundOffsetM).toBeCloseTo(0.25 - 0.9, 4)
  })

  it('`seat` da pose em pé dá deslocamento zero — o contrato do assentamento numérico', () => {
    expect(resolveClipFigure({ preset: 'standing', seat: true, at: [0, 0] }, 0).groundOffsetM).toBe(0)
  })
})

/**
 * Pirueta de balé (pedido do usuário): duas voltas completas sobre uma perna.
 */
describe('animationClips — pirueta de balé', () => {
  const passos = ANIMATION_CLIPS.balletPirouette.steps

  it('sai do plié, gira em retiré e volta ao plié', () => {
    expect(passos[0].a.preset).toBe('standing')
    expect(passos[1].a.preset).toBe('balletPreparation')
    expect(passos[passos.length - 2].a.preset).toBe('balletPreparation')
    expect(passos[passos.length - 1].a.preset).toBe('standing')

    const girando = passos.filter((passo) => passo.a.preset === 'balletPirouette')
    expect(girando.length).toBeGreaterThanOrEqual(6)
  })

  it('soma exatamente duas voltas, sempre no mesmo sentido', () => {
    const giros = passos.map((passo) => passo.a.turnDeg ?? 0)

    expect(giros[giros.length - 1]).toBe(720)
    for (let i = 1; i < giros.length; i += 1) expect(giros[i]).toBeGreaterThanOrEqual(giros[i - 1])
  })

  /**
   * A trava que importa: a interpolação da rotação do boneco (`lerpAngle`, em
   * `poseBlend.ts`) toma sempre o caminho MAIS CURTO. Um passo de 180° resolve
   * para −180 e faria o boneco girar ao contrário; qualquer passo maior que
   * 180 dá a volta pelo lado errado. Por isso os degraus são de 120°.
   */
  it('nenhum degrau de giro chega a 180°, senão a volta sairia ao contrário', () => {
    const giros = passos.map((passo) => passo.a.turnDeg ?? 0)

    for (let i = 1; i < giros.length; i += 1) {
      expect(giros[i] - giros[i - 1], `passo ${i}`).toBeLessThan(180)
    }
  })

  it('gira no lugar: o boneco não sai do ponto de apoio', () => {
    for (const passo of passos) expect(passo.a.at).toEqual([0, 0])
  })
})

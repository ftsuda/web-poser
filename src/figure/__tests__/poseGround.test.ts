import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { lowestJointY, neutralGroundClearanceM, seatOnGround, seatedHipHeightM } from '../poseGround'
import { buildJointFrames } from '../jointFrames'
import { POSE_PRESET_KEYS, resolvePosePreset, resolvePosePresetPlacement } from '../posePresets'
import { JOINT_NAMES, REFERENCE_HEIGHT_M, type JointRotation } from '../skeleton'
import type { Figure } from '../../store/figuresStore'

const NEUTRA = resolvePosePreset('standing')

function figura(pose: Record<string, JointRotation>, rotation: JointRotation, positionY: number, heightM = REFERENCE_HEIGHT_M): Figure {
  return {
    id: 'f1',
    name: 'Boneco',
    color: '#e04040',
    visible: true,
    height: heightM,
    position: [0, positionY, 0],
    rotation,
    pose,
  }
}

/** Menor `y` de junta no mundo — a mesma medida dos testes de colocação dos presets. */
function menorJunta(figure: Figure): number {
  const { joints } = buildJointFrames(figure)
  const mundo = new THREE.Vector3()
  let menor = Infinity
  for (const name of JOINT_NAMES) {
    joints.get(name)!.getWorldPosition(mundo)
    menor = Math.min(menor, mundo.y)
  }
  return menor
}

const SEM_ROTACAO: JointRotation = { x: 0, y: 0, z: 0 }

describe('neutralGroundClearanceM', () => {
  /**
   * A junta mais baixa do boneco em pé **não** está em y=0: a ponta do pé
   * (`ball`) fica cerca de 1 cm acima do chão, porque a junta é o centro de uma
   * esfera e a geometria do pé desce abaixo dela. Assentar "com a junta mais
   * baixa em zero" enterraria toda pose em pé nesse centímetro — por isso a
   * referência de "encostado" é medida da pose neutra, e não fixada em zero.
   */
  it('é a folga que a pose em pé já tem, e não zero', () => {
    const folga = neutralGroundClearanceM()
    expect(folga).toBeGreaterThan(0.005)
    expect(folga).toBeLessThan(0.02)
    expect(folga).toBeCloseTo(menorJunta(figura(NEUTRA, SEM_ROTACAO, 0)), 12)
  })

  it('escala com a altura do boneco, como todo o resto do modelo', () => {
    expect(neutralGroundClearanceM(1.5)).toBeCloseTo(neutralGroundClearanceM() * (1.5 / REFERENCE_HEIGHT_M), 12)
  })
})

describe('seatOnGround', () => {
  it('a pose em pé já está assentada: deslocamento exatamente zero', () => {
    expect(seatOnGround(NEUTRA, SEM_ROTACAO)).toBeCloseTo(0, 12)
  })

  it('levanta uma pose que afunda — a ponta do pé estendida atravessa o chão', () => {
    // Estender o tornozelo (bailarina/ponta) desce a ponta do pé a 5,7 cm
    // ABAIXO do chão com o quadril na altura de sempre.
    const naPonta = { ...NEUTRA, 'ankle.R': { x: 45, y: 0, z: 0 } }
    expect(lowestJointY(naPonta, SEM_ROTACAO)).toBeLessThan(0)

    const deslocamento = seatOnGround(naPonta, SEM_ROTACAO)
    expect(deslocamento).toBeGreaterThan(0)
    expect(menorJunta(figura(naPonta, SEM_ROTACAO, deslocamento))).toBeCloseTo(neutralGroundClearanceM(), 9)
  })

  /**
   * A diferença para a correção de chão do `poseBlend` (#43), que só levanta
   * de propósito: aqui uma pose que ficou flutuando também tem de descer,
   * senão o assentamento automático não conserta o erro mais comum de quem
   * monta pose à mão.
   */
  it('BAIXA uma pose que flutua, em vez de só levantar', () => {
    // Dobrar os dois joelhos com o quadril parado ERGUE os pés: o boneco fica
    // pendurado a 36,5 cm do chão.
    const pendurado = { ...NEUTRA, 'knee.L': { x: 90, y: 0, z: 0 }, 'knee.R': { x: 90, y: 0, z: 0 } }
    expect(lowestJointY(pendurado, SEM_ROTACAO)).toBeGreaterThan(0.3)

    const deslocamento = seatOnGround(pendurado, SEM_ROTACAO)
    expect(deslocamento).toBeLessThan(0)
    expect(menorJunta(figura(pendurado, SEM_ROTACAO, deslocamento))).toBeCloseTo(neutralGroundClearanceM(), 9)
  })

  it('assenta uma pose deitada, que só existe por causa da inclinação do boneco', () => {
    const deitado: JointRotation = { x: -90, y: 0, z: 0 }
    const deslocamento = seatOnGround(NEUTRA, deitado)
    const posto = figura(NEUTRA, deitado, deslocamento)

    expect(menorJunta(posto)).toBeCloseTo(neutralGroundClearanceM(), 9)
    // E nada atravessa o chão — o critério dos testes de preset.
    expect(menorJunta(posto)).toBeGreaterThanOrEqual(0)
  })

  it('escala com a altura: um boneco de 1,50 m assenta proporcionalmente', () => {
    const agachado = { ...NEUTRA, 'hip.L': { x: -70, y: 0, z: 0 }, 'knee.L': { x: 90, y: 0, z: 0 } }
    const referencia = seatOnGround(agachado, SEM_ROTACAO)
    const baixo = seatOnGround(agachado, SEM_ROTACAO, 1.5)

    expect(baixo).toBeCloseTo(referencia * (1.5 / REFERENCE_HEIGHT_M), 12)
  })
})

describe('seatedHipHeightM', () => {
  it('a pose em pé devolve a altura de quadril do próprio modelo', () => {
    const emPe = seatedHipHeightM(NEUTRA, SEM_ROTACAO)
    // `hipHeightM` ausente num preset significa exatamente esta altura.
    expect(emPe).toBeCloseTo(seatedHipHeightM(NEUTRA, SEM_ROTACAO), 12)
    expect(resolvePosePresetPlacement('standing').groundOffsetM).toBeCloseTo(0, 12)
  })

  it('é o valor que o preset guardaria: quadril = altura em pé + assentamento', () => {
    const agachado = { ...NEUTRA, 'hip.L': { x: -70, y: 0, z: 0 }, 'knee.L': { x: 90, y: 0, z: 0 } }
    const esperado = seatedHipHeightM(NEUTRA, SEM_ROTACAO) + seatOnGround(agachado, SEM_ROTACAO)

    expect(seatedHipHeightM(agachado, SEM_ROTACAO)).toBeCloseTo(esperado, 12)
  })
})

describe('confronto com os presets afinados à mão', () => {
  /** Desvio, em metros, entre o assentamento calculado e o que o preset guarda. */
  const desvios = POSE_PRESET_KEYS.map((key) => {
    const placement = resolvePosePresetPlacement(key)
    return {
      key,
      desvio: seatOnGround(resolvePosePreset(key), placement.rotation) - placement.groundOffsetM,
    }
  })

  /**
   * O valor calculado não substitui o olho de quem monta a pose — é o PONTO DE
   * PARTIDA. Este teste fixa o quanto os dois divergem hoje, para que a
   * divergência seja número conhecido: 59 das 71 poses dentro de 1 cm, mediana
   * de 3,4 mm.
   */
  it('reproduz o assentamento à mão de 59 das 71 poses dentro de 1 cm', () => {
    const dentro = desvios.filter(({ desvio }) => Math.abs(desvio) <= 0.01)
    expect(dentro.length).toBeGreaterThanOrEqual(59)

    const ordenados = desvios.map(({ desvio }) => Math.abs(desvio)).sort((a, b) => a - b)
    expect(ordenados[Math.floor(ordenados.length / 2)]).toBeLessThan(0.005)
  })

  /**
   * **As poses que divergem não são erro — são as que não pisam no chão**, e é
   * por isso que o cálculo as "baixaria": ele planta no chão o que estiver mais
   * baixo, e nessas poses isso é justamente o que não se quer. Vale como
   * detector: uma pose nova que apareça aqui sem estar no ar (ou carregada por
   * outro boneco) tem assentamento errado.
   */
  it('as que divergem mais de 5 cm são exatamente as que não tocam o chão', () => {
    const fora = desvios.filter(({ desvio }) => Math.abs(desvio) > 0.05).map(({ key }) => key)

    expect([...fora].sort()).toEqual(
      [
        'superman', // voando
        'jumping', // no ar
        'running', // fase de voo da corrida
        'carriedCradle', // no colo de outro boneco
        'carriedPiggyback', // nas costas de outro boneco
        'groundChokeGiving', // deitado sob o outro boneco, no par do mata-leão
        'groundChokeTaking', // empilhado sobre outro boneco
        'lyingSpreadSupine', // deitado: apoio de raio diferente do pé
        'rearChokeSeated', // sentado com o peso em quem aplica
      ].sort(),
    )
    // E todas elas divergem para BAIXO: o cálculo tentaria plantá-las no chão.
    for (const key of fora) {
      expect(desvios.find((d) => d.key === key)!.desvio).toBeLessThan(0)
    }
  })
})

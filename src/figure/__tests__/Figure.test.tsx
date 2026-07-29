import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { Figure, ROOT_PIVOT_REF_NAME } from '../Figure'
import { JOINT_NAMES, REFERENCE_HEIGHT_M, getHeightScale, getJointChain } from '../skeleton'
import type { Figure as FigureData } from '../../store/figuresStore'

function makeFigure(overrides: Partial<FigureData> = {}): FigureData {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: REFERENCE_HEIGHT_M,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: {},
    ...overrides,
  }
}

describe('Figure — manequim de madeira', () => {
  it('renderiza exatamente um grupo por junta do esqueleto (mesmos nomes de Figure)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const jointGroups = JOINT_NAMES.map((name) => renderer.scene.findByProps({ name: `joint-${name}` }))
    expect(jointGroups).toHaveLength(JOINT_NAMES.length)
  })

  /**
   * O `offsetX` das lâminas (DECISOES.md #45) é somado ao ponto médio do osso,
   * ou seja no espaço local da junta PAI — e não à geometria, cujo eixo X vem
   * invertido pela rotação de 180° que alinha o molde ao osso. Este teste é o
   * que trava o SINAL: o bloco de 3 dedos tem de sair para o lado do mindinho
   * (+X no lado L, -X no R), deixando o quarto do polegar para o indicador.
   */
  it('desenha o bloco de 3 dedos deslocado para o lado do mindinho de cada mão', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)

    for (const [side, expected] of [
      ['L', 0.01],
      ['R', -0.01],
    ] as const) {
      const group = renderer.scene.findByProps({ name: `joint-fingersBase.${side}` })
      // Dentro do grupo da junta: as peças dela (nomeadas) e o osso até a
      // junta filha (sem nome) — este último é a lâmina das falanges.
      const blade = group.children.filter((child) => child.props.name === undefined)
      expect(blade).toHaveLength(1)
      expect(blade[0].instance.position.x).toBeCloseTo(expected, 6)

      // E o indicador não é deslocado: quem já está fora do centro é a junta.
      const indexGroup = renderer.scene.findByProps({ name: `joint-indexMid.${side}` })
      const indexBlade = indexGroup.children.filter((child) => child.props.name === undefined)
      expect(indexBlade[0].instance.position.x).toBeCloseTo(0, 6)
    }
  })

  it('aninha as juntas seguindo a hierarquia do esqueleto', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)

    let node = renderer.scene.findByProps({ name: 'joint-shoulder.L' })
    const chainFromNode: string[] = []
    while (node) {
      const name = (node.props.name as string | undefined)?.replace(/^joint-/, '')
      if (name) chainFromNode.unshift(name)
      node = node.parent as typeof node
      if (!node || !(node.props?.name as string | undefined)?.startsWith('joint-')) break
    }

    expect(chainFromNode).toEqual(getJointChain('shoulder.L'))
  })

  it('escala o grupo raiz proporcionalmente à altura e respeita visible=false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ height: 1.9, visible: false })} />,
    )
    const root = renderer.scene.findByProps({ name: 'figure-f1' })
    expect(root.instance.scale.x).toBeCloseTo(getHeightScale(1.9), 5)
    expect(root.instance.visible).toBe(false)
  })

  it('aplica a pose (graus) na junta correspondente e figure.rotation na root', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure
        figure={makeFigure({
          pose: { 'elbow.L': { x: 90, y: 0, z: 0 } },
          rotation: { x: 0, y: 45, z: 0 },
        })}
      />,
    )
    const elbow = renderer.scene.findByProps({ name: 'joint-elbow.L' })
    expect(elbow.instance.rotation.x).toBeCloseTo(THREE.MathUtils.degToRad(90), 5)
    const root = renderer.scene.findByProps({ name: 'joint-root' })
    expect(root.instance.rotation.y).toBeCloseTo(THREE.MathUtils.degToRad(45), 5)
  })

  it('pinta os segmentos do corpo com a cor do boneco', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ color: '#4060e0' })} />,
    )
    const mesh = renderer.scene.findByProps({ name: 'segment-chest' })
    const material = mesh.allChildren.find((child) => child.type === 'MeshStandardMaterial')
    expect((material?.instance as unknown as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      '4060e0',
    )
  })

  it('renderiza a cabeça como ovo torneado (lathe) fechando o topo em +0,15 local (1,70 m no mundo)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const head = renderer.scene.findByProps({ name: 'segment-head' })
    const geometry = (head.instance as unknown as THREE.Mesh).geometry
    expect(geometry.type).toBe('LatheGeometry')

    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.max.y).toBeCloseTo(0.15, 3)
    expect(geometry.boundingBox!.min.y).toBeCloseTo(-0.065, 3)
    // Mais funda (Z) que larga (X), via achatamento invertido do mesh.
    expect(head.instance.scale.z).toBeGreaterThan(head.instance.scale.x)
  })

  it('renderiza pelve e peito como blocos torneados, bem mais largos que uma bola de junta', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)

    const elbow = renderer.scene.findByProps({ name: 'segment-elbow.L' })
    const elbowRadius = elbow.instance.scale.x

    for (const name of ['root', 'chest']) {
      const mesh = renderer.scene.findByProps({ name: `segment-${name}` })
      const geometry = (mesh.instance as unknown as THREE.Mesh).geometry
      expect(geometry.type).toBe('LatheGeometry')
      geometry.computeBoundingSphere()
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(elbowRadius)
    }
  })

  it('renderiza os membros como peças torneadas centradas na origem (do pivô ao pivô filho)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const shoulder = renderer.scene.findByProps({ name: 'joint-shoulder.L' })
    const upperArm = shoulder.children.find(
      (child) =>
        child.type === 'Mesh' &&
        (child.instance as unknown as THREE.Mesh).geometry.type === 'LatheGeometry' &&
        !(child.props.name as string | undefined),
    )
    expect(upperArm).toBeDefined()

    const geometry = (upperArm!.instance as unknown as THREE.Mesh).geometry
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    expect(box.min.y).toBeCloseTo(-box.max.y, 5)
    // Comprimento do úmero = 0,27 m (offset shoulder→elbow do esqueleto, ver DECISOES.md #26).
    expect(box.max.y - box.min.y).toBeCloseTo(0.27, 5)
  })

  it('renderiza a palma como lâmina chata afunilada (prisma trapezoidal), não caixa nem cilindro', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const wrist = renderer.scene.findByProps({ name: 'joint-wrist.L' })
    const palm = wrist.children.find(
      (child) =>
        child.type === 'Mesh' &&
        (child.instance as unknown as THREE.Mesh).geometry.type === 'BufferGeometry',
    )
    expect(palm).toBeDefined()

    const geometry = (palm!.instance as unknown as THREE.Mesh).geometry
    geometry.computeBoundingBox()
    const size = new THREE.Vector3()
    geometry.boundingBox!.getSize(size)
    expect(size.z).toBeLessThan(size.x) // chata: espessura < largura
    expect(geometry.boundingBox!.min.y).toBeCloseTo(-geometry.boundingBox!.max.y, 5) // centrada
  })

  it('não renderiza os ossos cobertos por blocos (root→hip dentro da pelve, ankle→ball dentro da cunha do pé)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)

    // joint-root: só o bloco da pelve + o conector até a spine (sem ossos até os quadris).
    const root = renderer.scene.findByProps({ name: 'joint-root' })
    expect(root.children.filter((child) => child.type === 'Mesh')).toHaveLength(2)

    // joint-ankle.L: as 2 peças do pé (bola + bloco liso), sem osso até ball.L.
    const ankle = renderer.scene.findByProps({ name: 'joint-ankle.L' })
    expect(ankle.children.filter((child) => child.type === 'Mesh')).toHaveLength(2)
  })

  it('mantém as feições na cabeça: ovo + nariz + 2 olhos + 2 orelhas (6 peças, sem boca nem facete de queixo)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const head = renderer.scene.findByProps({ name: 'joint-head' })
    expect(head.children.filter((child) => child.type === 'Mesh')).toHaveLength(6)
  })

  it('mantém os olhos sempre pretos, independente da cor do boneco', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ color: '#4060e0' })} />,
    )
    const head = renderer.scene.findByProps({ name: 'joint-head' })
    const colors = head.children
      .filter((child) => child.type === 'Mesh')
      .map((mesh) => {
        const material = mesh.allChildren.find((child) => child.type === 'MeshStandardMaterial')
        return (material?.instance as unknown as THREE.MeshStandardMaterial).color.getHexString()
      })
    expect(colors.filter((hex) => hex !== '4060e0')).toHaveLength(2)
  })

  it('marca as costas da mão (wrist.L/R) com um pino de latão sempre na mesma cor, independente da cor do boneco', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ color: '#4060e0' })} />,
    )
    for (const side of ['L', 'R'] as const) {
      const wrist = renderer.scene.findByProps({ name: `joint-wrist.${side}` })
      const colors = wrist.children
        .filter((child) => child.type === 'Mesh')
        .map((mesh) => {
          const material = mesh.allChildren.find((child) => child.type === 'MeshStandardMaterial')
          return (material?.instance as unknown as THREE.MeshStandardMaterial).color.getHexString()
        })
      expect(colors.filter((hex) => hex !== '4060e0')).toHaveLength(1)
    }
  })

  it('move a cadeia dos dedos no mundo ao posar fingersBase.L (geometria segue as juntas)', async () => {
    const restRenderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const restPos = new THREE.Vector3()
    ;(
      restRenderer.scene.findByProps({ name: 'joint-fingersTip.L' })
        .instance as unknown as THREE.Object3D
    ).getWorldPosition(restPos)

    const posedRenderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ pose: { 'fingersBase.L': { x: 80, y: 0, z: 0 } } })} />,
    )
    const posedPos = new THREE.Vector3()
    ;(
      posedRenderer.scene.findByProps({ name: 'joint-fingersTip.L' })
        .instance as unknown as THREE.Object3D
    ).getWorldPosition(posedPos)

    expect(posedPos.distanceTo(restPos)).toBeGreaterThan(0.01)
  })

  it('renderiza a sombra elíptica no chão, presa a Y≈0 mesmo com o boneco erguido', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ color: '#4060e0', position: [1.2, 1.5, -0.6] })} />,
    )

    const shadow = renderer.scene.findByProps({ name: 'figure-shadow-f1' })
    expect(shadow.instance.rotation.x).toBeCloseTo(-Math.PI / 2, 5)
    const material = shadow.allChildren.find((child) => child.type === 'MeshBasicMaterial')
    const mat = material?.instance as unknown as THREE.MeshBasicMaterial
    expect(mat.transparent).toBe(true)
    expect(mat.color.getHexString()).toBe('4060e0')

    const shadowAnchor = shadow.parent!
    expect(shadowAnchor.instance.position.x).toBeCloseTo(1.2, 5)
    expect(shadowAnchor.instance.position.z).toBeCloseTo(-0.6, 5)
    expect(shadowAnchor.instance.position.y).toBeLessThan(0.05)
  })
})

describe('Figure — seleção de junta', () => {
  it('chama onSelectJoint com o nome da junta ao clicar no seu corpo', async () => {
    const clicks: string[] = []
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} onSelectJoint={(name) => clicks.push(name)} />,
    )

    const elbow = renderer.scene.findByProps({ name: 'segment-elbow.L' })
    await renderer.fireEvent(elbow, 'click')

    expect(clicks).toEqual(['elbow.L'])
  })

  it('destaca (emissivo) só a junta selecionada — inclusive blocos do tronco', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} selectedJointName="chest" />,
    )

    const chestMaterial = renderer.scene
      .findByProps({ name: 'segment-chest' })
      .allChildren.find((child) => child.type === 'MeshStandardMaterial')
      ?.instance as unknown as THREE.MeshStandardMaterial
    const wristMaterial = renderer.scene
      .findByProps({ name: 'segment-wrist.L' })
      .allChildren.find((child) => child.type === 'MeshStandardMaterial')
      ?.instance as unknown as THREE.MeshStandardMaterial

    expect(chestMaterial.emissive.getHex()).toBeGreaterThan(0)
    expect(wristMaterial.emissive.getHex()).toBe(0)
  })
})

describe('Figure — boneco oculto é inerte ao mouse (fase 9, item 14)', () => {
  /**
   * O `Raycaster` do three ignora `visible=false`, e o R3F só testa objetos
   * que tenham handler de ponteiro registrado (`__r3f.eventCount > 0`). Um
   * boneco oculto com handler continuava "roubando" o clique de quem estava
   * atrás dele (chamava `stopPropagation`). Regressão travada aqui.
   */
  function eventCountOf(node: { instance: unknown }): number {
    return (node.instance as { __r3f?: { eventCount?: number } }).__r3f?.eventCount ?? 0
  }

  it('registra o clique nas peças de um boneco visível', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} onSelectJoint={() => {}} />,
    )
    const chest = renderer.scene.findByProps({ name: 'segment-chest' })
    expect(chest.props.onClick).toBeTypeOf('function')
    expect(eventCountOf(chest)).toBeGreaterThan(0)
  })

  it('não registra clique em nenhuma peça quando o boneco está oculto', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ visible: false })} onSelectJoint={() => {}} />,
    )

    const meshes = renderer.scene.findAllByType('Mesh')
    expect(meshes.length).toBeGreaterThan(0)
    for (const mesh of meshes) {
      expect(mesh.props.onClick).toBeUndefined()
      expect(eventCountOf(mesh)).toBe(0)
    }
  })
})

describe('Figure — registro de refs de junta', () => {
  it('reporta o grupo vivo de cada junta e o grupo externo do boneco para "root"', async () => {
    const registered = new Map<string, unknown>()
    const renderer = await ReactThreeTestRenderer.create(
      <Figure
        figure={makeFigure()}
        onJointRef={(name, object) => {
          if (object) registered.set(name, object)
        }}
      />,
    )

    const elbowGroup = renderer.scene.findByProps({ name: 'joint-elbow.L' })
    expect(registered.get('elbow.L')).toBe(elbowGroup.instance)

    const figureGroup = renderer.scene.findByProps({ name: 'figure-f1' })
    const innerRootGroup = renderer.scene.findByProps({ name: 'joint-root' })
    expect(registered.get('root')).toBe(figureGroup.instance)
    expect(registered.get('root')).not.toBe(innerRootGroup.instance)
  })

  it('registra o pivô interno da raiz sob uma chave própria, para o gizmo de rotação (fase 9, item 13)', async () => {
    const registered = new Map<string, unknown>()
    const renderer = await ReactThreeTestRenderer.create(
      <Figure
        figure={makeFigure()}
        onJointRef={(name, object) => {
          if (object) registered.set(name, object)
        }}
      />,
    )

    // O gizmo de rotação precisa do grupo que carrega `figure.rotation` 1:1
    // (o interno); o de translação, do externo. Trocar os dois foi o bug de
    // DECISOES.md #7 — por isso as duas chaves são distintas.
    const innerRootGroup = renderer.scene.findByProps({ name: 'joint-root' })
    expect(registered.get(ROOT_PIVOT_REF_NAME)).toBe(innerRootGroup.instance)
    expect(registered.get(ROOT_PIVOT_REF_NAME)).not.toBe(registered.get('root'))
  })
})

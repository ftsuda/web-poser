import { useMemo } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { Figure as FigureData } from '../store/figuresStore'
import {
  ROOT_JOINT_NAME,
  getHeightScale,
  getJoint,
  getJointChildren,
  type JointRotation,
} from './skeleton'

export interface FigureProps {
  figure: FigureData
  /** Nome da junta selecionada (ganha destaque emissivo). */
  selectedJointName?: string | null
  /** Chamado com o nome da junta quando o usuário clica no seu corpo/pivô. */
  onSelectJoint?: (jointName: string) => void
  /** Registra/desregistra (null) o `Group` ao vivo de cada junta — usado para anexar o gizmo (fase 3). */
  onJointRef?: (jointName: string, object: THREE.Group | null) => void
}

/** Cor emissiva usada para destacar a junta selecionada (fase 3: seleção de junta). */
const SELECTED_EMISSIVE = '#ffe066'
const SELECTED_EMISSIVE_INTENSITY = 0.6

const ZERO_ROTATION: JointRotation = { x: 0, y: 0, z: 0 }

/**
 * Escala (rx,ry,rz) aplicada a uma esfera unitária para o "corpo" de cada
 * junta simples (pivô), em metros (altura de referência). Não-uniforme =
 * elipsoide. Pelve/tórax têm tratamento próprio via `blobProfile` (perfil
 * torneado) — ver `TORSO_BLOCKS` abaixo.
 */
const JOINT_BODY_SCALE: Record<string, readonly [number, number, number]> = {
  head: [0.095, 0.115, 0.1],
  upperChest: [0.03, 0.022, 0.03],
  'shoulder.L': [0.045, 0.045, 0.045],
  'shoulder.R': [0.045, 0.045, 0.045],
  'hip.L': [0.05, 0.05, 0.05],
  'hip.R': [0.05, 0.05, 0.05],
  'thumb1.L': [0.015, 0.015, 0.015],
  'thumb1.R': [0.015, 0.015, 0.015],
  'thumb2.L': [0.012, 0.012, 0.012],
  'thumb2.R': [0.012, 0.012, 0.012],
  'fingersBase.L': [0.017, 0.017, 0.017],
  'fingersBase.R': [0.017, 0.017, 0.017],
  'fingersMid.L': [0.014, 0.014, 0.014],
  'fingersMid.R': [0.014, 0.014, 0.014],
  'fingersTip.L': [0.011, 0.011, 0.011],
  'fingersTip.R': [0.011, 0.011, 0.011],
}
const DEFAULT_JOINT_RADIUS = 0.035
const DEFAULT_JOINT_SCALE: readonly [number, number, number] = [
  DEFAULT_JOINT_RADIUS,
  DEFAULT_JOINT_RADIUS,
  DEFAULT_JOINT_RADIUS,
]

function jointBodyScale(name: string): readonly [number, number, number] {
  return JOINT_BODY_SCALE[name] ?? DEFAULT_JOINT_SCALE
}

/**
 * A junta neck→head fica na base do crânio, não no seu centro de massa: o
 * pivô real (nuca) fica para trás e para baixo em relação ao centro da
 * cabeça. Em vez de centralizar a esfera da cabeça na própria junta, ela é
 * deslocada um pouco para frente (+Z, convenção já usada por
 * `ball.*`/polegar no `skeleton.ts`) e para baixo (-Y), deixando o pivô
 * visivelmente dentro do volume da cabeça, não na "ponta" do elipsoide.
 */
const HEAD_FORWARD_OFFSET = 0.025
const HEAD_DOWN_OFFSET = 0.03
/** Centro renderizado da esfera da cabeça (mesmo offset usado no `position` do mesh, abaixo). */
const HEAD_CENTER: readonly [number, number, number] = [0, -HEAD_DOWN_OFFSET, HEAD_FORWARD_OFFSET]

/**
 * Marcas faciais simples (geometria, sem textura de imagem — pedido do
 * usuário) para dar uma referência visual de qual lado da cabeça é a frente
 * (+Z, mesma convenção do resto do `skeleton.ts`). Mesma cor do boneco (o
 * relevo/sombreado das formas já basta para distinguir, como um manequim de
 * madeira entalhado, sem "pintar" o rosto).
 */
const NOSE_OFFSET: readonly [number, number, number] = [0, HEAD_CENTER[1] - 0.015, HEAD_CENTER[2] + 0.09]
const NOSE_SCALE: readonly [number, number, number] = [0.017, 0.022, 0.024]
const EYE_OFFSET_X = 0.045
const EYE_OFFSET: readonly [number, number, number] = [EYE_OFFSET_X, HEAD_CENTER[1] + 0.02, HEAD_CENTER[2] + 0.075]
const EYE_SCALE: readonly [number, number, number] = [0.014, 0.011, 0.008]
const MOUTH_OFFSET: readonly [number, number, number] = [0, HEAD_CENTER[1] - 0.05, HEAD_CENTER[2] + 0.078]
const MOUTH_SCALE: readonly [number, number, number] = [0.03, 0.009, 0.008]
const EAR_OFFSET_X = 0.093
const EAR_OFFSET: readonly [number, number, number] = [EAR_OFFSET_X, HEAD_CENTER[1], HEAD_CENTER[2] - 0.015]
const EAR_SCALE: readonly [number, number, number] = [0.016, 0.032, 0.014]

/**
 * Anexos estáticos (sem junta própria) na ponta de `fingersTip.*`/`thumb2.*`
 * — representam a falange distal além da última junta real (DIP/IP), que
 * senão ficaria sem nenhuma geometria depois do próprio pivô. Herdam a
 * rotação da junta por serem filhos do mesmo grupo.
 */
const TIP_CAPS: Record<
  string,
  { offset: readonly [number, number, number]; scale: readonly [number, number, number]; shape: 'box' | 'cylinder' }
> = {
  'fingersTip.L': { offset: [0, -0.013, 0.001], scale: [0.032, 0.026, 0.018], shape: 'box' },
  'fingersTip.R': { offset: [0, -0.013, 0.001], scale: [0.032, 0.026, 0.018], shape: 'box' },
  'thumb2.L': { offset: [0, -0.014, 0.004], scale: [0.011, 0.018, 0.011], shape: 'cylinder' },
  'thumb2.R': { offset: [0, -0.014, 0.004], scale: [0.011, 0.018, 0.011], shape: 'cylinder' },
}

/**
 * Segmentos de tronco/pelve renderizados como um volume torneado (perfil
 * revolucionado em torno de Y), em vez de uma esfera — dá um contorno
 * arredondado e mais "maciço", como os blocos de um manequim de madeira.
 * `depthRatio` achata a profundidade (Z) em relação à largura (X).
 *
 * Alturas recalibradas junto com os offsets do `skeleton.ts` (proporções
 * antropométricas, ver DECISOES.md #15/#16): sem isso, o osso fino que liga
 * um bloco ao próximo (`limbProfile`, via `Bone`) fica exposto por um trecho
 * longo demais ("palito" entre os blobs) — `root`/`spine` crescem o
 * suficiente para se sobrepor levemente. `chest` tem tratamento próprio
 * (`CHEST_SHAPE`, abaixo), não entra nesse dicionário.
 */
const TORSO_BLOCKS: Record<string, { height: number; maxRadius: number; depthRatio: number }> = {
  root: { height: 0.18, maxRadius: 0.11, depthRatio: 0.72 },
  spine: { height: 0.28, maxRadius: 0.09, depthRatio: 0.75 },
}

/**
 * Config dos ossos conectores de tronco que precisam de raio (e, para o
 * cilindro chest↔spine, achatamento) maiores que o cálculo automático de
 * `Bone` (pensado para membros finos) — por nome da junta-filha. Sem isso, o
 * vão entre dois blocos de tronco fica só com o osso fino padrão, "palito"
 * entre os blocos (ver DECISOES.md #17). `root`→`spine` (chave `spine`)
 * também alargado a pedido do usuário — mesmo padrão, largura insuficiente
 * vista de frente (DECISOES.md #20).
 */
const TORSO_CONNECTORS: Record<string, { radius: number; depthRatio?: number }> = {
  spine: { radius: 0.1 },
  chest: { radius: 0.085, depthRatio: 0.78 },
}

/**
 * Forma do `chest`: dois trapézios ligados pela base maior (modelo do
 * usuário, ver DECISOES.md #20) — mais largo em cima (linha dos ombros,
 * `upper.topRadius`), afunila num raio intermediário na própria origem da
 * junta (`upper.bottomRadius` = `lower.topRadius`, a "base maior" que une os
 * dois trapézios) e afunila mais um pouco até a base do `chest`
 * (`lower.bottomRadius`), de onde parte o cilindro achatado até o `spine`
 * (`TORSO_CONNECTORS.chest`). `upper.topExtent` preserva a margem de
 * segurança que mantém `upperChest`/`neck` visíveis (DECISOES.md #16/#17 —
 * crescer para cima re-esconderia o pescoço); `lower.bottomExtent` é quem
 * estende para baixo, em direção ao `spine` (DECISOES.md #18).
 */
const CHEST_SHAPE = {
  upper: { topExtent: 0.07, bottomExtent: 0, topRadius: 0.13, bottomRadius: 0.105 },
  lower: { topExtent: 0, bottomExtent: 0.15, topRadius: 0.105, bottomRadius: 0.085 },
  depthRatio: 0.78,
}

/** Gera um perfil torneado em forma de "barril" arredondado, centrado na origem da junta. */
function blobProfile(height: number, maxRadius: number, endRadiusRatio = 0.32): THREE.Vector2[] {
  const half = height / 2
  const endRadius = maxRadius * endRadiusRatio
  const steps = 6
  const points: THREE.Vector2[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const y = -half + t * height
    const bulge = Math.sin(Math.PI * t)
    const radius = endRadius + (maxRadius - endRadius) * bulge
    points.push(new THREE.Vector2(Math.max(radius, 0.001), y))
  }
  return points
}

/**
 * Gera um perfil torneado assimétrico (trapézio regular visto de frente) —
 * extensão e raio podem ser diferentes para cima e para baixo da origem da
 * junta, ao contrário de `blobProfile` (sempre simétrico). Usado só pelo
 * `chest` (ver `CHEST_SHAPE`).
 *
 * `LatheGeometry` não fecha as pontas sozinha (fica oco, como um vaso sem
 * fundo/tampa) — `closeTop`/`closeBottom` adicionam um ponto extra de raio
 * ~0 na mesma altura da ponta, fechando aquele lado com uma "tampa" plana em
 * vez de deixá-lo aberto (bug relatado pelo usuário: topo do `chest` ficava
 * visivelmente oco).
 */
function trapezoidProfile(
  topExtent: number,
  bottomExtent: number,
  topRadius: number,
  bottomRadius: number,
  options: { closeTop?: boolean; closeBottom?: boolean } = {},
): THREE.Vector2[] {
  const height = topExtent + bottomExtent
  const steps = 6
  const points: THREE.Vector2[] = []
  if (options.closeBottom) points.push(new THREE.Vector2(0.0005, -bottomExtent))
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const y = -bottomExtent + t * height
    const radius = bottomRadius + (topRadius - bottomRadius) * t
    points.push(new THREE.Vector2(Math.max(radius, 0.001), y))
  }
  if (options.closeTop) points.push(new THREE.Vector2(0.0005, topExtent))
  return points
}

/**
 * Gera um perfil torneado afunilado com leve "barriga" muscular, de uma
 * junta até sua filha. Centrado em Y (-length/2..length/2), como o
 * `CylinderGeometry`/`BoxGeometry` que substitui — a malha é posicionada no
 * ponto médio do segmento (`midpoint`), então o perfil precisa ser
 * simétrico em torno da própria origem, não começar em y=0.
 */
function limbProfile(length: number, rProximal: number, rDistal: number): THREE.Vector2[] {
  const half = length / 2
  const steps = 6
  const maxR = Math.max(rProximal, rDistal)
  const points: THREE.Vector2[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const y = -half + t * length
    const base = rProximal + (rDistal - rProximal) * t
    const bulge = Math.sin(Math.PI * t) * maxR * 0.22
    points.push(new THREE.Vector2(Math.max(base + bulge, 0.002), y))
  }
  return points
}

/** Juntas cujo osso até elas deve ser uma "pá" achatada — mão/pé (`ball.*`) e o bloco dos 4 dedos (`fingers*.*`, pedido do usuário: paralelepípedo). */
const PADDLE_JOINTS = new Set([
  'ball.L',
  'ball.R',
  'fingersBase.L',
  'fingersBase.R',
  'fingersMid.L',
  'fingersMid.R',
  'fingersTip.L',
  'fingersTip.R',
])
/** Juntas cujo osso até elas deve ser um cilindro liso (polegar e o conector chest↔spine, pedido do usuário), em vez do perfil torneado orgânico. */
const CYLINDER_JOINTS = new Set(['thumb1.L', 'thumb1.R', 'thumb2.L', 'thumb2.R', 'chest'])

type BoneShape = 'taper' | 'paddle' | 'cylinder'

function boneShapeFor(childJointName: string): BoneShape {
  if (PADDLE_JOINTS.has(childJointName)) return 'paddle'
  if (CYLINDER_JOINTS.has(childJointName)) return 'cylinder'
  return 'taper'
}

function degToRadTriple(rotation: JointRotation): [number, number, number] {
  return [
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z),
  ]
}

interface BoneProps {
  to: readonly [number, number, number]
  color: string
  shape: BoneShape
  /** Sobrepõe o raio calculado automaticamente — ver `TORSO_CONNECTORS`. */
  radiusOverride?: number
  /**
   * Achata o osso no eixo Z do próprio segmento (1 = sem achatamento) — só
   * correto para ossos verticais sem componente X/Z no offset (torso), onde
   * o quaternion do osso fica na identidade e Z local = Z do mundo. Usado
   * pelo cilindro achatado `chest`→`spine` (`TORSO_CONNECTORS`).
   */
  depthRatio?: number
}

/** Osso ligando a origem da junta (0,0,0) ao offset local de uma junta filha. */
function Bone({ to, color, shape, radiusOverride, depthRatio = 1 }: BoneProps) {
  const { length, quaternion, midpoint, radius, profile } = useMemo(() => {
    const target = new THREE.Vector3(...to)
    const boneLength = target.length()
    const direction = target.clone().normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    const boneRadius = radiusOverride ?? Math.max(0.012, Math.min(0.035, boneLength * 0.12))
    return {
      length: boneLength,
      quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number],
      midpoint: target.multiplyScalar(0.5).toArray() as [number, number, number],
      radius: boneRadius,
      profile: limbProfile(boneLength, boneRadius * 1.2, boneRadius * 0.75),
    }
  }, [to, radiusOverride])

  if (length < 0.001) return null

  return (
    <mesh position={midpoint} quaternion={quaternion} scale={[1, 1, depthRatio]}>
      {shape === 'paddle' && <boxGeometry args={[radius * 2.6, length, radius * 1.6]} />}
      {shape === 'cylinder' && <cylinderGeometry args={[radius * 0.85, radius * 0.85, length, 10]} />}
      {shape === 'taper' && <latheGeometry args={[profile, 10]} />}
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

interface JointBodyMeshProps {
  name: string
  color: string
  selected: boolean
  onSelect?: () => void
}

function createSelectHandler(onSelect?: () => void) {
  if (!onSelect) return undefined
  return (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect()
  }
}

function JointBodyMesh({ name, color, selected, onSelect }: JointBodyMeshProps) {
  const torsoBlock = TORSO_BLOCKS[name]
  const handleClick = createSelectHandler(onSelect)
  const emissive = selected ? SELECTED_EMISSIVE : '#000000'
  const emissiveIntensity = selected ? SELECTED_EMISSIVE_INTENSITY : 0

  const torsoProfile = useMemo(
    () => (torsoBlock ? blobProfile(torsoBlock.height, torsoBlock.maxRadius) : null),
    [torsoBlock],
  )
  const chestProfiles = useMemo(() => {
    if (name !== 'chest') return null
    return {
      upper: trapezoidProfile(
        CHEST_SHAPE.upper.topExtent,
        CHEST_SHAPE.upper.bottomExtent,
        CHEST_SHAPE.upper.topRadius,
        CHEST_SHAPE.upper.bottomRadius,
        { closeTop: true },
      ),
      lower: trapezoidProfile(
        CHEST_SHAPE.lower.topExtent,
        CHEST_SHAPE.lower.bottomExtent,
        CHEST_SHAPE.lower.topRadius,
        CHEST_SHAPE.lower.bottomRadius,
      ),
    }
  }, [name])

  if (chestProfiles) {
    return (
      <>
        <mesh name="segment-chest" scale={[1, 1, CHEST_SHAPE.depthRatio]} onClick={handleClick}>
          <latheGeometry args={[chestProfiles.upper, 14]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
        </mesh>
        <mesh name="segment-chest-lower" scale={[1, 1, CHEST_SHAPE.depthRatio]} onClick={handleClick}>
          <latheGeometry args={[chestProfiles.lower, 14]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
        </mesh>
      </>
    )
  }

  if (torsoBlock && torsoProfile) {
    return (
      <mesh
        name={`segment-${name}`}
        scale={[1, 1, torsoBlock.depthRatio]}
        onClick={handleClick}
      >
        <latheGeometry args={[torsoProfile, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
    )
  }

  const position: readonly [number, number, number] =
    name === 'head' ? [0, -HEAD_DOWN_OFFSET, HEAD_FORWARD_OFFSET] : [0, 0, 0]

  const tipCap = TIP_CAPS[name]

  return (
    <>
      <mesh
        name={`segment-${name}`}
        position={position}
        scale={jointBodyScale(name)}
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 14, 12]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {name === 'head' && <FaceFeatures color={color} />}
      {tipCap && (
        <mesh position={tipCap.offset} scale={tipCap.scale} onClick={handleClick}>
          {tipCap.shape === 'cylinder' ? (
            <cylinderGeometry args={[1, 1, 1, 10]} />
          ) : (
            <boxGeometry args={[1, 1, 1]} />
          )}
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
        </mesh>
      )}
    </>
  )
}

/** Cor fixa dos olhos — sempre preta, independente da cor do boneco (pedido do usuário), diferente do nariz/boca/orelhas (mesma cor do corpo). */
const EYE_COLOR = '#0a0a0a'

/** Nariz, olhos, boca e orelhas — geometria simples (sem textura), só para marcar a frente do rosto. Olhos em preto fixo; o resto na cor do boneco. */
function FaceFeatures({ color }: { color: string }) {
  return (
    <>
      <mesh position={NOSE_OFFSET} scale={NOSE_SCALE}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[EYE_OFFSET[0], EYE_OFFSET[1], EYE_OFFSET[2]]} scale={EYE_SCALE}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={EYE_COLOR} />
      </mesh>
      <mesh position={[-EYE_OFFSET[0], EYE_OFFSET[1], EYE_OFFSET[2]]} scale={EYE_SCALE}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={EYE_COLOR} />
      </mesh>
      <mesh position={MOUTH_OFFSET} scale={MOUTH_SCALE}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[EAR_OFFSET[0], EAR_OFFSET[1], EAR_OFFSET[2]]} scale={EAR_SCALE}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-EAR_OFFSET[0], EAR_OFFSET[1], EAR_OFFSET[2]]} scale={EAR_SCALE}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </>
  )
}

interface JointNodeProps {
  name: string
  figure: FigureData
  selectedJointName?: string | null
  onSelectJoint?: (jointName: string) => void
  onJointRef?: (jointName: string, object: THREE.Group | null) => void
}

function JointNode({ name, figure, selectedJointName, onSelectJoint, onJointRef }: JointNodeProps) {
  const joint = getJoint(name)
  const isRoot = name === ROOT_JOINT_NAME
  const rotation = isRoot ? figure.rotation : (figure.pose[name] ?? ZERO_ROTATION)
  const children = getJointChildren(name)

  // A junta root tem um offset local fixo do skeleton.ts (altura do quadril,
  // não a colocação do boneco) — não registrar esse grupo interno como o
  // alvo de "root" para o gizmo de translação, ou a posição gravada no
  // store fica com esse offset embutido (boneco "voa" ao mover, sombra se
  // solta do corpo). O grupo externo (`Figure`, abaixo) se registra em vez
  // deste, já que ele é quem carrega `figure.position` de fato.
  return (
    <group
      name={`joint-${name}`}
      position={joint.position}
      rotation={degToRadTriple(rotation)}
      ref={onJointRef && !isRoot ? (object) => onJointRef(name, object) : undefined}
    >
      <JointBodyMesh
        name={name}
        color={figure.color}
        selected={name === selectedJointName}
        onSelect={onSelectJoint ? () => onSelectJoint(name) : undefined}
      />
      {children.map((child) => (
        <Bone
          key={child.name}
          to={child.position}
          color={figure.color}
          shape={boneShapeFor(child.name)}
          radiusOverride={TORSO_CONNECTORS[child.name]?.radius}
          depthRatio={TORSO_CONNECTORS[child.name]?.depthRatio}
        />
      ))}
      {children.map((child) => (
        <JointNode
          key={child.name}
          name={child.name}
          figure={figure}
          selectedJointName={selectedJointName}
          onSelectJoint={onSelectJoint}
          onJointRef={onJointRef}
        />
      ))}
    </group>
  )
}

/** Raio (m) e achatamento em Z da elipse de sombra no chão, na altura de referência. */
const SHADOW_RADIUS_X = 0.28
const SHADOW_RADIUS_Z = 0.2
/** Pequeno afastamento do chão para evitar z-fighting com o plano/grade da cena. */
const SHADOW_GROUND_OFFSET = 0.002

interface FigureShadowProps {
  figureId: string
  color: string
}

/**
 * Elipse translúcida no chão sob o boneco — equivalente virtual à base de
 * madeira do manequim de referência, útil para localizar o ponto de
 * colocação do boneco no plano do chão. A malha em si fica na origem do seu
 * grupo pai (ver `Figure` abaixo), que é quem posiciona a sombra no mundo —
 * só em X/Z, sempre perto de Y=0, independente da altura (Y) em que o
 * boneco estiver posicionado.
 */
function FigureShadow({ figureId, color }: FigureShadowProps) {
  return (
    <mesh
      name={`figure-shadow-${figureId}`}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[SHADOW_RADIUS_X, SHADOW_RADIUS_Z, 1]}
    >
      <circleGeometry args={[1, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
    </mesh>
  )
}

export function Figure({ figure, selectedJointName, onSelectJoint, onJointRef }: FigureProps) {
  const scale = getHeightScale(figure.height)
  const [x, , z] = figure.position

  return (
    <>
      <group
        name={`figure-${figure.id}`}
        position={figure.position}
        scale={scale}
        visible={figure.visible}
        ref={onJointRef ? (object) => onJointRef(ROOT_JOINT_NAME, object) : undefined}
      >
        <JointNode
          name={ROOT_JOINT_NAME}
          figure={figure}
          selectedJointName={selectedJointName}
          onSelectJoint={onSelectJoint}
          onJointRef={onJointRef}
        />
      </group>

      {/*
        Grupo separado do boneco: acompanha X/Z, mas fica sempre perto do
        chão (Y quase 0), dando noção de altura quando o boneco é
        posicionado no ar (ver PLANO.md > "Interação de pose").
      */}
      <group position={[x, SHADOW_GROUND_OFFSET, z]} scale={scale} visible={figure.visible}>
        <FigureShadow figureId={figure.id} color={figure.color} />
      </group>
    </>
  )
}

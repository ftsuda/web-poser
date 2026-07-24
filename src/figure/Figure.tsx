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
  'shoulder.L': [0.045, 0.045, 0.045],
  'shoulder.R': [0.045, 0.045, 0.045],
  'hip.L': [0.05, 0.05, 0.05],
  'hip.R': [0.05, 0.05, 0.05],
  'thumb1.L': [0.015, 0.015, 0.015],
  'thumb1.R': [0.015, 0.015, 0.015],
  'thumb2.L': [0.012, 0.012, 0.012],
  'thumb2.R': [0.012, 0.012, 0.012],
  'fingers.L': [0.02, 0.02, 0.02],
  'fingers.R': [0.02, 0.02, 0.02],
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

/**
 * Segmentos de tronco/pelve renderizados como um volume torneado (perfil
 * revolucionado em torno de Y), em vez de uma esfera — dá um contorno
 * arredondado e mais "maciço", como os blocos de um manequim de madeira.
 * `depthRatio` achata a profundidade (Z) em relação à largura (X).
 */
const TORSO_BLOCKS: Record<string, { height: number; maxRadius: number; depthRatio: number }> = {
  root: { height: 0.16, maxRadius: 0.11, depthRatio: 0.72 },
  spine: { height: 0.13, maxRadius: 0.085, depthRatio: 0.75 },
  chest: { height: 0.24, maxRadius: 0.115, depthRatio: 0.78 },
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

/** Juntas cujo osso até elas deve ser uma "pá" achatada (mão/pé), não um perfil torneado. */
const PADDLE_JOINTS = new Set(['fingers.L', 'fingers.R', 'ball.L', 'ball.R'])

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
  paddle: boolean
}

/** Osso ligando a origem da junta (0,0,0) ao offset local de uma junta filha. */
function Bone({ to, color, paddle }: BoneProps) {
  const { length, quaternion, midpoint, radius, profile } = useMemo(() => {
    const target = new THREE.Vector3(...to)
    const boneLength = target.length()
    const direction = target.clone().normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    const boneRadius = Math.max(0.012, Math.min(0.035, boneLength * 0.12))
    return {
      length: boneLength,
      quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number],
      midpoint: target.multiplyScalar(0.5).toArray() as [number, number, number],
      radius: boneRadius,
      profile: limbProfile(boneLength, boneRadius * 1.2, boneRadius * 0.75),
    }
  }, [to])

  if (length < 0.001) return null

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      {paddle ? (
        <boxGeometry args={[radius * 2.6, length, radius * 1.6]} />
      ) : (
        <latheGeometry args={[profile, 10]} />
      )}
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

  return (
    <mesh
      name={`segment-${name}`}
      position={position}
      scale={jointBodyScale(name)}
      onClick={handleClick}
    >
      <sphereGeometry args={[1, 14, 12]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
    </mesh>
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
          paddle={PADDLE_JOINTS.has(child.name)}
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

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
import {
  getBoneStyle,
  getJointParts,
  type BoneStyle,
  type SegmentPart,
  type Vec3,
} from './skeleton2'

/**
 * Renderer do manequim de madeira: mesma interface de `Figure` (props,
 * nomes de mesh `joint-*`/`segment-*`, seleção, refs de junta, sombra),
 * porém toda a geometria vem da camada de dados do `skeleton2.ts`
 * (`JOINT_PARTS`/`BONE_STYLES`) em vez de formas hardcoded — é o visual do
 * manequim articulado da foto de referência. A cinemática (juntas, offsets,
 * hierarquia) vem direto do `skeleton.ts` original — o `skeleton2.ts` só
 * fornece a camada visual. Troca drop-in no `Viewport`:
 * `import { Figure2 as Figure } from '../figure/Figure2'`.
 */
export interface Figure2Props {
  figure: FigureData
  /** Nome da junta selecionada (ganha destaque emissivo). */
  selectedJointName?: string | null
  /** Chamado com o nome da junta quando o usuário clica no seu corpo/pivô. */
  onSelectJoint?: (jointName: string) => void
  /** Registra/desregistra (null) o `Group` ao vivo de cada junta — usado para anexar o gizmo. */
  onJointRef?: (jointName: string, object: THREE.Group | null) => void
}

/**
 * Chave sob a qual o grupo INTERNO da raiz (`joint-root`) é registrado em
 * `onJointRef`, para o gizmo de rotação da colocação (fase 9, item 13). A
 * chave `root` continua reservada ao grupo externo (`figure-<id>`), que é
 * quem carrega `figure.position` — trocar os dois de lugar foi exatamente o
 * bug corrigido em DECISOES.md #7. O grupo interno é o que tem
 * `rotation = figure.rotation` de forma declarativa (1:1, sem offset somado),
 * então é o alvo certo do gizmo de rotação.
 */
export const ROOT_PIVOT_REF_NAME = 'root:pivot'

/** Cor emissiva usada para destacar a junta selecionada (mesma de `Figure`). */
const SELECTED_EMISSIVE = '#ffe066'
const SELECTED_EMISSIVE_INTENSITY = 0.6

/** Cor fixa dos olhos — sempre preta, independente da cor do boneco (mesma regra de `Figure`). */
const EYE_COLOR = '#0a0a0a'

/** Cor fixa do pino que marca as costas da mão — sempre latão, independente da cor do boneco. */
const MARKER_COLOR = '#b08d3e'

const ZERO_ROTATION: JointRotation = { x: 0, y: 0, z: 0 }

/** Raio das "tampas" que fecham as extremidades dos ossos torneados (mesmo truque do `skeleton2.ts`). */
const CAP = 0.0005

/** Segmentos radiais: peças de junta (blocos/ovo) mais lisas que os ossos. */
const PART_LATHE_SEGMENTS = 16
const BONE_LATHE_SEGMENTS = 12

function degToRadTriple(rotation: JointRotation): [number, number, number] {
  return [
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z),
  ]
}

function degTripleFromVec(rotation: Vec3): [number, number, number] {
  return [
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2]),
  ]
}

function createSelectHandler(onSelect?: () => void) {
  if (!onSelect) return undefined
  return (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect()
  }
}

/**
 * Prisma trapezoidal para os ossos `blade` da mão: largura em X afunilando
 * de `widthStart` (junta pai, y=-len/2) para `widthEnd` (junta filha,
 * y=+len/2), espessura constante em Z. Centrado na origem, como as demais
 * geometrias de osso (a malha é posicionada no ponto médio do segmento).
 * Não-indexado de propósito: vértices duplicados dão as normais chapadas de
 * uma peça de madeira facetada.
 */
function createBladeGeometry(
  widthStart: number,
  widthEnd: number,
  thickness: number,
  length: number,
): THREE.BufferGeometry {
  const h = length / 2
  const t = thickness / 2
  const w0 = widthStart / 2
  const w1 = widthEnd / 2
  const corners: readonly (readonly number[])[] = [
    [-w0, -h, -t],
    [w0, -h, -t],
    [w0, -h, t],
    [-w0, -h, t],
    [-w1, h, -t],
    [w1, h, -t],
    [w1, h, t],
    [-w1, h, t],
  ]
  // Quads com enrolamento CCW visto de fora (normais para fora).
  const quads = [
    [0, 1, 2, 3], // fundo (y-)
    [7, 6, 5, 4], // topo (y+)
    [1, 0, 4, 5], // trás (z-)
    [3, 2, 6, 7], // frente (z+)
    [2, 1, 5, 6], // lateral x+
    [0, 3, 7, 4], // lateral x-
  ]
  const positions: number[] = []
  for (const [a, b, c, d] of quads) {
    positions.push(...corners[a], ...corners[b], ...corners[c])
    positions.push(...corners[a], ...corners[c], ...corners[d])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

interface PartMeshProps {
  part: SegmentPart
  /** Nome do mesh — só a peça principal (índice 0) da junta recebe `segment-<junta>`. */
  name?: string
  color: string
  selected: boolean
  onClick?: (event: ThreeEvent<MouseEvent>) => void
}

/** Uma peça visual de junta (`SegmentPart` do `skeleton2.ts`), no espaço local da junta. */
function PartMesh({ part, name, color, selected, onClick }: PartMeshProps) {
  const isEye = part.tint === 'eye'
  const isMarker = part.tint === 'marker'
  const fixedColor = isEye ? EYE_COLOR : isMarker ? MARKER_COLOR : null

  const latheProfile = useMemo(() => {
    if (part.kind !== 'lathe') return null
    return part.profile.map((point) => new THREE.Vector2(point.radius, point.y))
  }, [part])

  const scale: readonly [number, number, number] | undefined =
    part.kind === 'lathe'
      ? [1, 1, part.depthRatio ?? 1]
      : part.kind === 'ellipsoid'
        ? part.radii
        : undefined

  return (
    <mesh
      name={name}
      position={part.offset}
      rotation={part.rotation ? degTripleFromVec(part.rotation) : undefined}
      scale={scale}
      onClick={isEye ? undefined : onClick}
    >
      {part.kind === 'lathe' && latheProfile && (
        <latheGeometry args={[latheProfile, PART_LATHE_SEGMENTS]} />
      )}
      {part.kind === 'ellipsoid' && <sphereGeometry args={[1, PART_LATHE_SEGMENTS, 12]} />}
      {part.kind === 'box' && <boxGeometry args={[part.size[0], part.size[1], part.size[2]]} />}
      <meshStandardMaterial
        color={fixedColor ?? color}
        emissive={selected && !isEye ? SELECTED_EMISSIVE : '#000000'}
        emissiveIntensity={selected && !isEye ? SELECTED_EMISSIVE_INTENSITY : 0}
      />
    </mesh>
  )
}

interface Bone2Props {
  to: readonly [number, number, number]
  style: Exclude<BoneStyle, { kind: 'hidden' }>
  color: string
}

/** Osso ligando a origem da junta (0,0,0) ao offset local da junta filha, com o perfil do `skeleton2.ts`. */
function Bone2({ to, style, color }: Bone2Props) {
  const { length, quaternion, midpoint, profile, bladeGeometry } = useMemo(() => {
    const target = new THREE.Vector3(...to)
    const boneLength = target.length()
    const direction = target.clone().normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    const half = boneLength / 2

    let turnedProfile: THREE.Vector2[] | null = null
    let blade: THREE.BufferGeometry | null = null
    if (style.kind === 'turned') {
      // Perfil centrado em Y (t=0 → -metade, t=1 → +metade) com tampas nas
      // pontas, para o rim não ficar oco quando o osso é mais largo que a
      // bola de junta vizinha (ex.: topo da coxa vs. bola do quadril).
      turnedProfile = [
        new THREE.Vector2(CAP, -half),
        ...style.points.map(
          (point) => new THREE.Vector2(point.radius, point.t * boneLength - half),
        ),
        new THREE.Vector2(CAP, half),
      ]
    } else {
      blade = createBladeGeometry(style.widthStart, style.widthEnd, style.thickness, boneLength)
    }

    return {
      length: boneLength,
      quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number],
      midpoint: target.multiplyScalar(0.5).toArray() as [number, number, number],
      profile: turnedProfile,
      bladeGeometry: blade,
    }
  }, [to, style])

  if (length < 0.001) return null

  const depthRatio = style.kind === 'turned' ? (style.depthRatio ?? 1) : 1

  return (
    <mesh
      position={midpoint}
      quaternion={quaternion}
      scale={[1, 1, depthRatio]}
      geometry={bladeGeometry ?? undefined}
    >
      {profile && <latheGeometry args={[profile, BONE_LATHE_SEGMENTS]} />}
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

interface JointBody2Props {
  name: string
  color: string
  selected: boolean
  onSelect?: () => void
}

/** Todas as peças da junta. O destaque emissivo cobre a peça inteira (ovo+nariz/orelhas na cabeça); os olhos ficam sempre pretos e sem destaque. */
function JointBody2({ name, color, selected, onSelect }: JointBody2Props) {
  const parts = getJointParts(name)
  const handleClick = createSelectHandler(onSelect)

  return (
    <>
      {parts.map((part, index) => (
        <PartMesh
          key={index}
          part={part}
          name={index === 0 ? `segment-${name}` : undefined}
          color={color}
          selected={selected}
          onClick={handleClick}
        />
      ))}
    </>
  )
}

interface JointNode2Props {
  name: string
  figure: FigureData
  selectedJointName?: string | null
  onSelectJoint?: (jointName: string) => void
  onJointRef?: (jointName: string, object: THREE.Group | null) => void
}

function JointNode2({ name, figure, selectedJointName, onSelectJoint, onJointRef }: JointNode2Props) {
  const joint = getJoint(name)
  const isRoot = name === ROOT_JOINT_NAME
  const rotation = isRoot ? figure.rotation : (figure.pose[name] ?? ZERO_ROTATION)
  const children = getJointChildren(name)

  // Boneco oculto fica inerte ao mouse: `visible=false` só apaga o desenho —
  // o `Raycaster` do three continua enxergando a malha, e o R3F testa todo
  // objeto que tenha handler de ponteiro registrado. Sem isto, o boneco
  // invisível em primeiro plano "rouba" o clique de quem está atrás dele (o
  // handler chama `stopPropagation`). Não registrar o handler tira a peça da
  // lista de objetos interativos do R3F — clique e hover passam direto (ver
  // PLANO.md > fase 9, item 14).
  const interactive = figure.visible

  // Mesma ressalva de `Figure`: o grupo interno da root não é registrado
  // como alvo do gizmo — o grupo externo (`Figure2`, abaixo) é quem carrega
  // `figure.position` de fato.
  return (
    <group
      name={`joint-${name}`}
      position={joint.position}
      rotation={degToRadTriple(rotation)}
      ref={
        onJointRef
          ? (object) => onJointRef(isRoot ? ROOT_PIVOT_REF_NAME : name, object)
          : undefined
      }
    >
      <JointBody2
        name={name}
        color={figure.color}
        selected={name === selectedJointName}
        onSelect={onSelectJoint && interactive ? () => onSelectJoint(name) : undefined}
      />
      {children.map((child) => {
        const style = getBoneStyle(child.name)
        if (style.kind === 'hidden') return null
        return <Bone2 key={child.name} to={child.position} style={style} color={figure.color} />
      })}
      {children.map((child) => (
        <JointNode2
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

/** Sombra no chão — idêntica à de `Figure` (equivalente virtual à base de madeira do manequim). */
const SHADOW_RADIUS_X = 0.28
const SHADOW_RADIUS_Z = 0.2
const SHADOW_GROUND_OFFSET = 0.002

interface FigureShadowProps {
  figureId: string
  color: string
}

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

export function Figure2({ figure, selectedJointName, onSelectJoint, onJointRef }: Figure2Props) {
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
        <JointNode2
          name={ROOT_JOINT_NAME}
          figure={figure}
          selectedJointName={selectedJointName}
          onSelectJoint={onSelectJoint}
          onJointRef={onJointRef}
        />
      </group>

      {/* Grupo separado do boneco: acompanha X/Z, mas fica sempre no chão (mesma lógica de `Figure`). */}
      <group position={[x, SHADOW_GROUND_OFFSET, z]} scale={scale} visible={figure.visible}>
        <FigureShadow figureId={figure.id} color={figure.color} />
      </group>
    </>
  )
}

import { useCallback, useMemo } from 'react'
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
  DEFAULT_FIGURE_STYLE,
  getBoneStyle,
  getJointParts,
  type BoneStyle,
  type FigureStyle,
  type SegmentPart,
  type Vec3,
} from './skeleton'

/**
 * Renderer do manequim de madeira. Toda a geometria vem da camada de dados
 * do `skeleton.ts` (`JOINT_PARTS`/`BONE_STYLES`) em vez de formas
 * hardcoded — é o visual do manequim articulado da foto de referência.
 *
 * Este arquivo se chamou `Figure2.tsx` de 2026-07-24 a 2026-07-25, enquanto
 * conviveu com o renderizador anterior (formas geradas em código, sem a
 * camada de dados). Com a remoção daquele, o "2" perdeu o sentido e o nome
 * voltou ao original — ver DECISOES.md #32.
 */
/**
 * Boneco desenhado como FANTASMA (papel-cebola, item 31): translúcido, de uma
 * cor só e sem sombra. Não é um boneco da cena — é uma referência visual do
 * keyframe vizinho, então também não recebe clique nem gizmo.
 */
export interface GhostStyle {
  color: string
  opacity: number
}

export interface FigureProps {
  figure: FigureData
  /** Nome da junta selecionada (ganha destaque emissivo). */
  selectedJointName?: string | null
  /**
   * Juntas travadas a DESTACAR (tom avermelhado) — passado só enquanto o gizmo
   * de translação de junta está ativo neste boneco, para dizer de antemão o
   * que vai ficar rígido no arrasto (elo rígido, ver `dragSolver.ts`). Fora
   * desse modo vem vazio/ausente: o cadeado em si já é mostrado pelo painel.
   */
  lockedJointNames?: readonly string[] | null
  /**
   * Juntas ANCORADAS a destacar (tom azulado, item 62): âncora = posição
   * fixa no mundo. Diferente da trava, o destaque fica visível sempre que o
   * chamador passa a lista — a âncora congela ancestrais e colocação, e um
   * efeito desses não pode depender de gizmo ativo para se explicar.
   */
  pinnedJointNames?: readonly string[] | null
  /** Chamado com o nome da junta quando o usuário clica no seu corpo/pivô. */
  onSelectJoint?: (jointName: string) => void
  /** Registra/desregistra (null) o `Group` ao vivo de cada junta — usado para anexar o gizmo. */
  onJointRef?: (jointName: string, object: THREE.Group | null) => void
  /** Quando presente, o boneco vira fantasma: sem sombra, sem clique, sem gizmo. */
  ghost?: GhostStyle | null
  /**
   * Casca visual (`skeleton.ts`): manequim de madeira ou palito de juntas
   * grandes para toque. É só APARÊNCIA — o esqueleto, a pose e os limites são os
   * mesmos nas duas, então trocar de casca não mexe em nada da cena.
   */
  style?: FigureStyle
  /**
   * Modo SILHUETA (item 8): todas as peças em preto chapado (`MeshBasicMaterial`,
   * sem luz), inclusive olhos e pino da mão — a silhueta é a primeira checagem
   * de leitura que um ilustrador faz numa pose. É só material: clique, seleção
   * e gizmo continuam funcionando, mas os DESTAQUES emissivos somem (uma mancha
   * amarela dentro do preto chapado desfaria justamente a leitura chapada). O
   * fantasma do papel-cebola vence a silhueta — ele é referência translúcida.
   */
  silhouette?: boolean
  /**
   * Raio (m, no espaço local da junta) de uma esfera INVISÍVEL de toque por
   * junta — o alvo que o dedo acerta no módulo de poses (item 44). Invisível
   * não escapa do Raycaster (mesma razão do comentário em `JointNode`), então
   * ela recebe clique e pointerdown como qualquer malha. Ausente (o default,
   * e o desktop), nenhuma esfera é criada.
   */
  touchTargetRadius?: number
  /**
   * Início de arrasto numa junta (módulo de poses): dispara no `pointerdown`
   * do alvo de toque, antes do clique de seleção. Opcional e aditivo — sem
   * ele, nada muda no comportamento de hoje.
   */
  onJointPointerDown?: (jointName: string, event: ThreeEvent<PointerEvent>) => void
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

/** Cor emissiva usada para destacar a junta selecionada. */
const SELECTED_EMISSIVE = '#ffe066'
const SELECTED_EMISSIVE_INTENSITY = 0.6

/**
 * Cor emissiva das juntas TRAVADAS enquanto o gizmo de translação de junta
 * está ativo (ver `lockedJointNames`): vermelho = "isto não vai se mexer".
 * Um pouco mais fraca que a da seleção, que continua sendo o destaque
 * principal — e vence quando a junta selecionada também está travada.
 */
const LOCKED_EMISSIVE = '#ef4444'
const LOCKED_EMISSIVE_INTENSITY = 0.5

/**
 * Cor emissiva da junta ANCORADA (item 62): azul = "isto está fixo no
 * espaço". Mesma intensidade da trava; a seleção continua vencendo, e a
 * trava vence a âncora quando as duas valem para a mesma peça (o vermelho é
 * o aviso mais urgente: rígida no arrasto).
 */
const PINNED_EMISSIVE = '#3b82f6'
const PINNED_EMISSIVE_INTENSITY = 0.5

/** Cor fixa dos olhos — sempre preta, independente da cor do boneco. */
const EYE_COLOR = '#0a0a0a'

/** Preto da silhueta (item 8) — o mesmo quase-preto dos olhos, chapado. */
const SILHOUETTE_COLOR = '#0a0a0a'

/** Cor fixa do pino que marca as costas da mão — sempre latão, independente da cor do boneco. */
const MARKER_COLOR = '#b08d3e'

const ZERO_ROTATION: JointRotation = { x: 0, y: 0, z: 0 }

/** Raio das "tampas" que fecham as extremidades dos ossos torneados (mesmo truque da camada visual do `skeleton.ts`). */
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
  /** Junta travada com o gizmo de translação ativo — destaque avermelhado (a seleção vence). */
  locked?: boolean
  /** Junta ancorada (item 62) — destaque azulado (seleção e trava vencem). */
  pinned?: boolean
  ghost?: GhostStyle | null
  /** Modo silhueta (item 8) — preto chapado; o fantasma vence. */
  silhouette?: boolean
  onClick?: (event: ThreeEvent<MouseEvent>) => void
}

/** Uma peça visual de junta (`SegmentPart` do `skeleton.ts`), no espaço local da junta. */
function PartMesh({ part, name, color, selected, locked, pinned, ghost, silhouette, onClick }: PartMeshProps) {
  const isEye = part.tint === 'eye'
  const isMarker = part.tint === 'marker'
  const fixedColor = isEye ? EYE_COLOR : isMarker ? MARKER_COLOR : null

  // Mesmas exclusões do destaque de seleção: fantasma é silhueta de
  // referência e os olhos ficam sempre pretos. Seleção > trava > âncora
  // quando mais de um vale para a mesma peça.
  const highlight: 'selected' | 'locked' | 'pinned' | null =
    isEye || ghost ? null : selected ? 'selected' : locked ? 'locked' : pinned ? 'pinned' : null

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
      // Sombra projetada real (item 17): o corpo projeta no chão, como os
      // objetos de cena já faziam. O fantasma não — referência não faz sombra.
      castShadow={!ghost}
      onClick={isEye ? undefined : onClick}
    >
      {part.kind === 'lathe' && latheProfile && (
        <latheGeometry args={[latheProfile, PART_LATHE_SEGMENTS]} />
      )}
      {part.kind === 'ellipsoid' && <sphereGeometry args={[1, PART_LATHE_SEGMENTS, 12]} />}
      {part.kind === 'box' && <boxGeometry args={[part.size[0], part.size[1], part.size[2]]} />}
      {/* No fantasma a cor do papel vence até os olhos e o pino de latão: ele é
          uma silhueta de referência, e manchas pretas dentro de um corpo
          translúcido só chamariam atenção para o lugar errado.

          `depthWrite` desligado é o que permite dois fantasmas se atravessarem
          sem um recortar o outro em pedaços — o mesmo truque da sombra. */}
      {!ghost && silhouette ? (
        // Silhueta (item 8): preto chapado, sem luz e sem destaques — material
        // alternativo, geometria e interação intactas.
        <meshBasicMaterial color={SILHOUETTE_COLOR} />
      ) : (
        <meshStandardMaterial
          color={ghost ? ghost.color : (fixedColor ?? color)}
          emissive={
            highlight === 'selected'
              ? SELECTED_EMISSIVE
              : highlight === 'locked'
                ? LOCKED_EMISSIVE
                : highlight === 'pinned'
                  ? PINNED_EMISSIVE
                  : '#000000'
          }
          emissiveIntensity={
            highlight === 'selected'
              ? SELECTED_EMISSIVE_INTENSITY
              : highlight === 'locked'
                ? LOCKED_EMISSIVE_INTENSITY
                : highlight === 'pinned'
                  ? PINNED_EMISSIVE_INTENSITY
                  : 0
          }
          transparent={Boolean(ghost)}
          opacity={ghost ? ghost.opacity : 1}
          depthWrite={!ghost}
        />
      )}
    </mesh>
  )
}

interface BoneProps {
  to: readonly [number, number, number]
  style: Exclude<BoneStyle, { kind: 'hidden' }>
  color: string
  ghost?: GhostStyle | null
  /** Modo silhueta (item 8) — preto chapado; o fantasma vence. */
  silhouette?: boolean
}

/** Osso ligando a origem da junta (0,0,0) ao offset local da junta filha, com o perfil da camada visual do `skeleton.ts`. */
function Bone({ to, style, color, ghost, silhouette }: BoneProps) {
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

    // `offsetX` das lâminas é somado ao PONTO MÉDIO, ou seja no espaço local
    // da junta pai — e não à geometria, cujo eixo X vem invertido pela
    // rotação de 180° que alinha o +Y do molde ao -Y do osso. Assim o sinal
    // do deslocamento é o mesmo que se lê no `skeleton.ts` (DECISOES.md #45).
    const center = target.multiplyScalar(0.5)
    if (style.kind === 'blade' && style.offsetX) center.x += style.offsetX

    return {
      length: boneLength,
      quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number],
      midpoint: center.toArray() as [number, number, number],
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
      castShadow={!ghost}
    >
      {profile && <latheGeometry args={[profile, BONE_LATHE_SEGMENTS]} />}
      {!ghost && silhouette ? (
        <meshBasicMaterial color={SILHOUETTE_COLOR} />
      ) : (
        <meshStandardMaterial
          color={ghost ? ghost.color : color}
          transparent={Boolean(ghost)}
          opacity={ghost ? ghost.opacity : 1}
          depthWrite={!ghost}
        />
      )}
    </mesh>
  )
}

interface JointBodyProps {
  name: string
  color: string
  selected: boolean
  locked?: boolean
  pinned?: boolean
  ghost?: GhostStyle | null
  silhouette?: boolean
  style: FigureStyle
  onSelect?: () => void
  touchTargetRadius?: number
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void
}

/** Todas as peças da junta. O destaque emissivo cobre a peça inteira (ovo+nariz/orelhas na cabeça); os olhos ficam sempre pretos e sem destaque. */
function JointBody({
  name,
  color,
  selected,
  locked,
  pinned,
  ghost,
  silhouette,
  style,
  onSelect,
  touchTargetRadius,
  onPointerDown,
}: JointBodyProps) {
  const parts = getJointParts(name, style)
  const handleClick = createSelectHandler(onSelect)

  return (
    <>
      {parts.map((part, index) => (
        <PartMesh
          key={index}
          part={part}
          name={index === 0 && !ghost ? `segment-${name}` : undefined}
          color={color}
          selected={selected}
          locked={locked}
          pinned={pinned}
          ghost={ghost}
          silhouette={silhouette}
          onClick={handleClick}
        />
      ))}
      {/* Alvo de toque invisível (módulo de poses): maior que a geometria da
          junta, fecha o que o palito não engordou. Fantasma não recebe. */}
      {touchTargetRadius && !ghost && (handleClick || onPointerDown) && (
        <mesh visible={false} onClick={handleClick} onPointerDown={onPointerDown}>
          <sphereGeometry args={[touchTargetRadius, 8, 8]} />
        </mesh>
      )}
    </>
  )
}

interface JointNodeProps {
  name: string
  figure: FigureData
  selectedJointName?: string | null
  lockedJointNames?: readonly string[] | null
  pinnedJointNames?: readonly string[] | null
  ghost?: GhostStyle | null
  silhouette?: boolean
  style: FigureStyle
  onSelectJoint?: (jointName: string) => void
  onJointRef?: (jointName: string, object: THREE.Group | null) => void
  touchTargetRadius?: number
  onJointPointerDown?: (jointName: string, event: ThreeEvent<PointerEvent>) => void
}

function JointNode({
  name,
  figure,
  selectedJointName,
  lockedJointNames,
  pinnedJointNames,
  ghost,
  silhouette,
  style,
  onSelectJoint,
  onJointRef,
  touchTargetRadius,
  onJointPointerDown,
}: JointNodeProps) {
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

  // O callback de `ref` precisa ser ESTÁVEL. React chama o ref anterior com
  // `null` e o novo com o objeto sempre que a IDENTIDADE da função muda — com
  // uma seta inline aqui, cada re-render do boneco desregistrava e registrava
  // as 32 juntas de novo, e cada registro é um `setState` no `Viewport`, que
  // re-renderiza o boneco… (ver DECISOES.md — laço de re-render).
  const registerRef = useCallback(
    (object: THREE.Group | null) => onJointRef?.(isRoot ? ROOT_PIVOT_REF_NAME : name, object),
    [onJointRef, isRoot, name],
  )

  // Ressalva: o grupo interno da root não é registrado
  // como alvo do gizmo — o grupo externo (`Figure`, abaixo) é quem carrega
  // `figure.position` de fato.
  return (
    <group
      name={ghost ? undefined : `joint-${name}`}
      position={joint.position}
      rotation={degToRadTriple(rotation)}
      ref={onJointRef ? registerRef : undefined}
    >
      <JointBody
        name={name}
        color={figure.color}
        selected={name === selectedJointName}
        locked={lockedJointNames?.includes(name) ?? false}
        pinned={pinnedJointNames?.includes(name) ?? false}
        ghost={ghost}
        silhouette={silhouette}
        style={style}
        onSelect={onSelectJoint && interactive ? () => onSelectJoint(name) : undefined}
        touchTargetRadius={touchTargetRadius}
        onPointerDown={
          onJointPointerDown && interactive
            ? (event) => onJointPointerDown(name, event)
            : undefined
        }
      />
      {children.map((child) => {
        const boneStyle = getBoneStyle(child.name, style)
        if (boneStyle.kind === 'hidden') return null
        return (
          <Bone
            key={child.name}
            to={child.position}
            style={boneStyle}
            color={figure.color}
            ghost={ghost}
            silhouette={silhouette}
          />
        )
      })}
      {children.map((child) => (
        <JointNode
          key={child.name}
          name={child.name}
          figure={figure}
          selectedJointName={selectedJointName}
          lockedJointNames={lockedJointNames}
          pinnedJointNames={pinnedJointNames}
          ghost={ghost}
          silhouette={silhouette}
          style={style}
          onSelectJoint={onSelectJoint}
          onJointRef={onJointRef}
          touchTargetRadius={touchTargetRadius}
          onJointPointerDown={onJointPointerDown}
        />
      ))}
    </group>
  )
}

/** Sombra no chão — equivalente virtual à base de madeira do manequim. */
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

export function Figure({
  figure,
  selectedJointName,
  lockedJointNames,
  pinnedJointNames,
  onSelectJoint,
  onJointRef,
  ghost,
  style = DEFAULT_FIGURE_STYLE,
  silhouette,
  touchTargetRadius,
  onJointPointerDown,
}: FigureProps) {
  const scale = getHeightScale(figure.height)
  const [x, , z] = figure.position

  // Fantasma não é um boneco da cena: não recebe clique, não registra junta
  // para gizmo, não tem junta selecionada nem destaque de trava/âncora.
  // Cortar aqui, num lugar só, é o que evita ter de lembrar disso em cada
  // ponto de chamada.
  const selected = ghost ? null : selectedJointName
  const locked = ghost ? null : lockedJointNames
  const pinned = ghost ? null : pinnedJointNames
  const handleSelectJoint = ghost ? undefined : onSelectJoint
  const handleJointRef = ghost ? undefined : onJointRef
  const handleJointPointerDown = ghost ? undefined : onJointPointerDown
  const touchRadius = ghost ? undefined : touchTargetRadius

  // Estável pelo mesmo motivo do `registerRef` do `JointNode`.
  const registerRootRef = useCallback(
    (object: THREE.Group | null) => handleJointRef?.(ROOT_JOINT_NAME, object),
    [handleJointRef],
  )

  return (
    <>
      {/* Fantasma NÃO carrega os nomes da cena (`figure-`, `joint-`,
          `segment-`). `CameraRig` acha o boneco por `getObjectByName`, que
          devolve o primeiro da travessia: com nomes repetidos, "enquadrar
          boneco" mediria a caixa de um keyframe vizinho, e o erro só apareceria
          como um enquadramento estranho, sem pista de causa. */}
      <group
        name={ghost ? undefined : `figure-${figure.id}`}
        position={figure.position}
        scale={scale}
        visible={figure.visible}
        ref={handleJointRef ? registerRootRef : undefined}
      >
        <JointNode
          name={ROOT_JOINT_NAME}
          figure={figure}
          selectedJointName={selected}
          lockedJointNames={locked}
          pinnedJointNames={pinned}
          ghost={ghost}
          silhouette={silhouette}
          style={style}
          onSelectJoint={handleSelectJoint}
          onJointRef={handleJointRef}
          touchTargetRadius={touchRadius}
          onJointPointerDown={handleJointPointerDown}
        />
      </group>

      {/* Grupo separado do boneco: acompanha X/Z, mas fica sempre no chão (mesma lógica de `Figure`).
          O fantasma não projeta sombra — duas manchas a mais no chão só sujariam
          a leitura de onde o boneco de trabalho está pisando. */}
      {!ghost && (
        <group position={[x, SHADOW_GROUND_OFFSET, z]} scale={scale} visible={figure.visible}>
          <FigureShadow figureId={figure.id} color={figure.color} />
        </group>
      )}
    </>
  )
}

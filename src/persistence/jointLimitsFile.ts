import {
  JOINTS,
  getJoint,
  sanitizeJointLimitOverrides,
  type JointLimitOverrides,
  type JointLimits,
} from '../figure/skeleton'

/**
 * Schema do `joint-limits.json` gravado junto com o workspace: permite
 * customizar as faixas de rotação das juntas sem tocar no código (ver
 * DECISOES.md #29 e PLANO.md > "Workspace: limites articulares customizáveis").
 *
 * Arquivo separado do `workspace.json` (decisão do usuário): o dump completo
 * são 31 juntas e o manifesto continua pequeno e legível. Puro como o resto de
 * `sceneSerialization.ts` — só mapeia objetos JS simples, sem `three`/glTF —,
 * então é 100% testável sem navegador.
 */

export const JOINT_LIMITS_FILENAME = 'joint-limits.json'
export const JOINT_LIMITS_VERSION = 1

/** Explicação embutida no próprio arquivo — JSON não aceita comentários e este arquivo existe para ser editado à mão. */
const README_LINES: readonly string[] = [
  'Limites de rotação de cada junta, em GRAUS. Editável à mão: ajuste "min"/"max" e reabra o workspace.',
  'Só os valores min/max podem mudar — eixos ausentes aqui não são graus de liberdade da junta e adicioná-los não tem efeito.',
  'A junta "root" não aparece: ela gira livre (colocação do boneco na cena), sem limite.',
  'Cuidado com pares L/R: nos eixos y e z o MESMO número produz o movimento oposto nos dois lados (ver DECISOES.md #14).',
  'Valores inválidos (min > max, texto no lugar de número, junta inexistente) são ignorados e o padrão do código continua valendo.',
  'Ao abrir o workspace, poses salvas fora da faixa nova são ajustadas para dentro dela.',
]

export interface JointLimitsFile {
  version: number
  leiame: readonly string[]
  joints: Record<string, JointLimits>
}

/**
 * Monta o arquivo com os limites EM VIGOR de todas as juntas — os padrões do
 * código quando não há customização (é o "copiar os valores padrão" pedido ao
 * salvar um workspace novo), ou os customizados quando um workspace já os
 * trouxe. Assim o arquivo é sempre um retrato completo e auto-explicativo do
 * que a aplicação está usando, não um diff.
 */
export function buildJointLimitsFile(): JointLimitsFile {
  const joints: Record<string, JointLimits> = {}

  for (const joint of JOINTS) {
    const limits = getJoint(joint.name).limits
    const axes = Object.keys(limits)
    if (axes.length === 0) continue // `root` — gira livre, não tem o que customizar
    joints[joint.name] = { ...limits }
  }

  return { version: JOINT_LIMITS_VERSION, leiame: README_LINES, joints }
}

/**
 * Lê um `joint-limits.json` (nunca confiável) e devolve só os overrides
 * aplicáveis — o resultado já é o que `setJointLimitOverrides` instalaria.
 * Um arquivo idêntico aos padrões devolve `{}`: não é customização nenhuma.
 */
export function parseJointLimitsFile(json: unknown): JointLimitOverrides {
  const source = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>
  // Aceita tanto o arquivo completo quanto um objeto contendo direto as juntas
  // (quem edita à mão às vezes cola só o mapa); `sanitize` descarta o que não
  // for nome de junta conhecido, então as duas formas são seguras.
  const joints = typeof source.joints === 'object' && source.joints !== null ? source.joints : source
  return sanitizeJointLimitOverrides(joints)
}

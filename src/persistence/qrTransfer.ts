/**
 * Protocolo de remessa da sessão por QR code (item 65, DECISOES.md #101).
 *
 * O desktop exibe a sessão como uma SEQUÊNCIA de QR codes em ciclo; o celular
 * coleta as fatias com a câmera, em qualquer ordem, até completar. Sem rede,
 * sem arquivo, sem app externo — só a câmera olhando para a tela.
 *
 * Formato da fatia: `VMQR1|<id>|<índice>|<total>|<payload>`
 *   - `id` — hash FNV-1a do base64 completo; identifica a remessa (fatias de
 *     remessas diferentes não se misturam) e muda a cada conteúdo.
 *   - `índice` — 1-based, para o progresso na tela ("3 de 12") ser literal.
 *   - `payload` — base64 do deflate (formato zlib, COM checksum: é o Adler-32
 *     do inflate que denuncia fatia adulterada, o formato não precisa de CRC
 *     próprio).
 *
 * A compressão importa: o JSON de workspace é altamente repetitivo (as mesmas
 * 32 chaves de junta em todo boneco de todo keyframe) e encolhe ~10×, o que
 * derruba a remessa típica para poucas fatias.
 */

export const QR_CHUNK_PREFIX = 'VMQR1'

/**
 * Base64 por fatia. QR de ~1 KB (modo byte, correção M) ainda escaneia bem de
 * uma tela de monitor; acima disso a densidade começa a punir câmeras comuns.
 */
const QR_CHUNK_PAYLOAD_SIZE = 800

/** Resultado de `accept`: o que aconteceu com a fatia e o progresso atual. */
export interface QrChunkAccept {
  kind: 'added' | 'duplicate' | 'foreign' | 'invalid'
  received: number
  /** `null` enquanto nenhuma fatia válida chegou (total ainda desconhecido). */
  total: number | null
  complete: boolean
}

/** Hash FNV-1a 32 bits em hex — barato, síncrono e suficiente como id de remessa. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Junta os pedaços de um stream — sem `Blob.stream()`/`Response`, que o jsdom não tem. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    size += value.length
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function pump(
  bytes: Uint8Array<ArrayBuffer>,
  transform: { writable: WritableStream<BufferSource>; readable: ReadableStream<Uint8Array> },
): Promise<Uint8Array> {
  const writer = transform.writable.getWriter()
  // Escrita e leitura em paralelo: aguardar a escrita antes de drenar travaria
  // se o buffer interno do stream enchesse.
  const writing = writer.write(bytes).then(() => writer.close())
  // Marca a rejeição como tratada: quando o inflate reprova, `drain` rejeita
  // ANTES do `await writing`, e a mesma falha derrubaria o processo como
  // "unhandled rejection". O erro real continua propagando pelo `drain`.
  writing.catch(() => {})
  const result = await drain(transform.readable)
  await writing
  return result
}

async function deflate(text: string): Promise<Uint8Array> {
  return pump(new TextEncoder().encode(text), new CompressionStream('deflate'))
}

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return new TextDecoder().decode(await pump(bytes, new DecompressionStream('deflate')))
}

/** `btoa` em blocos: o spread de um array grande estoura a pilha. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const block = 0x8000
  for (let i = 0; i < bytes.length; i += block) {
    binary += String.fromCharCode(...bytes.subarray(i, i + block))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Fatia o JSON da sessão nos textos que viram QR codes, na ordem de exibição. */
export async function encodeSessionToQrChunks(json: string): Promise<string[]> {
  const base64 = bytesToBase64(await deflate(json))
  const id = fnv1a(base64)
  const total = Math.max(1, Math.ceil(base64.length / QR_CHUNK_PAYLOAD_SIZE))

  return Array.from({ length: total }, (_, i) => {
    const payload = base64.slice(i * QR_CHUNK_PAYLOAD_SIZE, (i + 1) * QR_CHUNK_PAYLOAD_SIZE)
    return `${QR_CHUNK_PREFIX}|${id}|${i + 1}|${total}|${payload}`
  })
}

interface ParsedChunk {
  id: string
  index: number
  total: number
  payload: string
}

function parseChunk(text: string): ParsedChunk | null {
  const parts = text.split('|')
  if (parts.length !== 5 || parts[0] !== QR_CHUNK_PREFIX) return null
  const index = Number(parts[2])
  const total = Number(parts[3])
  if (!Number.isInteger(index) || !Number.isInteger(total)) return null
  if (total < 1 || index < 1 || index > total) return null
  if (!parts[1] || !parts[4]) return null
  return { id: parts[1], index, total, payload: parts[4] }
}

/**
 * Coletor de fatias do lado da câmera: a primeira fatia válida estabelece a
 * remessa; as demais só entram se forem dela. Repetição é normal (a câmera lê
 * o mesmo quadro várias vezes) e não conta no progresso.
 */
export function createQrChunkCollector(): {
  accept: (text: string) => QrChunkAccept
  assemble: () => Promise<string | null>
} {
  let shipmentId: string | null = null
  let total: number | null = null
  const payloads = new Map<number, string>()

  const progress = (kind: QrChunkAccept['kind']): QrChunkAccept => ({
    kind,
    received: payloads.size,
    total,
    complete: total !== null && payloads.size === total,
  })

  return {
    accept: (text) => {
      const chunk = parseChunk(text)
      if (!chunk) return progress('invalid')
      if (shipmentId === null) {
        shipmentId = chunk.id
        total = chunk.total
      } else if (chunk.id !== shipmentId || chunk.total !== total) {
        return progress('foreign')
      }
      if (payloads.has(chunk.index)) return progress('duplicate')
      payloads.set(chunk.index, chunk.payload)
      return progress('added')
    },

    assemble: async () => {
      if (total === null || payloads.size !== total) return null
      let base64 = ''
      for (let i = 1; i <= total; i++) base64 += payloads.get(i)
      try {
        return await inflate(base64ToBytes(base64))
      } catch {
        // Base64 inválido ou checksum do deflate reprovado — remessa corrompida.
        return null
      }
    },
  }
}

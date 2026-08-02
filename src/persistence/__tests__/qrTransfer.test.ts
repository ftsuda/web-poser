import { describe, expect, it } from 'vitest'
import {
  QR_CHUNK_PREFIX,
  createQrChunkCollector,
  encodeSessionToQrChunks,
} from '../qrTransfer'

/**
 * O protocolo de remessa por QR (item 65): o JSON da sessão vira uma sequência
 * de fatias de texto, cada uma um QR code na tela do desktop. O celular coleta
 * as fatias EM QUALQUER ORDEM (a câmera pega o quadro que estiver exposto),
 * tolera repetição e ignora fatias de outra remessa. A integridade vem do
 * deflate com checksum: payload adulterado não infla, e a remontagem devolve
 * `null` em vez de uma sessão corrompida.
 */

/** JSON repetitivo como o de um workspace real — chaves de junta idênticas em todo boneco. */
function repetitiveWorkspaceJson(figures: number): string {
  const joints = Object.fromEntries(
    Array.from({ length: 32 }, (_, i) => [`joint-${i}`, { x: i * 0.5, y: -i, z: i % 7 }]),
  )
  return JSON.stringify({
    version: 1,
    figures: Array.from({ length: figures }, (_, i) => ({
      id: `figure-${i + 1}`,
      position: { x: i, y: 0, z: -i },
      rotation: { x: 0, y: 15, z: 0 },
      joints,
    })),
  })
}

/**
 * JSON com ângulos todos distintos: o deflate encolhe pouco e a remessa rende
 * VÁRIAS fatias — é o fixture dos testes de remontagem fora de ordem.
 */
function variedWorkspaceJson(figures: number): string {
  return JSON.stringify({
    version: 1,
    figures: Array.from({ length: figures }, (_, f) => ({
      id: `figure-${f + 1}`,
      joints: Object.fromEntries(
        Array.from({ length: 32 }, (_, j) => [
          `joint-${j}`,
          {
            x: Math.sin(f * 32 + j) * 90,
            y: Math.cos(f * 17 + j * 3) * 45,
            z: Math.sin(f + j * 7) * 30,
          },
        ]),
      ),
    })),
  })
}

describe('encodeSessionToQrChunks', () => {
  it('fatia a remessa com cabeçalho, índices sequenciais e o mesmo id em todas', async () => {
    const chunks = await encodeSessionToQrChunks(variedWorkspaceJson(8))

    expect(chunks.length).toBeGreaterThan(0)
    const parts = chunks.map((chunk) => chunk.split('|'))
    for (const part of parts) {
      expect(part[0]).toBe(QR_CHUNK_PREFIX)
      expect(part).toHaveLength(5)
    }
    const ids = new Set(parts.map((part) => part[1]))
    expect(ids.size).toBe(1)
    expect(parts.map((part) => Number(part[2]))).toEqual(chunks.map((_, i) => i + 1))
    expect(new Set(parts.map((part) => Number(part[3])))).toEqual(new Set([chunks.length]))
  })

  it('comprime antes de fatiar: JSON repetitivo de workspace rende poucas fatias', async () => {
    const json = repetitiveWorkspaceJson(60)
    expect(json.length).toBeGreaterThan(60_000)

    const chunks = await encodeSessionToQrChunks(json)

    // Sem compressão seriam ~100+ fatias (base64 de 60 KB ÷ 800 chars por fatia).
    expect(chunks.length).toBeLessThan(10)
  })

  it('sessão pequena cabe numa fatia só', async () => {
    const chunks = await encodeSessionToQrChunks('{"version":1}')
    expect(chunks).toHaveLength(1)
  })

  it('remessas de conteúdos diferentes têm ids diferentes', async () => {
    const [a] = await encodeSessionToQrChunks('{"a":1}')
    const [b] = await encodeSessionToQrChunks('{"b":2}')
    expect(a.split('|')[1]).not.toBe(b.split('|')[1])
  })
})

describe('createQrChunkCollector', () => {
  it('remonta o JSON original com fatias fora de ordem e repetidas', async () => {
    const json = variedWorkspaceJson(12)
    const chunks = await encodeSessionToQrChunks(json)
    expect(chunks.length).toBeGreaterThan(1)

    const collector = createQrChunkCollector()
    // Ordem embaralhada determinística (ímpares de trás pra frente, depois pares),
    // com a primeira fatia repetida no meio — como uma câmera de verdade coleta.
    const shuffled = [
      ...chunks.filter((_, i) => i % 2 === 1).reverse(),
      chunks[0],
      ...chunks.filter((_, i) => i % 2 === 0),
    ]
    for (const chunk of shuffled) collector.accept(chunk)

    await expect(collector.assemble()).resolves.toBe(json)
  })

  it('relata progresso: added conta, duplicate não', async () => {
    const chunks = await encodeSessionToQrChunks(variedWorkspaceJson(12))
    const collector = createQrChunkCollector()

    const first = collector.accept(chunks[0])
    expect(first).toMatchObject({
      kind: 'added',
      received: 1,
      total: chunks.length,
      complete: false,
    })

    const again = collector.accept(chunks[0])
    expect(again).toMatchObject({ kind: 'duplicate', received: 1 })
  })

  it('completa quando a última fatia chega', async () => {
    const chunks = await encodeSessionToQrChunks('{"version":1}')
    const collector = createQrChunkCollector()

    const result = collector.accept(chunks[0])
    expect(result).toMatchObject({ kind: 'added', received: 1, total: 1, complete: true })
  })

  it('ignora fatia de outra remessa sem perder o progresso', async () => {
    const chunks = await encodeSessionToQrChunks(variedWorkspaceJson(12))
    const [foreign] = await encodeSessionToQrChunks('{"outra":true}')
    const collector = createQrChunkCollector()

    collector.accept(chunks[0])
    const result = collector.accept(foreign)

    expect(result).toMatchObject({ kind: 'foreign', received: 1 })
  })

  it('rejeita texto que não é fatia (QR alheio, lixo)', () => {
    const collector = createQrChunkCollector()
    expect(collector.accept('https://example.com')).toMatchObject({
      kind: 'invalid',
      received: 0,
      total: null,
    })
    expect(collector.accept(`${QR_CHUNK_PREFIX}|só|duas`)).toMatchObject({ kind: 'invalid' })
  })

  it('assemble devolve null enquanto a remessa está incompleta', async () => {
    const chunks = await encodeSessionToQrChunks(variedWorkspaceJson(12))
    expect(chunks.length).toBeGreaterThan(1)
    const collector = createQrChunkCollector()
    collector.accept(chunks[0])

    await expect(collector.assemble()).resolves.toBeNull()
  })

  it('assemble devolve null quando uma fatia foi adulterada', async () => {
    const json = variedWorkspaceJson(12)
    const chunks = await encodeSessionToQrChunks(json)
    const collector = createQrChunkCollector()

    // Adultera o payload da última fatia preservando cabeçalho e tamanho: o
    // deflate (com checksum) é quem denuncia, não o formato da fatia.
    const last = chunks[chunks.length - 1]
    const head = last.slice(0, -8)
    const tail = last.slice(-8)
    const tampered = `${head}${tail
      .split('')
      .map((c) => (c === 'A' ? 'B' : 'A'))
      .join('')}`

    for (const chunk of chunks.slice(0, -1)) collector.accept(chunk)
    collector.accept(tampered)

    await expect(collector.assemble()).resolves.toBeNull()
  })
})

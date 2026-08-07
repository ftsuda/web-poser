import { describe, expect, it } from 'vitest'
import { formatExportTimestamp, withExportTimestamp } from '../exportTimestamp'

/**
 * Carimbo de data/hora dos arquivos exportados (pedido do usuário, 2026-08-07).
 * Formato `_AAAA-MM-DD-HHmm`, em HORA LOCAL: o nome tem de bater com o relógio
 * ao lado de quem exportou — o app é offline e de uso pessoal, e um nome em UTC
 * mentiria sobre a hora em que o arquivo saiu.
 *
 * As datas dos testes são INJETADAS; nada aqui lê o relógio da máquina, e o
 * `new Date(ano, mês, dia, h, m)` já é local por construção, então a suíte passa
 * em qualquer fuso.
 */
describe('formatExportTimestamp', () => {
  it('formata em AAAA-MM-DD-HHmm, com zero à esquerda em tudo', () => {
    expect(formatExportTimestamp(new Date(2026, 7, 7, 14, 32))).toBe('2026-08-07-1432')
  })

  it('preenche mês, dia, hora e minuto de um dígito', () => {
    expect(formatExportTimestamp(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05-0907')
  })

  it('meia-noite é 0000, não some do nome', () => {
    expect(formatExportTimestamp(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31-0000')
  })

  it('não leva os segundos — o minuto é a resolução do nome', () => {
    expect(formatExportTimestamp(new Date(2026, 7, 7, 14, 32, 59))).toBe('2026-08-07-1432')
  })
})

describe('withExportTimestamp', () => {
  const quando = new Date(2026, 7, 7, 14, 32)

  it('insere o sufixo ANTES da extensão, que continua sendo a última coisa do nome', () => {
    expect(withExportTimestamp('minha-cena.json', quando)).toBe('minha-cena_2026-08-07-1432.json')
  })

  it('vale para qualquer extensão — o PNG e o MP4 usam o mesmo carimbo', () => {
    expect(withExportTimestamp('Cena-1_snap002.png', quando)).toBe('Cena-1_snap002_2026-08-07-1432.png')
    expect(withExportTimestamp('Corrida.mp4', quando)).toBe('Corrida_2026-08-07-1432.mp4')
  })

  it('preserva sufixos que o nome já traz, como o `_depth` do mapa de profundidade', () => {
    expect(withExportTimestamp('Cena-1_snap002_depth.png', quando)).toBe(
      'Cena-1_snap002_depth_2026-08-07-1432.png',
    )
  })

  it('nome sem extensão recebe o carimbo no fim', () => {
    expect(withExportTimestamp('cena', quando)).toBe('cena_2026-08-07-1432')
  })

  it('só o último ponto conta — nome com ponto no meio não é cortado no lugar errado', () => {
    expect(withExportTimestamp('cena.v2.json', quando)).toBe('cena.v2_2026-08-07-1432.json')
  })

  it('ponto inicial é parte do nome, não extensão', () => {
    expect(withExportTimestamp('.cena', quando)).toBe('.cena_2026-08-07-1432')
  })
})

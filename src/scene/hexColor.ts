/**
 * Normalização de cor `#rrggbb` — a regra que valida o FORMATO, e não uma
 * lista de valores permitidos (DECISOES.md #39).
 *
 * Mora aqui, e não no `figuresStore`, porque desde os objetos de cena há dois
 * consumidores independentes: o boneco (`figuresStore.normalizeFigureColor`,
 * que reexporta esta função) e o objeto (`props/sceneProp.ts`). Importar o
 * store a partir do módulo do objeto criaria um ciclo — o store é quem importa
 * o objeto.
 */

const HEX_COLOR = /^#[0-9a-f]{6}$/

/**
 * Aceita só `#rrggbb` minúsculo depois de normalizar — é o formato que o
 * `<input type="color">` produz, o que o `THREE.MeshStandardMaterial` entende
 * e o que vai para o `.glb`. Validar o FORMATO é o que permite cor livre sem
 * deixar entrar string arbitrária vinda de um arquivo de cena ou do
 * `localStorage`.
 *
 * A forma curta `#rgb` é aceita e expandida: é válida em CSS, e um usuário
 * editando um `.glb` à mão pode escrevê-la.
 */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`
  }
  return HEX_COLOR.test(text) ? text : null
}

/**
 * Utilitários de E/S de arquivo compartilhados entre a captura de keyframes
 * (fase 5) e a persistência de cenas/bonecos/bookmarks (fase 6): gravação via
 * File System Access API com fallback de download, e seleção/leitura de
 * arquivo para importação. Extraído de `KeyframeCapture.tsx` (que usava a
 * mesma lógica só para PNG) para reaproveitar também com `.glb`/`.json`.
 */

export async function writeFileToDirectoryOrDownload(
  directoryHandle: FileSystemDirectoryHandle | null,
  filename: string,
  blob: Blob,
): Promise<void> {
  if (directoryHandle) {
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function isFileSystemAccessAvailable(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/** Abre o seletor nativo de arquivo (`<input type="file">`) e resolve com o `ArrayBuffer` escolhido, ou `null` se o usuário cancelar. */
export function pickFile(accept: string): Promise<{ file: File; data: ArrayBuffer } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      void file.arrayBuffer().then((data) => resolve({ file, data }))
    })
    // Alguns navegadores só disparam `change` se o diálogo resultar numa
    // escolha; se o usuário cancelar sem escolher nada, a Promise nunca
    // resolve — aceitável aqui (o chamador fica esperando uma ação do
    // usuário, igual a um `<input>` comum).
    input.click()
  })
}

export function pickMultipleFiles(accept: string): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = true
    input.addEventListener('change', () => {
      const files = input.files ? Array.from(input.files) : []
      resolve(files.length > 0 ? files : null)
    })
    input.click()
  })
}

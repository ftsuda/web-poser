// `showDirectoryPicker` e a checagem de permissão não fazem parte do
// `lib.dom.d.ts` padrão do TypeScript (API ainda não-padronizada, só
// implementada em navegadores baseados em Chromium — ver PLANO.md >
// "Exportação de imagem (instantâneos)").

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>
}

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: FileSystemHandle | string
}

interface Window {
  showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}

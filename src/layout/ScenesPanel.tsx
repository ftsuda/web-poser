import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { slugifySceneName } from '../snapshot/snapshotNaming'
import { isFileSystemAccessAvailable, pickFile, pickMultipleFiles, writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { exportSceneToGlb, importSceneFromGlb } from '../persistence/sceneFile'
import { loadWorkspaceFromDirectory, loadWorkspaceFromFiles, saveWorkspaceToDirectory } from '../persistence/workspaceFolder'
import { useFiguresStore } from '../store/figuresStore'
import { importErrorKey } from './fileFeedback'
import { CollapsiblePanel } from './CollapsiblePanel'

/**
 * Painel do "workspace": catálogo de snapshots de cena (salvar/carregar/
 * remover) + exportar/importar a cena de trabalho atual como `.glb` — ver
 * PLANO.md > "Workspace: catálogo de cenas" e DECISOES.md #11.
 */
export function ScenesPanel() {
  const { t } = useTranslation()
  const scenes = useFiguresStore((state) => state.scenes)
  const activeSceneId = useFiguresStore((state) => state.activeSceneId)
  const sceneName = useFiguresStore((state) => state.sceneName)
  const figures = useFiguresStore((state) => state.figures)
  const nextFigureSeq = useFiguresStore((state) => state.nextFigureSeq)
  const props = useFiguresStore((state) => state.props)
  const nextPropSeq = useFiguresStore((state) => state.nextPropSeq)
  const environment = useFiguresStore((state) => state.environment)
  const cameraBookmarks = useFiguresStore((state) => state.cameraBookmarks)
  const nextCameraBookmarkSeq = useFiguresStore((state) => state.nextCameraBookmarkSeq)
  const nextSnapshotNumber = useFiguresStore((state) => state.nextSnapshotNumber)
  const sceneCamera = useFiguresStore((state) => state.sceneCamera)
  const saveSceneSnapshot = useFiguresStore((state) => state.saveSceneSnapshot)
  const loadSceneSnapshot = useFiguresStore((state) => state.loadSceneSnapshot)
  const removeSceneSnapshot = useFiguresStore((state) => state.removeSceneSnapshot)
  const loadSceneWorkingState = useFiguresStore((state) => state.loadSceneWorkingState)
  const loadWorkspaceCatalog = useFiguresStore((state) => state.loadWorkspaceCatalog)
  const poseLibrary = useFiguresStore((state) => state.poseLibrary)
  const animations = useFiguresStore((state) => state.animations)
  const clipLibrary = useFiguresStore((state) => state.clipLibrary)
  const jointLimits = useFiguresStore((state) => state.jointLimits)
  const resetJointLimits = useFiguresStore((state) => state.resetJointLimits)
  const resetWorkspace = useFiguresStore((state) => state.resetWorkspace)

  const [isNaming, setIsNaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [workspaceDirectoryHandle, setWorkspaceDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  /** Chave i18n do último erro de importação (fase 9, item 4); `null` quando não há erro. */
  const [errorKey, setErrorKey] = useState<string | null>(null)
  /** Confirmação em dois passos do "novo workspace" (fase 9, item 7) — ação destrutiva que o Ctrl+Z não desfaz. */
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)
  const fileSystemAccessAvailable = isFileSystemAccessAvailable()

  const startNaming = () => {
    setNameDraft(sceneName)
    setIsNaming(true)
  }
  const cancelNaming = () => {
    setIsNaming(false)
    setNameDraft('')
  }
  const confirmSave = (event: FormEvent) => {
    event.preventDefault()
    const name = nameDraft.trim()
    if (!name) return
    saveSceneSnapshot(name)
    setIsNaming(false)
    setNameDraft('')
  }

  const handleExport = async () => {
    const glb = await exportSceneToGlb({
      name: sceneName,
      figures,
      nextFigureSeq,
      props,
      nextPropSeq,
      environment,
      cameraBookmarks,
      nextCameraBookmarkSeq,
      nextSnapshotNumber,
      sceneCamera,
    })
    const filename = `${slugifySceneName(sceneName)}.glb`
    await writeFileToDirectoryOrDownload(null, filename, new Blob([glb], { type: 'model/gltf-binary' }))
  }

  const handleImport = async () => {
    const picked = await pickFile('.glb')
    if (!picked) return
    try {
      const imported = await importSceneFromGlb(picked.data)
      loadSceneWorkingState(imported)
      setErrorKey(null)
    } catch (error) {
      setErrorKey(importErrorKey(error))
    }
  }

  const handleSaveWorkspaceToFolder = async () => {
    let handle = workspaceDirectoryHandle
    if (!handle) {
      if (!window.showDirectoryPicker) return
      handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      setWorkspaceDirectoryHandle(handle)
    }
    // A biblioteca de poses vai junto, num `poses.json` da mesma pasta: ela é
    // do workspace, não de uma cena (ver DECISOES.md #42).
    // Biblioteca de poses e animações vão juntas, cada uma no seu arquivo da
    // mesma pasta: são do workspace, não de uma cena (DECISOES.md #42 e #52).
    await saveWorkspaceToDirectory(handle, scenes, activeSceneId, poseLibrary, animations, clipLibrary)
  }

  const handleOpenWorkspaceFromFolder = async () => {
    try {
      if (fileSystemAccessAvailable && window.showDirectoryPicker) {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
        setWorkspaceDirectoryHandle(handle)
        const loaded = await loadWorkspaceFromDirectory(handle)
        loadWorkspaceCatalog(
          loaded.scenes,
          loaded.activeSceneId,
          loaded.jointLimits,
          loaded.poses,
          loaded.animations,
          loaded.clips,
        )
        setErrorKey(null)
        return
      }

      const files = await pickMultipleFiles('.json,.glb')
      if (!files) return
      const loaded = await loadWorkspaceFromFiles(files)
      // `null` = a seleção não incluía o `workspace.json` — não é exceção,
      // mas também não é sucesso silencioso.
      if (!loaded) {
        setErrorKey('errors.workspaceManifestMissing')
        return
      }
      loadWorkspaceCatalog(
        loaded.scenes,
        loaded.activeSceneId,
        loaded.jointLimits,
        loaded.poses,
        loaded.animations,
        loaded.clips,
      )
      setErrorKey(null)
    } catch (error) {
      // Cancelar o seletor de pasta lança `AbortError` — não é falha nenhuma.
      if (error instanceof DOMException && error.name === 'AbortError') return
      setErrorKey(importErrorKey(error))
    }
  }

  const customJointLimitCount = Object.keys(jointLimits).length

  return (
    <CollapsiblePanel panelKey="scenes" className="panel--scenes" title={t('panels.scenes.title')}>
      
      {scenes.length === 0 ? (
        <p className="panel__empty">{t('panels.scenes.empty')}</p>
      ) : (
        <ul className="scenes-panel__list">
          {scenes.map((scene) => (
            <li key={scene.id} className="scenes-panel__row">
              <span className="scenes-panel__name">
                {scene.name}
                {scene.id === activeSceneId && (
                  <span className="scenes-panel__active-badge">{t('panels.scenes.active')}</span>
                )}
              </span>
              <button
                type="button"
                aria-label={t('panels.scenes.load')}
                title={t('panels.scenes.load')}
                onClick={() => loadSceneSnapshot(scene.id)}
              >
                &#8594;
              </button>
              <button
                type="button"
                aria-label={t('panels.scenes.remove')}
                title={t('panels.scenes.remove')}
                onClick={() => removeSceneSnapshot(scene.id)}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      {isNaming ? (
        <form className="scenes-panel__save-form" onSubmit={confirmSave}>
          <label htmlFor="scene-snapshot-name" className="scenes-panel__field">
            {t('panels.scenes.snapshotNameLabel')}
            <input
              id="scene-snapshot-name"
              type="text"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              autoFocus
            />
          </label>
          <div className="scenes-panel__save-form-actions">
            <button type="submit">{t('panels.scenes.confirmSave')}</button>
            <button type="button" onClick={cancelNaming}>
              {t('panels.scenes.cancelSave')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="scenes-panel__save" onClick={startNaming}>
          {t('panels.scenes.saveCurrent')}
        </button>
      )}

      {errorKey && (
        <p role="alert" className="panel__error">
          {t(errorKey)}
        </p>
      )}

      <div className="scenes-panel__file-actions">
        <button type="button" onClick={() => void handleExport()}>
          {t('panels.scenes.exportScene')}
        </button>
        <button type="button" onClick={() => void handleImport()}>
          {t('panels.scenes.importScene')}
        </button>

        {fileSystemAccessAvailable && (
          <button type="button" onClick={() => void handleSaveWorkspaceToFolder()}>
            {t('panels.scenes.saveWorkspaceToFolder')}
          </button>
        )}
        <button type="button" onClick={() => void handleOpenWorkspaceFromFolder()}>
          {t('panels.scenes.openWorkspaceFromFolder')}
        </button>
        <p className="scenes-panel__hint">
          {!fileSystemAccessAvailable
            ? t('panels.scenes.workspaceFolderUnavailable')
            : workspaceDirectoryHandle && t('panels.scenes.workspaceFolderChosen', { name: workspaceDirectoryHandle.name })}
        </p>

        {/* Novo workspace (fase 9, item 7): limpa TUDO — bonecos, catálogo de
            cenas, bookmarks, ambiente e limites — e zera o histórico de undo.
            Por isso a confirmação em dois passos, e não um clique só. */}
        {isConfirmingReset ? (
          <div className="scenes-panel__confirm">
            <p className="scenes-panel__hint scenes-panel__hint--warning">
              {t('panels.scenes.newWorkspaceConfirm')}
            </p>
            <div className="scenes-panel__save-form-actions">
              <button
                type="button"
                onClick={() => {
                  resetWorkspace()
                  setIsConfirmingReset(false)
                  setErrorKey(null)
                }}
              >
                {t('panels.scenes.newWorkspaceConfirmYes')}
              </button>
              <button type="button" onClick={() => setIsConfirmingReset(false)}>
                {t('panels.scenes.cancelSave')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setIsConfirmingReset(true)}>
            {t('panels.scenes.newWorkspace')}
          </button>
        )}

        {/* Limites articulares customizados pelo workspace (ver DECISOES.md #29):
            só aparece quando há customização em vigor — sem editor na UI, a
            edição é no próprio `joint-limits.json` da pasta. */}
        {customJointLimitCount > 0 && (
          <>
            <p className="scenes-panel__hint">
              {t('panels.scenes.customJointLimits', { count: customJointLimitCount })}
            </p>
            <button type="button" onClick={resetJointLimits}>
              {t('panels.scenes.resetJointLimits')}
            </button>
          </>
        )}
      </div>
    </CollapsiblePanel>
  )
}

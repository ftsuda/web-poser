import { useState, type ChangeEvent, type FocusEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { pickFile, writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { exportCameraBookmarksToGlb, importCameraBookmarksFromGlb } from '../persistence/sceneFile'
import { ORTHO_PRESET_NAMES, type OrthoPresetName } from '../scene/cameraPresets'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore } from '../store/figuresStore'
import { importErrorKey } from './fileFeedback'
import { CollapsiblePanel } from './CollapsiblePanel'

const PRESET_LABEL_KEYS: Record<OrthoPresetName, string> = {
  front: 'panels.camera.presetFront',
  back: 'panels.camera.presetBack',
  left: 'panels.camera.presetLeft',
  right: 'panels.camera.presetRight',
  top: 'panels.camera.presetTop',
  threeQuarter: 'panels.camera.presetThreeQuarter',
}

export function CameraPanel() {
  const { t } = useTranslation()
  const fov = useCameraStore((state) => state.fov)
  const projection = useCameraStore((state) => state.projection)
  const setFov = useCameraStore((state) => state.setFov)
  const applyPreset = useCameraStore((state) => state.applyPreset)
  const requestPerspective = useCameraStore((state) => state.requestPerspective)
  const applyBookmark = useCameraStore((state) => state.applyBookmark)
  const requestSaveBookmark = useCameraStore((state) => state.requestSaveBookmark)
  const cameraBookmarks = useFiguresStore((state) => state.cameraBookmarks)
  const removeCameraBookmark = useFiguresStore((state) => state.removeCameraBookmark)
  const importCameraBookmarks = useFiguresStore((state) => state.importCameraBookmarks)

  const [fovDraft, setFovDraft] = useState(() => String(fov))
  const [lastSyncedFov, setLastSyncedFov] = useState(fov)
  if (fov !== lastSyncedFov) {
    setLastSyncedFov(fov)
    setFovDraft(String(fov))
  }

  const [isNamingBookmark, setIsNamingBookmark] = useState(false)
  const [bookmarkNameDraft, setBookmarkNameDraft] = useState('')
  /** Chave i18n do último erro de importação de bookmarks (fase 9, item 4). */
  const [errorKey, setErrorKey] = useState<string | null>(null)

  const handleFovInput = (event: ChangeEvent<HTMLInputElement>) => {
    setFovDraft(event.target.value)
  }

  const commitFov = (event: FocusEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isNaN(value)) setFov(value)
  }

  const startNamingBookmark = () => {
    setBookmarkNameDraft(t('panels.camera.defaultBookmarkName', { index: cameraBookmarks.length + 1 }))
    setIsNamingBookmark(true)
  }

  const cancelNamingBookmark = () => {
    setIsNamingBookmark(false)
    setBookmarkNameDraft('')
  }

  const confirmSaveBookmark = (event: FormEvent) => {
    event.preventDefault()
    const name = bookmarkNameDraft.trim()
    if (!name) return
    requestSaveBookmark(name)
    setIsNamingBookmark(false)
    setBookmarkNameDraft('')
  }

  const handleExportBookmarks = async () => {
    const glb = await exportCameraBookmarksToGlb(cameraBookmarks)
    await writeFileToDirectoryOrDownload(null, 'camera-bookmarks.glb', new Blob([glb], { type: 'model/gltf-binary' }))
  }

  const handleImportBookmarks = async () => {
    const picked = await pickFile('.glb')
    if (!picked) return
    try {
      const imported = await importCameraBookmarksFromGlb(picked.data)
      importCameraBookmarks(
        imported.map((bookmark) => ({
          name: bookmark.name,
          position: bookmark.position,
          target: bookmark.target,
          projection: bookmark.projection,
          fov: bookmark.fov,
          zoom: bookmark.zoom,
        })),
      )
      setErrorKey(null)
    } catch (error) {
      setErrorKey(importErrorKey(error))
    }
  }

  return (
    <CollapsiblePanel panelKey="camera" className="panel--camera" title={t('panels.camera.title')}>
      
      <label htmlFor="camera-fov" className="camera-panel__field">
        {t('panels.camera.fov')}
        <input
          id="camera-fov"
          type="number"
          min={10}
          max={120}
          step={1}
          value={fovDraft}
          onChange={handleFovInput}
          onBlur={commitFov}
        />
      </label>

      <fieldset aria-label={t('panels.camera.presets')}>
        <legend>{t('panels.camera.presets')}</legend>
        <div className="camera-panel__presets">
          {ORTHO_PRESET_NAMES.map((preset) => (
            <button key={preset} type="button" onClick={() => applyPreset(preset)}>
              {t(PRESET_LABEL_KEYS[preset])}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="camera-panel__back-to-perspective"
          disabled={projection === 'perspective'}
          onClick={requestPerspective}
        >
          {t('panels.camera.backToPerspective')}
        </button>
      </fieldset>

      <fieldset aria-label={t('panels.camera.bookmarks')}>
        <legend>{t('panels.camera.bookmarks')}</legend>

        {cameraBookmarks.length === 0 ? (
          <p className="panel__empty">{t('panels.camera.bookmarksEmpty')}</p>
        ) : (
          <ul className="camera-panel__bookmark-list">
            {cameraBookmarks.map((bookmark) => (
              <li key={bookmark.id} className="camera-panel__bookmark-row">
                <span className="camera-panel__bookmark-name">{bookmark.name}</span>
                <button
                  type="button"
                  aria-label={t('panels.camera.applyBookmark')}
                  title={t('panels.camera.applyBookmark')}
                  onClick={() => applyBookmark(bookmark.id)}
                >
                  &#8594;
                </button>
                <button
                  type="button"
                  aria-label={t('panels.camera.removeBookmark')}
                  title={t('panels.camera.removeBookmark')}
                  onClick={() => removeCameraBookmark(bookmark.id)}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}

        {isNamingBookmark ? (
          <form className="camera-panel__save-form" onSubmit={confirmSaveBookmark}>
            <label htmlFor="camera-bookmark-name" className="camera-panel__field">
              {t('panels.camera.bookmarkNameLabel')}
              <input
                id="camera-bookmark-name"
                type="text"
                value={bookmarkNameDraft}
                onChange={(event) => setBookmarkNameDraft(event.target.value)}
                autoFocus
              />
            </label>
            <div className="camera-panel__save-form-actions">
              <button type="submit">{t('panels.camera.confirmSave')}</button>
              <button type="button" onClick={cancelNamingBookmark}>
                {t('panels.camera.cancelSave')}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="camera-panel__save" onClick={startNamingBookmark}>
            {t('panels.camera.saveCurrent')}
          </button>
        )}

        <div className="camera-panel__bookmark-file-actions">
          <button type="button" onClick={() => void handleExportBookmarks()}>
            {t('panels.camera.exportBookmarks')}
          </button>
          <button type="button" onClick={() => void handleImportBookmarks()}>
            {t('panels.camera.importBookmarks')}
          </button>
        </div>

        {errorKey && (
          <p role="alert" className="panel__error">
            {t(errorKey)}
          </p>
        )}
      </fieldset>
    </CollapsiblePanel>
  )
}

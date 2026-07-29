import { useState, type ChangeEvent, type FocusEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SNAPSHOT_RESOLUTION_PRESETS } from '../snapshot/constants'
import { isFileSystemAccessAvailable } from '../persistence/fileIO'
import { useSnapshotCaptureStore } from '../store/snapshotCaptureStore'
import { CollapsiblePanel } from './CollapsiblePanel'

const PRESET_LABEL_KEYS: Record<string, string> = {
  hd720: 'panels.snapshots.resolutionHD720',
  fullHD: 'panels.snapshots.resolutionFullHD',
  square: 'panels.snapshots.resolutionSquare',
  fourK: 'panels.snapshots.resolutionFourK',
}

export function SnapshotPanel() {
  const { t } = useTranslation()
  const fileSystemAccessAvailable = isFileSystemAccessAvailable()
  const presetKey = useSnapshotCaptureStore((state) => state.presetKey)
  const width = useSnapshotCaptureStore((state) => state.width)
  const height = useSnapshotCaptureStore((state) => state.height)
  const hideOverlaysOnCapture = useSnapshotCaptureStore((state) => state.hideOverlaysOnCapture)
  const directoryHandle = useSnapshotCaptureStore((state) => state.directoryHandle)
  const lastCapturedFilename = useSnapshotCaptureStore((state) => state.lastCapturedFilename)
  const selectPreset = useSnapshotCaptureStore((state) => state.selectPreset)
  const setWidth = useSnapshotCaptureStore((state) => state.setWidth)
  const setHeight = useSnapshotCaptureStore((state) => state.setHeight)
  const toggleHideOverlays = useSnapshotCaptureStore((state) => state.toggleHideOverlays)
  const setDirectoryHandle = useSnapshotCaptureStore((state) => state.setDirectoryHandle)
  const requestCapture = useSnapshotCaptureStore((state) => state.requestCapture)

  const [widthDraft, setWidthDraft] = useState(() => String(width))
  const [lastSyncedWidth, setLastSyncedWidth] = useState(width)
  if (width !== lastSyncedWidth) {
    setLastSyncedWidth(width)
    setWidthDraft(String(width))
  }

  const [heightDraft, setHeightDraft] = useState(() => String(height))
  const [lastSyncedHeight, setLastSyncedHeight] = useState(height)
  if (height !== lastSyncedHeight) {
    setLastSyncedHeight(height)
    setHeightDraft(String(height))
  }

  const handleResolutionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    selectPreset(event.target.value as typeof presetKey)
  }

  const handleWidthInput = (event: ChangeEvent<HTMLInputElement>) => setWidthDraft(event.target.value)
  const commitWidth = (event: FocusEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isNaN(value)) setWidth(value)
  }

  const handleHeightInput = (event: ChangeEvent<HTMLInputElement>) => setHeightDraft(event.target.value)
  const commitHeight = (event: FocusEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isNaN(value)) setHeight(value)
  }

  const handleChooseDirectory = async () => {
    if (!window.showDirectoryPicker) return
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    setDirectoryHandle(handle)
  }

  return (
    <CollapsiblePanel panelKey="snapshots" className="panel--snapshots" title={t('panels.snapshots.title')}>
      
      <label htmlFor="snapshot-resolution" className="snapshot-panel__field">
        {t('panels.snapshots.resolution')}
        <select id="snapshot-resolution" value={presetKey} onChange={handleResolutionChange}>
          {SNAPSHOT_RESOLUTION_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {t(PRESET_LABEL_KEYS[preset.key])}
            </option>
          ))}
          <option value="custom">{t('panels.snapshots.resolutionCustom')}</option>
        </select>
      </label>

      {presetKey === 'custom' && (
        <div className="snapshot-panel__custom-resolution">
          <label htmlFor="snapshot-width" className="snapshot-panel__field">
            {t('panels.snapshots.width')}
            <input
              id="snapshot-width"
              type="number"
              value={widthDraft}
              onChange={handleWidthInput}
              onBlur={commitWidth}
            />
          </label>
          <label htmlFor="snapshot-height" className="snapshot-panel__field">
            {t('panels.snapshots.height')}
            <input
              id="snapshot-height"
              type="number"
              value={heightDraft}
              onChange={handleHeightInput}
              onBlur={commitHeight}
            />
          </label>
        </div>
      )}

      <label className="snapshot-panel__field snapshot-panel__field--checkbox">
        <input type="checkbox" checked={hideOverlaysOnCapture} onChange={toggleHideOverlays} />
        {t('panels.snapshots.hideOverlays')}
      </label>

      <div className="snapshot-panel__directory">
        {fileSystemAccessAvailable && (
          <button type="button" onClick={() => void handleChooseDirectory()}>
            {t('panels.snapshots.chooseDirectory')}
          </button>
        )}
        <p className="snapshot-panel__hint">
          {!fileSystemAccessAvailable
            ? t('panels.snapshots.directoryUnavailable')
            : directoryHandle
              ? t('panels.snapshots.directoryChosen', { name: directoryHandle.name })
              : t('panels.snapshots.directoryNotChosen')}
        </p>
      </div>

      <button type="button" className="snapshot-panel__capture" onClick={requestCapture}>
        {t('panels.snapshots.capture')}
      </button>

      {lastCapturedFilename && (
        <p className="snapshot-panel__last-captured">
          {t('panels.snapshots.lastCaptured', { filename: lastCapturedFilename })}
        </p>
      )}
    </CollapsiblePanel>
  )
}

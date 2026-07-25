import { useState, type ChangeEvent, type FocusEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { KEYFRAME_RESOLUTION_PRESETS } from '../keyframe/constants'
import { isFileSystemAccessAvailable } from '../persistence/fileIO'
import { useKeyframeCaptureStore } from '../store/keyframeCaptureStore'
import { CollapsiblePanel } from './CollapsiblePanel'

const PRESET_LABEL_KEYS: Record<string, string> = {
  fullHD: 'panels.keyframes.resolutionFullHD',
  square: 'panels.keyframes.resolutionSquare',
  fourK: 'panels.keyframes.resolutionFourK',
}

export function KeyframePanel() {
  const { t } = useTranslation()
  const fileSystemAccessAvailable = isFileSystemAccessAvailable()
  const presetKey = useKeyframeCaptureStore((state) => state.presetKey)
  const width = useKeyframeCaptureStore((state) => state.width)
  const height = useKeyframeCaptureStore((state) => state.height)
  const hideOverlaysOnCapture = useKeyframeCaptureStore((state) => state.hideOverlaysOnCapture)
  const directoryHandle = useKeyframeCaptureStore((state) => state.directoryHandle)
  const lastCapturedFilename = useKeyframeCaptureStore((state) => state.lastCapturedFilename)
  const selectPreset = useKeyframeCaptureStore((state) => state.selectPreset)
  const setWidth = useKeyframeCaptureStore((state) => state.setWidth)
  const setHeight = useKeyframeCaptureStore((state) => state.setHeight)
  const toggleHideOverlays = useKeyframeCaptureStore((state) => state.toggleHideOverlays)
  const setDirectoryHandle = useKeyframeCaptureStore((state) => state.setDirectoryHandle)
  const requestCapture = useKeyframeCaptureStore((state) => state.requestCapture)

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
    <CollapsiblePanel panelKey="keyframes" className="panel--keyframes" title={t('panels.keyframes.title')}>
      
      <label htmlFor="keyframe-resolution" className="keyframe-panel__field">
        {t('panels.keyframes.resolution')}
        <select id="keyframe-resolution" value={presetKey} onChange={handleResolutionChange}>
          {KEYFRAME_RESOLUTION_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {t(PRESET_LABEL_KEYS[preset.key])}
            </option>
          ))}
          <option value="custom">{t('panels.keyframes.resolutionCustom')}</option>
        </select>
      </label>

      {presetKey === 'custom' && (
        <div className="keyframe-panel__custom-resolution">
          <label htmlFor="keyframe-width" className="keyframe-panel__field">
            {t('panels.keyframes.width')}
            <input
              id="keyframe-width"
              type="number"
              value={widthDraft}
              onChange={handleWidthInput}
              onBlur={commitWidth}
            />
          </label>
          <label htmlFor="keyframe-height" className="keyframe-panel__field">
            {t('panels.keyframes.height')}
            <input
              id="keyframe-height"
              type="number"
              value={heightDraft}
              onChange={handleHeightInput}
              onBlur={commitHeight}
            />
          </label>
        </div>
      )}

      <label className="keyframe-panel__field keyframe-panel__field--checkbox">
        <input type="checkbox" checked={hideOverlaysOnCapture} onChange={toggleHideOverlays} />
        {t('panels.keyframes.hideOverlays')}
      </label>

      <div className="keyframe-panel__directory">
        {fileSystemAccessAvailable && (
          <button type="button" onClick={() => void handleChooseDirectory()}>
            {t('panels.keyframes.chooseDirectory')}
          </button>
        )}
        <p className="keyframe-panel__hint">
          {!fileSystemAccessAvailable
            ? t('panels.keyframes.directoryUnavailable')
            : directoryHandle
              ? t('panels.keyframes.directoryChosen', { name: directoryHandle.name })
              : t('panels.keyframes.directoryNotChosen')}
        </p>
      </div>

      <button type="button" className="keyframe-panel__capture" onClick={requestCapture}>
        {t('panels.keyframes.capture')}
      </button>

      {lastCapturedFilename && (
        <p className="keyframe-panel__last-captured">
          {t('panels.keyframes.lastCaptured', { filename: lastCapturedFilename })}
        </p>
      )}
    </CollapsiblePanel>
  )
}

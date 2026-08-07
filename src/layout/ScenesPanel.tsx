import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { slugifySceneName } from '../snapshot/snapshotNaming'
import { POSES_AUTOSAVE_KEY, loadWorkspaceFromLocalStorage } from '../persistence/autosave'
import { withExportTimestamp } from '../persistence/exportTimestamp'
import { isFileSystemAccessAvailable, pickFile, pickMultipleFiles, writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { parseSceneFile, serializeSceneFile } from '../persistence/sceneFile'
import { loadWorkspaceFromDirectory, loadWorkspaceFromFiles, saveWorkspaceToDirectory } from '../persistence/workspaceFolder'
import { GROUND_MODES, type GroundMode } from '../scene/depthMap'
import {
  LIGHT_AZIMUTH_RANGE,
  LIGHT_ELEVATION_RANGE,
  LIGHT_INTENSITY_RANGE,
} from '../scene/sceneLight'
import { useAnimationStore } from '../store/animationStore'
import { useDepthStore } from '../store/depthStore'
import { useFiguresStore } from '../store/figuresStore'
import { UNDO_BATCH_POINTER_PROPS } from '../store/undoBatch'
import { importErrorKey } from './fileFeedback'
import { CollapsiblePanel } from './CollapsiblePanel'
import { CollapsibleSection } from './CollapsibleSection'
import { ConfirmDialog } from './ConfirmDialog'
import { SessionQrSendDialog } from './SessionQrSendDialog'

/**
 * Painel do "workspace": catálogo de snapshots de cena (salvar/carregar/
 * remover) + exportar/importar a cena de trabalho atual como `.json` — ver
 * PLANO.md > "Workspace: catálogo de cenas", DECISOES.md #11 e #85 (a troca
 * do `.glb` por JSON).
 */
/** Rótulo de cada modo do chão no mapa de profundidade — chave de i18n, nunca texto. */
const GROUND_MODE_LABELS: Record<GroundMode, string> = {
  clipped: 'panels.scenes.depthGroundClipped',
  hidden: 'panels.scenes.depthGroundHidden',
  full: 'panels.scenes.depthGroundFull',
}

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
  const setLight = useFiguresStore((state) => state.setLight)
  const resetLight = useFiguresStore((state) => state.resetLight)
  const saveSceneSnapshot = useFiguresStore((state) => state.saveSceneSnapshot)
  const loadSceneSnapshot = useFiguresStore((state) => state.loadSceneSnapshot)
  const removeSceneSnapshot = useFiguresStore((state) => state.removeSceneSnapshot)
  const moveSceneSnapshot = useFiguresStore((state) => state.moveSceneSnapshot)
  const loadSceneWorkingState = useFiguresStore((state) => state.loadSceneWorkingState)
  const loadWorkspaceCatalog = useFiguresStore((state) => state.loadWorkspaceCatalog)
  const poseLibrary = useFiguresStore((state) => state.poseLibrary)
  const animations = useFiguresStore((state) => state.animations)
  const clipLibrary = useFiguresStore((state) => state.clipLibrary)
  const jointLimits = useFiguresStore((state) => state.jointLimits)
  const resetJointLimits = useFiguresStore((state) => state.resetJointLimits)
  const resetWorkspace = useFiguresStore((state) => state.resetWorkspace)
  const loadRestoredWorkspace = useFiguresStore((state) => state.loadRestoredWorkspace)

  const [isNaming, setIsNaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [workspaceDirectoryHandle, setWorkspaceDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  /** Chave i18n do último erro de importação (fase 9, item 4); `null` quando não há erro. */
  const [errorKey, setErrorKey] = useState<string | null>(null)
  /** Confirmação em dois passos do "novo workspace" (fase 9, item 7) — ação destrutiva que o Ctrl+Z não desfaz. */
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)
  /** Confirmação em dois passos do "trazer sessão do módulo" (item 54) — substitui o workspace inteiro. */
  const [isConfirmingBring, setIsConfirmingBring] = useState(false)
  /** Envio da sessão por QR code (item 65) — o modal com a sequência de quadros. */
  const [isSendingQr, setIsSendingQr] = useState(false)
  const fileSystemAccessAvailable = isFileSystemAccessAvailable()

  // Faixa do mapa de profundidade (fase 13) — ver a seção "Configurações" lá
  // embaixo. Os campos comitam no `blur`, como os numéricos do instantâneo:
  // grampear a cada tecla impediria de apagar o campo para digitar outro valor.
  const depthAutoRange = useDepthStore((state) => state.autoRange)
  const depthNear = useDepthStore((state) => state.nearM)
  const depthFar = useDepthStore((state) => state.farM)
  const toggleDepthAutoRange = useDepthStore((state) => state.toggleAutoRange)
  const setDepthNear = useDepthStore((state) => state.setNearM)
  const setDepthFar = useDepthStore((state) => state.setFarM)
  const groundMode = useDepthStore((state) => state.groundMode)
  const setGroundMode = useDepthStore((state) => state.setGroundMode)

  const [nearDraft, setNearDraft] = useState(() => String(depthNear))
  const [lastNear, setLastNear] = useState(depthNear)
  if (depthNear !== lastNear) {
    setLastNear(depthNear)
    setNearDraft(String(depthNear))
  }

  const [farDraft, setFarDraft] = useState(() => String(depthFar))
  const [lastFar, setLastFar] = useState(depthFar)
  if (depthFar !== lastFar) {
    setLastFar(depthFar)
    setFarDraft(String(depthFar))
  }

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

  // Trazer a sessão do módulo de poses (item 54): a leitura passa pela MESMA
  // sanitização do autosave (`loadWorkspaceFromLocalStorage`), e a linha do
  // tempo é resetada — o keyframe visitado pertencia à sessão que saiu.
  const handleBringPosesSession = () => {
    setIsConfirmingBring(false)
    const restored = loadWorkspaceFromLocalStorage(POSES_AUTOSAVE_KEY)
    if (!restored) {
      setErrorKey('panels.scenes.bringPosesSessionMissing')
      return
    }
    loadRestoredWorkspace(restored)
    useAnimationStore.getState().resetTimeline()
    setErrorKey(null)
  }

  const handleExport = async () => {
    const json = serializeSceneFile({
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
    const filename = withExportTimestamp(`${slugifySceneName(sceneName)}.json`)
    await writeFileToDirectoryOrDownload(null, filename, new Blob([json], { type: 'application/json' }))
  }

  const handleImport = async () => {
    const picked = await pickFile('.json')
    if (!picked) return
    try {
      loadSceneWorkingState(parseSceneFile(await picked.file.text()))
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

      const files = await pickMultipleFiles('.json')
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
          {scenes.map((scene, index) => (
            <li key={scene.id} className="scenes-panel__row">
              <span className="scenes-panel__name">
                {scene.name}
                {scene.id === activeSceneId && (
                  <span className="scenes-panel__active-badge">{t('panels.scenes.active')}</span>
                )}
              </span>
              {/* Reordenar (item 19): a ordem era fixa pela criação. Nas
                  bordas o botão desabilita — mesma linguagem dos keyframes. */}
              <button
                type="button"
                aria-label={t('panels.scenes.moveUp')}
                title={t('panels.scenes.moveUp')}
                disabled={index === 0}
                onClick={() => moveSceneSnapshot(scene.id, -1)}
              >
                &#8593;
              </button>
              <button
                type="button"
                aria-label={t('panels.scenes.moveDown')}
                title={t('panels.scenes.moveDown')}
                disabled={index === scenes.length - 1}
                onClick={() => moveSceneSnapshot(scene.id, 1)}
              >
                &#8595;
              </button>
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
          <div className="panel-actions scenes-panel__save-form-actions">
            <button type="submit">{t('panels.scenes.confirmSave')}</button>
            <button type="button" onClick={cancelNaming}>
              {t('panels.scenes.cancelSave')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="panel-action scenes-panel__save" onClick={startNaming}>
          {t('panels.scenes.saveCurrent')}
        </button>
      )}

      {errorKey && (
        <p role="alert" className="panel__error">
          {t(errorKey)}
        </p>
      )}

      <div className="scenes-panel__file-actions">
        <button type="button" className="panel-action" onClick={() => void handleExport()}>
          {t('panels.scenes.exportScene')}
        </button>
        <button type="button" className="panel-action" onClick={() => void handleImport()}>
          {t('panels.scenes.importScene')}
        </button>

        {fileSystemAccessAvailable && (
          <button type="button" className="panel-action" onClick={() => void handleSaveWorkspaceToFolder()}>
            {t('panels.scenes.saveWorkspaceToFolder')}
          </button>
        )}
        <button type="button" className="panel-action" onClick={() => void handleOpenWorkspaceFromFolder()}>
          {t('panels.scenes.openWorkspaceFromFolder')}
        </button>
        <p className="scenes-panel__hint">
          {!fileSystemAccessAvailable
            ? t('panels.scenes.workspaceFolderUnavailable')
            : workspaceDirectoryHandle && t('panels.scenes.workspaceFolderChosen', { name: workspaceDirectoryHandle.name })}
        </p>

        {/* Novo workspace (fase 9, item 7): limpa TUDO — bonecos, catálogo de
            cenas, bookmarks, ambiente e limites — e zera o histórico de undo.
            Por isso a confirmação em MODAL, a mesma da troca de sessão (#100). */}
        <button type="button" className="panel-action" onClick={() => setIsConfirmingReset(true)}>
          {t('panels.scenes.newWorkspace')}
        </button>
        {isConfirmingReset && (
          <ConfirmDialog
            title={t('panels.scenes.newWorkspace')}
            message={t('panels.scenes.newWorkspaceConfirm')}
            confirmLabel={t('panels.scenes.newWorkspaceConfirmYes')}
            onConfirm={() => {
              resetWorkspace()
              setIsConfirmingReset(false)
              setErrorKey(null)
            }}
            onCancel={() => setIsConfirmingReset(false)}
          />
        )}

        {/* Trazer a sessão do módulo de poses (item 54): as sessões são
            separadas por chave (#92); este botão completa o desenho para quem
            começa no celular e continua aqui. Substitui o workspace INTEIRO —
            por isso a confirmação em MODAL (`ConfirmDialog`, pedido do
            usuário): o aviso vira a única coisa na tela. */}
        <button
          type="button"
          className="panel-action"
          onClick={() => {
            setIsConfirmingBring(true)
            setErrorKey(null)
          }}
        >
          {t('panels.scenes.bringPosesSession')}
        </button>
        {isConfirmingBring && (
          <ConfirmDialog
            title={t('panels.scenes.bringPosesSession')}
            message={t('panels.scenes.bringPosesSessionConfirm')}
            confirmLabel={t('panels.scenes.bringPosesSessionConfirmYes')}
            onConfirm={handleBringPosesSession}
            onCancel={() => setIsConfirmingBring(false)}
          />
        )}

        {/* Enviar a sessão por QR code (item 65): a ponte para um APARELHO
            diferente, onde as chaves de localStorage não alcançam — a sessão
            vira uma sequência de QRs e o celular coleta com a câmera. */}
        <button type="button" className="panel-action" onClick={() => setIsSendingQr(true)}>
          {t('panels.scenes.sendQr')}
        </button>
        {isSendingQr && <SessionQrSendDialog onClose={() => setIsSendingQr(false)} />}

        {/* Configurações do workspace (fase 13). A faixa do mapa de
            profundidade é COMPARTILHADA pelas três saídas — tela, PNG e MP4 —,
            então não podia morar dentro de nenhuma delas; aqui ela fica ao lado
            das outras opções que valem para o ambiente inteiro. Nasce recolhida,
            pela regra do #83. */}
        <CollapsibleSection sectionKey="sceneSettings" title={t('panels.scenes.settings')}>
          <fieldset className="scenes-panel__settings">
            <legend>{t('panels.scenes.depthRange')}</legend>

            <label className="scenes-panel__field scenes-panel__field--checkbox">
              <input type="checkbox" checked={depthAutoRange} onChange={toggleDepthAutoRange} />
              {t('panels.scenes.depthAutoRange')}
            </label>

            {/* Desabilitados com a faixa automática em vigor, e não escondidos:
                os números continuam à vista como o ponto de partida do ajuste. */}
            <div className="scenes-panel__depth-range">
              <label htmlFor="depth-near" className="scenes-panel__field">
                {t('panels.scenes.depthNear')}
                <input
                  id="depth-near"
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={depthAutoRange}
                  value={nearDraft}
                  onChange={(event) => setNearDraft(event.target.value)}
                  onBlur={(event) => setDepthNear(Number(event.target.value))}
                />
              </label>
              <label htmlFor="depth-far" className="scenes-panel__field">
                {t('panels.scenes.depthFar')}
                <input
                  id="depth-far"
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={depthAutoRange}
                  value={farDraft}
                  onChange={(event) => setFarDraft(event.target.value)}
                  onBlur={(event) => setDepthFar(Number(event.target.value))}
                />
              </label>
            </div>

            <p className="scenes-panel__hint">{t('panels.scenes.depthRangeHint')}</p>

            {/* O chão fica FORA da conta da faixa (senão espremeria o boneco),
                e por isso o que está em primeiro plano cai fora dela: grampeado,
                vira uma cunha branca chapada disputando o branco com a
                superfície mais próxima do boneco. O recorte pela faixa é o
                padrão; os outros dois valores ficam à mão. */}
            <label htmlFor="depth-ground" className="scenes-panel__field" title={t('panels.scenes.depthGroundHint')}>
              {t('panels.scenes.depthGround')}
              <select
                id="depth-ground"
                value={groundMode}
                onChange={(event) => setGroundMode(event.target.value as GroundMode)}
              >
                {GROUND_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {t(GROUND_MODE_LABELS[mode])}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          {/* A luz da cena (item 16). Aqui, e não na Toolbar com a régua e a
              silhueta, porque não é preferência de tela: de onde a sombra cai
              é decisão de desenho, entra no undo e viaja no arquivo da cena.
              Ângulos, nunca coordenadas — girar a luz em torno do assunto é o
              gesto real; três campos X/Y/Z exigiriam pensar em vetores. */}
          <fieldset className="scenes-panel__settings">
            <legend>{t('panels.scenes.light')}</legend>

            <label htmlFor="light-azimuth" className="scenes-panel__field">
              {t('panels.scenes.lightAzimuth', { value: Math.round(environment.lightAzimuth) })}
              <input
                id="light-azimuth"
                type="range"
                min={LIGHT_AZIMUTH_RANGE.min}
                max={LIGHT_AZIMUTH_RANGE.max}
                step={1}
                value={environment.lightAzimuth}
                onChange={(event) => setLight({ lightAzimuth: Number(event.target.value) })}
                {...UNDO_BATCH_POINTER_PROPS}
              />
            </label>

            <label htmlFor="light-elevation" className="scenes-panel__field">
              {t('panels.scenes.lightElevation', { value: Math.round(environment.lightElevation) })}
              <input
                id="light-elevation"
                type="range"
                min={LIGHT_ELEVATION_RANGE.min}
                max={LIGHT_ELEVATION_RANGE.max}
                step={1}
                value={environment.lightElevation}
                onChange={(event) => setLight({ lightElevation: Number(event.target.value) })}
                {...UNDO_BATCH_POINTER_PROPS}
              />
            </label>

            <label htmlFor="light-intensity" className="scenes-panel__field">
              {t('panels.scenes.lightIntensity', { value: environment.lightIntensity.toFixed(1) })}
              <input
                id="light-intensity"
                type="range"
                min={LIGHT_INTENSITY_RANGE.min}
                max={LIGHT_INTENSITY_RANGE.max}
                step={0.1}
                value={environment.lightIntensity}
                onChange={(event) => setLight({ lightIntensity: Number(event.target.value) })}
                {...UNDO_BATCH_POINTER_PROPS}
              />
            </label>

            <p className="scenes-panel__hint">{t('panels.scenes.lightHint')}</p>

            <button type="button" className="panel-action" onClick={resetLight}>
              {t('panels.scenes.lightReset')}
            </button>
          </fieldset>
        </CollapsibleSection>

        {/* Limites articulares customizados pelo workspace (ver DECISOES.md #29):
            só aparece quando há customização em vigor — sem editor na UI, a
            edição é no próprio `joint-limits.json` da pasta. */}
        {customJointLimitCount > 0 && (
          <>
            <p className="scenes-panel__hint">
              {t('panels.scenes.customJointLimits', { count: customJointLimitCount })}
            </p>
            <button type="button" className="panel-action" onClick={resetJointLimits}>
              {t('panels.scenes.resetJointLimits')}
            </button>
          </>
        )}
      </div>
    </CollapsiblePanel>
  )
}

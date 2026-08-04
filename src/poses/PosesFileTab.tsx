import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { findWorkingAnimation } from '../animation/animation'
import {
  parseImportedAnimation,
  serializeAnimationFile,
} from '../persistence/animationsFile'
import {
  WORKSPACE_AUTOSAVE_KEY,
  loadWorkspaceFromLocalStorage,
} from '../persistence/autosave'
import { ConfirmDialog } from '../layout/ConfirmDialog'
import { PosesQrReceiveDialog } from './PosesQrReceiveDialog'
import { pickFile, writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { parseFigurePoseFile } from '../persistence/figurePoseFile'
import { slugifySceneName } from '../snapshot/snapshotNaming'
import { useFiguresStore, type AnimationImportMode } from '../store/figuresStore'
import { usePosesShellStore } from '../store/posesShellStore'

/**
 * Aba "Arquivo": a ponte com a aplicação completa é o MESMO JSON de animação
 * da fase 12 (`animationsFile.ts`) — nada de formato novo. Abre um arquivo
 * vindo do desktop (substituindo ou anexando à linha do tempo de trabalho) e
 * exporta/compartilha o resultado. O Web Share é o "salvar na pasta" do
 * celular: a File System Access API não existe no iOS (PLANO.md, item 44).
 */
export function PosesFileTab() {
  const { t } = useTranslation()
  const animations = useFiguresStore((state) => state.animations)
  const importAnimation = useFiguresStore((state) => state.importAnimation)
  const loadRestoredWorkspace = useFiguresStore((state) => state.loadRestoredWorkspace)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const applyImportedFigurePose = useFiguresStore((state) => state.applyImportedFigurePose)
  const setCurrentKeyframeId = usePosesShellStore((state) => state.setCurrentKeyframeId)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  /** Confirmação em dois passos do "trazer sessão do desktop" (item 54) — substitui a sessão inteira. */
  const [isConfirmingBring, setIsConfirmingBring] = useState(false)
  /** Recepção da sessão por QR code (item 65) — o modal com a câmera. */
  const [isReceivingQr, setIsReceivingQr] = useState(false)

  const working = findWorkingAnimation(animations)
  const hasKeyframes = (working?.keyframes.length ?? 0) > 0
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const animationJsonBlob = () => {
    if (!working) return null
    return new Blob([serializeAnimationFile(working)], { type: 'application/json' })
  }

  const exportFilename = () => `${slugifySceneName(working?.name ?? 'animacao')}.json`

  const handleExport = async () => {
    setErrorKey(null)
    const blob = animationJsonBlob()
    if (!blob) return
    await writeFileToDirectoryOrDownload(null, exportFilename(), blob)
  }

  const handleShare = async () => {
    setErrorKey(null)
    const blob = animationJsonBlob()
    if (!blob) return
    const file = new File([blob], exportFilename(), { type: 'application/json' })
    try {
      await navigator.share({ files: [file] })
    } catch {
      // Cancelar o diálogo de compartilhar não é erro; falha real cai no download.
    }
  }

  const handleImport = async (mode: AnimationImportMode) => {
    setErrorKey(null)
    const picked = await pickFile('.json,application/json')
    if (!picked) return
    let parsed: unknown
    try {
      parsed = JSON.parse(new TextDecoder().decode(picked.data))
    } catch {
      setErrorKey('poses.file.importError')
      return
    }
    const imported = parseImportedAnimation(parsed)
    if (!imported) {
      setErrorKey('poses.file.importError')
      return
    }
    // Sem remapeamento de elenco: os keyframes entram literais (modo fiel a
    // nomes, cores e alturas do arquivo) — remapear é assunto do desktop.
    const ok = importAnimation(imported, { mode })
    if (!ok) setErrorKey('poses.file.importError')
    else setCurrentKeyframeId(null)
  }

  // Aplicar pose avulsa (item 55): o leitor é o MESMO do "Pose em arquivo" do
  // desktop (`parseFigurePoseFile`, #81/#87), que aceita a família inteira de
  // formatos — arquivo de pose, boneco cru, keyframe, animação, animations.json.
  // Aplica ao boneco em edição pelas regras de sempre: X/Z preservados, juntas
  // travadas intactas, ângulos grampeados.
  const handleApplyPoseFile = async () => {
    setErrorKey(null)
    if (!selectedFigureId) return
    const picked = await pickFile('.json,application/json')
    if (!picked) return
    try {
      const imported = parseFigurePoseFile(JSON.parse(new TextDecoder().decode(picked.data)))
      if (!imported) {
        setErrorKey('errors.importNoPose')
        return
      }
      applyImportedFigurePose(selectedFigureId, imported)
    } catch {
      setErrorKey('errors.importUnreadableJson')
    }
  }

  // Trazer a sessão do desktop (item 54): a outra ponte com a aplicação
  // completa — sem arquivo, direto da chave de autosave dela (#92). A leitura
  // passa pela mesma sanitização do autosave, e o keyframe corrente é zerado:
  // ele pertencia à sessão que saiu da tela.
  const handleBringDesktopSession = () => {
    setIsConfirmingBring(false)
    const restored = loadWorkspaceFromLocalStorage(WORKSPACE_AUTOSAVE_KEY)
    if (!restored) {
      setErrorKey('poses.file.bringSessionMissing')
      return
    }
    loadRestoredWorkspace(restored)
    setCurrentKeyframeId(null)
    setErrorKey(null)
  }

  return (
    <div className="poses-tab">
      <p className="poses-tab__hint">{t('poses.file.hint')}</p>
      <div className="panel-actions">
        <button type="button" onClick={() => void handleImport('replace')}>
          {t('poses.file.importReplace')}
        </button>
        <button type="button" onClick={() => void handleImport('append')}>
          {t('poses.file.importAppend')}
        </button>
        <button type="button" disabled={!hasKeyframes} onClick={() => void handleExport()}>
          {t('poses.file.export')}
        </button>
        <button
          type="button"
          disabled={!hasKeyframes || !canShare}
          onClick={() => void handleShare()}
        >
          {t('poses.file.share')}
        </button>
      </div>
      {/* Aplicar pose avulsa ao boneco em edição (item 55). Botão sozinho =
          `.panel-action` (#88); desabilitado sem boneco em edição, porque a
          pose precisa de um destino. */}
      <button
        type="button"
        className="panel-action"
        disabled={!selectedFigureId}
        title={t('poses.file.applyPoseHint')}
        onClick={() => void handleApplyPoseFile()}
      >
        {t('poses.file.applyPose')}
      </button>

      {/* Trazer a sessão do desktop (item 54): substitui a sessão INTEIRA do
          módulo — por isso a confirmação em MODAL (`ConfirmDialog`, o mesmo
          do desktop). Botão sozinho = `.panel-action` (#88). */}
      <button
        type="button"
        className="panel-action"
        onClick={() => {
          setIsConfirmingBring(true)
          setErrorKey(null)
        }}
      >
        {t('poses.file.bringSession')}
      </button>
      {isConfirmingBring && (
        <ConfirmDialog
          title={t('poses.file.bringSession')}
          message={t('poses.file.bringSessionConfirm')}
          confirmLabel={t('poses.file.bringSessionConfirmYes')}
          onConfirm={handleBringDesktopSession}
          onCancel={() => setIsConfirmingBring(false)}
        />
      )}
      {/* Receber a sessão por QR code (item 65): a ponte com um desktop que é
          OUTRO aparelho — a câmera coleta os quadros que ele exibe. A
          confirmação de substituir acontece dentro do próprio modal (#100). */}
      <button
        type="button"
        className="panel-action"
        onClick={() => {
          setIsReceivingQr(true)
          setErrorKey(null)
        }}
      >
        {t('poses.file.receiveQr')}
      </button>
      {isReceivingQr && (
        <PosesQrReceiveDialog
          onRestore={(restored) => {
            loadRestoredWorkspace(restored)
            setCurrentKeyframeId(null)
            setIsReceivingQr(false)
            setErrorKey(null)
          }}
          onCancel={() => setIsReceivingQr(false)}
        />
      )}
      {errorKey && (
        <p className="poses-tab__error" role="alert">
          {t(errorKey)}
        </p>
      )}
    </div>
  )
}

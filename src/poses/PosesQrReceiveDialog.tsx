import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModalDialog } from '../layout/ModalDialog'
import { parseWorkspacePayload, type RestoredWorkspace } from '../persistence/autosave'
import { createQrChunkCollector } from '../persistence/qrTransfer'
import { createQrFrameReader } from './qrFrameReader'

/**
 * Recepção da sessão por QR code (item 65, DECISOES.md #101): a câmera do
 * celular aponta para a tela do desktop e coleta as fatias em qualquer ordem
 * até completar. A confirmação de substituir a sessão acontece DENTRO do mesmo
 * modal (#100), depois da coleta — e o payload só é interpretado
 * (`parseWorkspacePayload`, que instala limites articulares) DEPOIS do "sim",
 * na mesma ordem do "Trazer sessão do desktop".
 */

/** Cadência da varredura: ~4 leituras/s alcança o ciclo de quadros do desktop sem fritar o celular. */
const SCAN_INTERVAL_MS = 250

type Phase = 'starting' | 'scanning' | 'cameraError' | 'corrupt' | 'confirm'

interface PosesQrReceiveDialogProps {
  /** Chamada com a sessão já sanitizada, DEPOIS do usuário confirmar a substituição. */
  onRestore: (restored: RestoredWorkspace) => void
  onCancel: () => void
}

export function PosesQrReceiveDialog({ onRestore, onCancel }: PosesQrReceiveDialogProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [progress, setProgress] = useState<{ received: number; total: number | null }>({
    received: 0,
    total: null,
  })
  /** O JSON remontado, guardado até o usuário confirmar. */
  const jsonRef = useRef<string | null>(null)

  useEffect(() => {
    let disposed = false
    let stream: MediaStream | null = null
    let timer: number | null = null
    // `busy` impede leituras sobrepostas: a decodificação de um quadro pode
    // demorar mais que o intervalo da varredura.
    let busy = false
    const collector = createQrChunkCollector()

    const stopAll = () => {
      if (timer !== null) window.clearInterval(timer)
      timer = null
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
    }

    const scanOnce = async (read: ReturnType<typeof createQrFrameReader>) => {
      const video = videoRef.current
      if (!video || busy) return
      busy = true
      try {
        const text = await read(video)
        if (disposed || text === null) return
        const result = collector.accept(text)
        if (result.kind === 'invalid' || result.kind === 'foreign') return
        setProgress({ received: result.received, total: result.total })
        if (!result.complete) return
        stopAll()
        const json = await collector.assemble()
        if (disposed) return
        if (json === null) {
          setPhase('corrupt')
        } else {
          jsonRef.current = json
          setPhase('confirm')
        }
      } finally {
        busy = false
      }
    }

    const start = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setPhase('cameraError')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
      } catch {
        if (!disposed) setPhase('cameraError')
        return
      }
      const video = videoRef.current
      if (disposed || !video) {
        stopAll()
        return
      }
      video.srcObject = stream
      await video.play().catch(() => {
        // Autoplay recusado não trava a coleta: o vídeo segue mudo e inline.
      })
      if (disposed) return
      setPhase('scanning')
      const read = createQrFrameReader()
      timer = window.setInterval(() => void scanOnce(read), SCAN_INTERVAL_MS)
    }

    void start()
    return () => {
      disposed = true
      stopAll()
    }
  }, [])

  const handleConfirm = () => {
    const json = jsonRef.current
    const restored = json === null ? null : parseWorkspacePayload(json)
    if (restored === null) {
      setPhase('corrupt')
      return
    }
    onRestore(restored)
  }

  return (
    <ModalDialog title={t('poses.file.receiveQr')} className="session-qr" onCancel={onCancel}>
      {(phase === 'starting' || phase === 'scanning') && (
        <>
          <p className="poses-tab__hint">{t('poses.file.receiveQrHint')}</p>
          <video ref={videoRef} className="session-qr__video" muted playsInline autoPlay />
          <p className="session-qr__counter">
            {phase === 'starting'
              ? t('poses.file.receiveQrStarting')
              : progress.total === null
                ? t('poses.file.receiveQrWaiting')
                : t('poses.file.receiveQrProgress', {
                    received: progress.received,
                    total: progress.total,
                  })}
          </p>
        </>
      )}

      {phase === 'cameraError' && (
        <p className="poses-tab__error" role="alert">
          {t('poses.file.receiveQrCameraError')}
        </p>
      )}
      {phase === 'corrupt' && (
        <p className="poses-tab__error" role="alert">
          {t('poses.file.receiveQrCorrupt')}
        </p>
      )}

      {phase === 'confirm' && (
        <p className="animation-panel__hint animation-panel__hint--warning">
          {t('poses.file.receiveQrConfirm')}
        </p>
      )}

      <div className="animation-import__actions">
        {phase === 'confirm' && (
          <button type="button" className="animation-panel__confirm" onClick={handleConfirm}>
            {t('poses.file.bringSessionConfirmYes')}
          </button>
        )}
        <button type="button" onClick={onCancel}>
          {t('panels.animation.updateCancel')}
        </button>
      </div>
    </ModalDialog>
  )
}

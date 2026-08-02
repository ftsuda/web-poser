import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import { serializeWorkspacePayload } from '../persistence/autosave'
import { encodeSessionToQrChunks } from '../persistence/qrTransfer'
import { useFiguresStore } from '../store/figuresStore'
import { ModalDialog } from './ModalDialog'

/**
 * Envio da sessão por QR code (item 65, DECISOES.md #101): o workspace inteiro
 * — o MESMO payload do autosave — comprimido, fatiado e exibido como uma
 * sequência de QR codes em ciclo. O celular coleta com a câmera em qualquer
 * ordem; os quadros se repetem até a coleta completar, então quadro perdido
 * não é problema: ele volta na próxima volta do ciclo.
 *
 * Os QRs nascem como SVG (`qrcode.toString`), não canvas: fica nítido em
 * qualquer zoom e existe no jsdom, onde canvas não há.
 */

/**
 * Tempo de cada quadro na tela. Leitores de câmera varrem vários quadros por
 * segundo; 600 ms dá folga para focar sem arrastar a volta completa do ciclo.
 */
const FRAME_INTERVAL_MS = 600

interface SessionQrSendDialogProps {
  onClose: () => void
}

export function SessionQrSendDialog({ onClose }: SessionQrSendDialogProps) {
  const { t } = useTranslation()
  const [frames, setFrames] = useState<string[] | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)

  // A sessão é fotografada UMA vez, na abertura do diálogo — editar a cena com
  // o modal aberto não muda a remessa em andamento (mudaria o id e invalidaria
  // o que o celular já coletou).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const json = serializeWorkspacePayload(useFiguresStore.getState())
      const chunks = await encodeSessionToQrChunks(json)
      const svgs = await Promise.all(
        chunks.map((chunk) =>
          QRCode.toString(chunk, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 }),
        ),
      )
      if (!cancelled) setFrames(svgs)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!frames || frames.length <= 1) return
    const timer = setInterval(
      () => setFrameIndex((index) => (index + 1) % frames.length),
      FRAME_INTERVAL_MS,
    )
    return () => clearInterval(timer)
  }, [frames])

  return (
    <ModalDialog title={t('panels.scenes.sendQr')} className="session-qr" onCancel={onClose}>
      <p className="poses-tab__hint">{t('panels.scenes.sendQrHint')}</p>

      {frames === null ? (
        <p className="animation-panel__hint">{t('panels.scenes.sendQrPreparing')}</p>
      ) : (
        <>
          {/* SVG vindo do gerador local (`qrcode`), nunca de entrada do usuário. */}
          <div
            className="session-qr__frame"
            dangerouslySetInnerHTML={{ __html: frames[frameIndex] }}
          />
          <p className="session-qr__counter">
            {t('panels.scenes.sendQrFrame', {
              index: frameIndex + 1,
              total: frames.length,
            })}
          </p>
        </>
      )}

      <div className="animation-import__actions">
        <button type="button" onClick={onClose}>
          {t('panels.scenes.sendQrClose')}
        </button>
      </div>
    </ModalDialog>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { ApiError, classroomApi, type Lang, type VoiceAnswerKind } from '../api'

const COPY = {
  ru: {
    start: 'Произнести ответ', stop: 'Остановить запись',
    requesting: 'Запрашиваем доступ к микрофону…', recording: 'Говори. Запись остановится через несколько секунд.',
    processing: 'Распознаём ответ…', ready: 'Ответ записан в поле. Проверь его перед отправкой.',
    denied: 'Микрофон недоступен. Ответ можно ввести вручную.',
    unclear: 'Не удалось разобрать число. Попробуй ещё раз или введи ответ вручную.',
    busy: 'Распознавание занято. Попробуй через несколько секунд.',
    failed: 'Распознавание недоступно. Ответ можно ввести вручную.',
  },
  kk: {
    start: 'Жауапты айту', stop: 'Жазуды тоқтату',
    requesting: 'Микрофонға рұқсат сұрап жатырмыз…', recording: 'Айта бер. Жазу бірнеше секундтан соң тоқтайды.',
    processing: 'Жауапты танып жатырмыз…', ready: 'Жауап өріске енгізілді. Жібермес бұрын тексер.',
    denied: 'Микрофон қолжетімсіз. Жауапты қолмен енгізуге болады.',
    unclear: 'Санды анықтай алмадық. Қайта айт немесе жауабыңды қолмен енгіз.',
    busy: 'Тану қызметі бос емес. Бірнеше секундтан соң қайта көр.',
    failed: 'Дауыс тану қолжетімсіз. Жауапты қолмен енгізуге болады.',
  },
}
const RATE = 16_000
const MAX_SECONDS = 8
type Status = keyof Omit<(typeof COPY)['ru'], 'start' | 'stop'> | 'idle'

async function wav(blob: Blob): Promise<Blob> {
  const decoder = new AudioContext()
  let pcm: AudioBuffer
  try {
    pcm = await decoder.decodeAudioData(await blob.arrayBuffer())
  } finally {
    await decoder.close()
  }
  const frames = Math.max(1, Math.min(RATE * MAX_SECONDS, Math.round(pcm.duration * RATE)))
  const resampler = new OfflineAudioContext(1, frames, RATE)
  const source = resampler.createBufferSource()
  source.buffer = pcm
  source.connect(resampler.destination)
  source.start()
  const samples = (await resampler.startRendering()).getChannelData(0)
  const data = new DataView(new ArrayBuffer(44 + frames * 2))
  for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) {
    for (let i = 0; i < value.length; i++) data.setUint8(offset + i, value.charCodeAt(i))
  }
  data.setUint32(4, data.byteLength - 8, true)
  data.setUint32(16, 16, true)
  data.setUint16(20, 1, true)
  data.setUint16(22, 1, true)
  data.setUint32(24, RATE, true)
  data.setUint32(28, RATE * 2, true)
  data.setUint16(32, 2, true)
  data.setUint16(34, 16, true)
  data.setUint32(40, frames * 2, true)
  for (let i = 0; i < frames; i++) {
    data.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true)
  }
  return new Blob([data.buffer], { type: 'audio/wav' })
}

function closeStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop()
}

export function VoiceAnswer({ lang, kind, inputId, disabled, onAnswer }: {
  lang: Lang; kind: VoiceAnswerKind; inputId: string; disabled: boolean; onAnswer: (answer: string) => void
}) {
  const copy = COPY[lang]
  const id = useId()
  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const active = useRef<MediaRecorder | null>(null)
  const capture = useRef<AbortController | null>(null)
  const timeout = useRef<number | undefined>(undefined)
  const working = status === 'requesting' || status === 'processing'

  useEffect(() => {
    const ctrl = new AbortController()
    if (typeof MediaRecorder !== 'undefined' && typeof AudioContext !== 'undefined' &&
        typeof OfflineAudioContext !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function') {
      classroomApi?.voiceStatus(ctrl.signal).then(({ enabled }) => setEnabled(enabled), () => {})
    }
    return () => ctrl.abort()
  }, [])

  useEffect(() => () => {
    capture.current?.abort()
    window.clearTimeout(timeout.current)
    if (active.current) {
      if (active.current.state !== 'inactive') active.current.stop()
      closeStream(active.current.stream)
      active.current = null
    }
  }, [lang, kind])

  async function toggle() {
    const api = classroomApi
    if (!api || working || disabled) return
    if (active.current) {
      if (active.current.state === 'recording') active.current.stop()
      return
    }
    capture.current?.abort()
    const ctrl = new AbortController()
    capture.current = ctrl
    setStatus('requesting')
    let stream: MediaStream | undefined
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (ctrl.signal.aborted) { closeStream(stream); return }
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      active.current = recorder
      recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data) }
      recorder.onerror = () => {
        window.clearTimeout(timeout.current)
        closeStream(recorder.stream)
        active.current = null
        if (!ctrl.signal.aborted) setStatus('failed')
        ctrl.abort()
      }
      recorder.onstop = async () => {
        window.clearTimeout(timeout.current)
        closeStream(recorder.stream)
        active.current = null
        if (ctrl.signal.aborted) return
        setStatus('processing')
        try {
          const audio = await wav(new Blob(chunks, { type: recorder.mimeType }))
          if (ctrl.signal.aborted) return
          const { answer } = await api.recognizeVoice(lang, kind, audio, ctrl.signal)
          if (ctrl.signal.aborted) return
          onAnswer(answer)
          setStatus('ready')
        } catch (error) {
          if (!ctrl.signal.aborted) {
            const code = error instanceof ApiError ? error.detail : null
            setStatus(code === 'voice_busy' ? 'busy' : code === 'voice_unclear' || code === 'invalid_voice_audio' ? 'unclear' : 'failed')
          }
        }
      }
      recorder.start()
      timeout.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, MAX_SECONDS * 1000)
      setStatus('recording')
    } catch {
      if (stream) closeStream(stream)
      active.current = null
      if (!ctrl.signal.aborted) setStatus('denied')
    }
  }

  if (!enabled) return null
  const recording = status === 'recording'
  return (
    <>
      <button type="button" title={recording ? copy.stop : copy.start}
        aria-label={recording ? copy.stop : copy.start} aria-pressed={recording}
        aria-controls={inputId} aria-describedby={id} disabled={disabled || working}
        onClick={toggle} className="grid min-h-12 min-w-12 place-items-center rounded-lg border-2 border-ink bg-white focus-visible:outline-3 focus-visible:outline-brand aria-pressed:bg-sun disabled:opacity-50">
        <span aria-hidden="true">{recording ? '■' : '🎙️'}</span>
      </button>
      <span id={id} role="status" className="sr-only">{status !== 'idle' && copy[status]}</span>
      {status !== 'idle' && (
        <p aria-hidden="true" className="order-last basis-full text-xs font-bold text-ink/85">{copy[status]}</p>
      )}
    </>
  )
}

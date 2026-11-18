import { useState } from 'react'
import { resolveImageUrl, type Lang } from '../api'
import { PANEL_ASPECT, SCENES, type BubbleBox } from '../art/sheet'
import { characterFor } from '../characters'
import { RichText } from './RichText'
import { SheetCrop } from './SheetCrop'
import { STRINGS } from '../i18n'

const TAIL_PATHS = {
  // Fill covers the bubble border where the tail joins; the stroke draws only the outer edges.
  left: { fill: 'M26,0 L0,20 L26,14 Z', stroke: 'M26,1 L0,20 L26,13', box: 'h-[22px] w-[26px]' },
  right: { fill: 'M0,0 L26,20 L0,14 Z', stroke: 'M0,1 L26,20 L0,13', box: 'h-[22px] w-[26px]' },
  bottom: { fill: 'M0,0 L18,26 L14,0 Z', stroke: 'M1,0 L18,26 L13,0', box: 'h-[26px] w-[20px]' },
} as const

function Tail({ side, at }: { side: BubbleBox['tail']; at: number }) {
  const p = TAIL_PATHS[side]
  const pos =
    side === 'left'
      ? { left: -23, top: `${at}%` }
      : side === 'right'
        ? { right: -23, top: `${at}%` }
        : { bottom: -23, left: `${at}%` }
  return (
    <svg aria-hidden viewBox={side === 'bottom' ? '0 0 20 26' : '0 0 26 22'} className={`absolute ${p.box}`} style={pos}>
      <path d={p.fill} className="fill-cream" />
      <path d={p.stroke} className="fill-none stroke-ink" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  )
}

interface Props {
  imageKey: string
  /** Server artwork for generated comics; takes precedence over local scenes. */
  imageUrl?: string | null
  lang: Lang
  speaker: string
  text: string
  /** Thumbnail mode: art plus an empty bubble (hides baked-in lettering), no text. */
  thumb?: boolean
  priority?: boolean
}

/** One comic panel: style-sheet artwork with a live, translatable speech bubble on top. */
export function PanelArt({ imageKey, imageUrl, lang, speaker, text, thumb = false, priority = false }: Props) {
  const scene = SCENES[imageKey]
  const character = characterFor(speaker)

  if (imageUrl) {
    return (
      <RemotePanel
        key={imageUrl}
        url={imageUrl}
        imageKey={imageKey}
        lang={lang}
        speaker={speaker}
        text={text}
        thumb={thumb}
        priority={priority}
        tag={character?.tag}
      />
    )
  }

  if (!scene) {
    return (
      <div className="@container relative grid h-full w-full place-items-center bg-cream" style={{ aspectRatio: PANEL_ASPECT }}>
        <span className="rounded-lg border-2 border-dashed border-ink/40 px-3 py-1 font-mono text-sm text-ink/60">{imageKey}</span>
        {!thumb && (
          <p className="absolute inset-x-3 bottom-3 rounded-2xl border-[3px] border-ink bg-cream p-3 text-center font-bold">
            <span className="block text-xs text-brand-dark uppercase">{speaker}</span>
            <RichText text={text} />
          </p>
        )}
      </div>
    )
  }

  const b = scene.bubble
  return (
    <div className="@container relative h-full w-full bg-sky-100" style={{ aspectRatio: PANEL_ASPECT }}>
      <SheetCrop rect={scene.crop} className="h-full w-full" eager={priority} />
      <div
        className={`absolute flex flex-col items-center justify-center rounded-[38%/30%] border-ink bg-cream text-center text-ink ${
          thumb ? 'border-[1.5px]' : 'border-[3px] px-[4%] py-[3%] shadow-[0_3px_0_rgb(29_39_102/0.25)]'
        }`}
        style={{ left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, minHeight: `${b.height}%` }}
      >
        {!thumb && (
          <>
            <Tail side={b.tail} at={b.tailAt} />
            <span
              className={`absolute -top-[0.9em] left-1/2 -translate-x-1/2 rounded-full border-2 border-ink px-[0.7em] py-[0.1em] text-[clamp(10px,2.6cqw,15px)] font-black whitespace-nowrap uppercase ${
                character?.tag ?? 'bg-sun text-ink'
              }`}
            >
              {speaker}
            </span>
            <p className="text-[clamp(13px,4.3cqw,24px)] leading-[1.2] font-extrabold text-balance">
              <RichText text={text} />
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Generated panel: server image (no lettering assumed) with the dialogue in a
 * bubble beneath it, so the text never covers unknown artwork.
 */
function RemotePanel({
  url,
  imageKey,
  lang,
  speaker,
  text,
  thumb,
  priority,
  tag,
}: {
  url: string
  imageKey: string
  lang: Lang
  speaker: string
  text: string
  thumb: boolean
  priority: boolean
  tag?: string
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  const art = (
    <div className="relative overflow-hidden bg-sky-100" style={{ aspectRatio: PANEL_ASPECT }}>
      {status === 'loading' && <div aria-hidden className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,#dbe8ff_30%,#eef4ff_50%,#dbe8ff_70%)]" />}
      {status === 'error' ? (
        <div className="absolute inset-0 grid place-items-center p-2 text-center">
          <span className={`font-bold text-ink/60 ${thumb ? 'text-lg' : 'text-sm'}`}>
            {thumb ? '🖼️' : `🖼️ ${STRINGS[lang].imageError}`}
            {!thumb && <span className="mt-1 block font-mono text-xs font-normal">{imageKey}</span>}
          </span>
        </div>
      ) : (
        <img
          src={resolveImageUrl(url)}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )

  if (thumb) return art

  return (
    <div className="@container">
      {art}
      <div className="border-t-[5px] border-ink bg-white px-3 pt-5 pb-3 sm:px-4">
        <div className="relative rounded-[22px] border-[3px] border-ink bg-cream px-4 pt-4 pb-3 text-center text-ink shadow-[0_3px_0_rgb(29_39_102/0.25)]">
          <svg aria-hidden viewBox="0 0 22 26" className="absolute -top-[23px] left-[14%] h-[26px] w-[22px]">
            <path d="M0,26 L6,0 L18,26 Z" className="fill-cream" />
            <path d="M1,25 L6,0 L17,25" className="fill-none stroke-ink" strokeWidth={3} strokeLinejoin="round" />
          </svg>
          <span
            className={`absolute -top-[0.9em] left-1/2 -translate-x-1/2 rounded-full border-2 border-ink px-[0.7em] py-[0.1em] text-[clamp(10px,2.6cqw,15px)] font-black whitespace-nowrap uppercase ${tag ?? 'bg-sun text-ink'}`}
          >
            {speaker}
          </span>
          <p className="text-[clamp(15px,3.6cqw,24px)] leading-[1.25] font-extrabold text-balance">
            <RichText text={text} />
          </p>
        </div>
      </div>
    </div>
  )
}

import { PANEL_ASPECT, SCENES, type BubbleBox } from '../art/sheet'
import { characterFor } from '../characters'
import { RichText } from './RichText'
import { SheetCrop } from './SheetCrop'

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
  speaker: string
  text: string
  /** Thumbnail mode: art plus an empty bubble (hides baked-in lettering), no text. */
  thumb?: boolean
  priority?: boolean
}

/** One comic panel: style-sheet artwork with a live, translatable speech bubble on top. */
export function PanelArt({ imageKey, speaker, text, thumb = false, priority = false }: Props) {
  const scene = SCENES[imageKey]
  const character = characterFor(speaker)

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

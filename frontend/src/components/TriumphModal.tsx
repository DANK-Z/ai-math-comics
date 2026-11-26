import { useEffect, useId, useRef, useState } from 'react'
import { HelperFace } from './HelperFace'
import type { Lang, Reward } from '../api'
import { BOSS_COPY } from '../boss'

// Victory screen after the panel-four boss: a chest bursts open with coins, a trophy card
// sums up the fight, and the student can share the result or read on.

const COINS = Array.from({ length: 14 }, (_, i) => {
  const angle = (-160 + (i * 140) / 13) * (Math.PI / 180)
  const reach = 90 + (i % 3) * 28
  return { dx: Math.round(Math.cos(angle) * reach), dy: Math.round(Math.sin(angle) * reach), delay: (i % 5) * 60 }
})

function starsFor(misses: number) {
  return misses === 0 ? 3 : misses <= 2 ? 2 : 1
}

function Chest() {
  return (
    // The open lid rises about 20 units above the box, so the viewBox starts at y = -24.
    <svg viewBox="0 -24 120 120" aria-hidden className="relative z-10 w-28 overflow-visible sm:w-32">
      <rect x="14" y="44" width="92" height="46" rx="8" fill="#b7672c" stroke="var(--color-ink)" strokeWidth="4" />
      <rect x="14" y="56" width="92" height="9" fill="#8c4a1c" />
      <rect x="52" y="52" width="16" height="20" rx="4" fill="var(--color-sun)" stroke="var(--color-ink)" strokeWidth="3" />
      <g className="triumph-lid" style={{ transformOrigin: '14px 44px' }}>
        <path d="M14 44 V34 a46 26 0 0 1 92 0 V44 Z" fill="#cf7a37" stroke="var(--color-ink)" strokeWidth="4" strokeLinejoin="round" />
        <path d="M30 44 V30 M60 44 V22 M90 44 V30" stroke="#8c4a1c" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  )
}

interface Props {
  open: boolean
  name: string
  lang: Lang
  rounds: number
  misses: number
  /** Coins and stars the server awarded to a signed-in student. */
  reward?: Reward | null
  onClose: () => void
  onReadOn?: () => void
}

export function TriumphModal({ open, name, lang, rounds, misses, reward, onClose, onReadOn }: Props) {
  const copy = BOSS_COPY[lang]
  const t = copy.triumph
  const dialog = useRef<HTMLDialogElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared' | 'failed'>('idle')
  const stars = reward?.stars ?? starsFor(misses)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) {
      setShareState('idle')
      el.showModal()
      // Start on the main action, not on the close button.
      primary.current?.focus()
    } else if (!open && el.open) el.close()
  }, [open])

  async function share() {
    const text = t.shareText(name, rounds, misses)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'AI Math Comics', text })
        setShareState('shared')
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareState('copied')
    } catch {
      setShareState('failed')
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="triumph m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-2xl border-[3px] border-ink bg-cream p-0 text-ink shadow-[0_8px_0_var(--shadow-ink)] backdrop:bg-ink/65"
    >
      <div className="relative overflow-hidden rounded-t-[13px] bg-[radial-gradient(circle_at_50%_70%,#fff6c7,#f8cd45_60%,#f0a92a)] px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-2 right-2 z-20 grid size-10 place-items-center rounded-xl border-2 border-ink bg-white text-lg font-black hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ✕
        </button>
        <h2 id={titleId} className="text-center text-3xl font-black tracking-wide uppercase">{t.title}</h2>
        <div className="relative mt-1 grid h-36 place-items-end justify-center">
          <span aria-hidden className="triumph-glow absolute bottom-6 left-1/2 size-32 -translate-x-1/2 rounded-full bg-white/70 blur-xl" />
          {COINS.map((c, i) => (
            <span
              key={i}
              aria-hidden
              className="triumph-coin absolute bottom-10 left-1/2 z-0 grid size-6 place-items-center rounded-full border-2 border-amber-700 bg-sun text-[10px] font-black text-amber-800"
              style={{ ['--dx' as string]: `${c.dx}px`, ['--dy' as string]: `${c.dy}px`, animationDelay: `${300 + c.delay}ms` }}
            >
              ★
            </span>
          ))}
          <Chest />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <section aria-label={t.trophy} className="rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_3px_0_var(--shadow-ink)]">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl border-2 border-ink bg-sun text-2xl">🏆</span>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-wide text-brand-dark uppercase">{t.trophy}</p>
              <p className="font-black leading-tight break-words">{name}</p>
            </div>
            <HelperFace className="ml-auto w-10"><EmotionAvatar speaker="Пифик" emotion="happy" className="ml-auto w-10 bg-sky" /></HelperFace>
          </div>
          <p className="mt-2 text-2xl leading-none tracking-widest text-amber-500" role="img" aria-label={t.stars(stars)}>
            {'★'.repeat(stars)}<span className="text-ink/20">{'★'.repeat(3 - stars)}</span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-sm font-bold">
            <li className="rounded-lg border-2 border-ink/70 bg-emerald-100 px-2 py-0.5">{t.hits(rounds, rounds)}</li>
            <li className={`rounded-lg border-2 border-ink/70 px-2 py-0.5 ${misses === 0 ? 'bg-sun/60' : 'bg-rose-50'}`}>
              {misses === 0 ? t.perfect : t.misses(misses)}
            </li>
          </ul>
          {reward && (
            <p className="mt-2 rounded-lg border-2 border-amber-700 bg-sun px-2 py-1 text-sm font-black text-ink">
              <span aria-hidden>🪙 </span>{t.coins(reward.coins, reward.totalCoins)}
            </p>
          )}
        </section>

        <div className="mt-4 flex flex-col gap-2 min-[380px]:flex-row">
          {onReadOn && (
            <button
              ref={primary}
              type="button"
              onClick={onReadOn}
              className="min-h-12 flex-1 rounded-xl border-[3px] border-ink bg-sun px-4 font-black shadow-[0_4px_0_var(--shadow-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {t.readOn} <span aria-hidden>→</span>
            </button>
          )}
          <button
            type="button"
            onClick={share}
            className="min-h-12 flex-1 rounded-xl border-[3px] border-ink bg-white px-4 font-black shadow-[0_4px_0_var(--shadow-ink)] transition hover:bg-sky active:translate-y-[3px] active:shadow-[0_1px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span aria-hidden>📣 </span>{t.share}
          </button>
        </div>
        <p role="status" className="mt-2 min-h-5 text-center text-sm font-bold">
          {shareState === 'copied' && t.copied}
          {shareState === 'shared' && t.shared}
          {shareState === 'failed' && t.shareManual}
        </p>
        {shareState === 'failed' && (
          <textarea
            readOnly
            aria-label={t.share}
            value={t.shareText(name, rounds, misses)}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            ref={(el) => el?.select()}
            className="mt-1 w-full resize-none rounded-xl border-2 border-ink/60 bg-white px-3 py-2 text-sm font-semibold text-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-brand"
          />
        )}
      </div>
    </dialog>
  )
}
import { EmotionAvatar } from './EmotionAvatar'

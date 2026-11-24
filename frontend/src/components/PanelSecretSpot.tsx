import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../api'
import { useAccount } from '../account'
import { findSecret, SECRET_COPY, useFoundSecrets, type PanelSecret } from '../panelSecrets'
import { PifikSprite } from './PifikSprite'

/** A small twinkle hidden in the picture; spotting it makes Pifik pop out (and pays coins once). */
export function PanelSecretSpot({ secret, lang }: { secret: PanelSecret; lang: Lang }) {
  const copy = SECRET_COPY[lang]
  const student = useAccount().user?.role === 'student'
  const found = useFoundSecrets().has(secret.id)
  const [open, setOpen] = useState(false)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) close.current?.focus({ preventScroll: true })
  }, [open])

  return (
    <>
      {!found && (
        <button
          type="button"
          aria-label={copy.hint}
          onClick={() => {
            findSecret(secret.id)
            setOpen(true)
          }}
          className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:outline-3 focus-visible:outline-sun"
          style={{ left: `${secret.x}%`, top: `${secret.y}%` }}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="panel-secret absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_4px_rgb(255_255_255/0.95)]">
            <path d="M12 1.5 14 10l8.5 2-8.5 2-2 8.5-2-8.5L1.5 12 10 10z" fill="#fff6b0" stroke="#e0a400" strokeWidth={1} strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {open && (
        <div role="status" className="secret-pop absolute inset-x-[3%] bottom-[4%] flex items-center gap-2 rounded-2xl border-[3px] border-ink bg-cream p-2 text-ink shadow-[0_4px_0_var(--shadow-ink)] sm:inset-x-auto sm:right-[3%] sm:max-w-md sm:gap-3 sm:p-3">
          <PifikSprite className="w-12 shrink-0 rounded-xl border-2 border-ink bg-sky-100 sm:w-14" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-brand-dark uppercase">✨ {copy.found(secret.name[lang])}</p>
            <p className="text-sm leading-snug font-extrabold sm:text-base">{secret.line[lang]}</p>
            {student ? (
              <p className="mt-1 inline-block rounded-lg border-2 border-amber-700 bg-sun px-2 py-0.5 text-xs font-black sm:text-sm">
                <span aria-hidden>🪙 </span>{copy.coins}
              </p>
            ) : (
              <p className="mt-1 text-xs font-bold text-ink/70">{copy.guest}</p>
            )}
          </div>
          <button
            ref={close}
            type="button"
            aria-label={copy.close}
            onClick={() => setOpen(false)}
            className="grid size-10 shrink-0 place-items-center self-start rounded-xl border-2 border-ink bg-white text-lg font-black hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
      )}
    </>
  )
}

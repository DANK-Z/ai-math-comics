import { useEffect, useId, useState } from 'react'
import { useAccount } from '../account'
import { classroomApi, isAbortError, type ItemLore as Lore, type Lang } from '../api'

const COPY = {
  ru: {
    show: 'История предмета', hide: 'Свернуть историю', loading: 'Ищем легенду…',
    error: 'История недоступна.', retry: 'Ещё раз', generated: 'История от ИИ', prepared: 'Легенда ярмарки',
    owned: 'В твоей коллекции', acquired: (date: string) => `В коллекции с ${date}`,
    victory: (name: string, date: string) => `${name} · победа над боссом ${date}`,
    perfect: 'Без ошибок',
  },
  kk: {
    show: 'Заттың тарихы', hide: 'Тарихты жабу', loading: 'Аңызды іздеп жатырмыз…',
    error: 'Тарих қолжетімсіз.', retry: 'Қайталау', generated: 'ЖИ құрастырған оқиға', prepared: 'Жәрмеңке аңызы',
    owned: 'Жинағыңда бар', acquired: (date: string) => `${date} күнінен бастап жинағыңда`,
    victory: (name: string, date: string) => `${name} · ${date} күні боссты жеңді`,
    perfect: 'Қатесіз',
  },
}

export function ItemLore({ itemKey, name, lang }: { itemKey: string; name: string; lang: Lang }) {
  const { user } = useAccount()
  const copy = COPY[lang]
  const id = useId()
  const [open, setOpen] = useState(false)
  const [nonce, retry] = useState(0)
  const [result, setResult] = useState<{ lang: Lang; student: number; lore: Lore | null } | null>(null)
  const student = user?.role === 'student' ? user.id : null
  const current = result?.lang === lang && result.student === student ? result : null

  useEffect(() => {
    if (!open || !student || !classroomApi) return
    const ctrl = new AbortController()
    classroomApi.itemLore(itemKey, lang, ctrl.signal).then(
      (lore) => setResult({ lang, student, lore }),
      (error) => { if (!isAbortError(error)) setResult({ lang, student, lore: null }) },
    )
    return () => ctrl.abort()
  }, [open, itemKey, lang, student, nonce])

  if (!student || !classroomApi) return null
  const lore = current?.lore
  const format = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' })
  return (
    <div className="min-w-0">
      <button type="button" aria-expanded={open} aria-controls={id} aria-label={`${open ? copy.hide : copy.show} · ${name}`}
        className="min-h-11 rounded-lg border-2 border-ink bg-white px-2 text-sm font-black text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand"
        onClick={() => setOpen(!open)}>
        {open ? copy.hide : copy.show}
      </button>
      <div id={id} hidden={!open}>
        {open && <div className="mt-2 grid gap-1 rounded-xl border-2 border-ink/40 bg-cream p-2 text-sm text-ink" aria-live="polite">
          {!current ? <p role="status">{copy.loading}</p> : lore ? (
            <>
              <p className="font-black">{copy[lore.source]}</p>
              <p className="break-words">{lore.story}</p>
              {lore.owned && <p className="font-bold">{lore.acquiredAt ? copy.acquired(format.format(new Date(lore.acquiredAt))) : copy.owned}</p>}
              {lore.victoryAt && <p className="break-words">{copy.victory(lore.student, format.format(new Date(lore.victoryAt)))}
                {lore.perfect && ` · ${copy.perfect}`}{lore.combo >= 2 && ` · COMBO ×${lore.combo}`}
              </p>}
            </>
          ) : (
            <p>{copy.error} <button type="button" onClick={() => { setResult(null); retry((n) => n + 1) }} className="font-black underline">{copy.retry}</button></p>
          )}
        </div>}
      </div>
    </div>
  )
}

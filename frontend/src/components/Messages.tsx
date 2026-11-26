import { useCallback, useId, useState, type FormEvent } from 'react'
import { accounts, type Lang, type MessageThread } from '../api'
import { usePolled } from '../usePolled'
import { CARD, PRIMARY } from './AuthScreen'

// Teacher ↔ parent messages about one child. The teacher writes from the student card (to every
// linked parent) and sees replies in «Ученики»; the parent reads and answers on their page.
// A message may carry a «Посмотреть» button that opens the parent's page with the child's work.

const PARENT_LINK = '#/parent'

const COPY = {
  ru: {
    write: '✉️ Написать родителю',
    templates: (name: string, pending: string) => [
      pending ? `Здравствуйте! ${name} пока не сделал(а) домашнее задание: ${pending}. Пожалуйста, напомните.` : `Здравствуйте! ${name} пропустил(а) две домашки. Пожалуйста, напомните.`,
      `Здравствуйте! ${name} молодец — хорошо работает на уроках. Похвалите дома!`,
      `Здравствуйте! Чтобы закрепить слабую тему, предлагаю 10 минут тренировки в день дома. Поддержите, пожалуйста, — ${name} справится!`,
    ],
    text: 'Сообщение',
    addLink: 'Добавить кнопку «Посмотреть» (откроет задания ребёнка)',
    send: 'Отправить',
    sent: (n: number) => `Отправлено (${n} ${n === 1 ? 'родителю' : 'родителям'}).`,
    noParents: 'У ученика пока нет привязанного родителя. Дайте ребёнку семейный код из его профиля.',
    error: 'Не отправилось. Попробуйте ещё раз.',
    inbox: 'Сообщения родителям',
    inboxEmpty: 'Пока нет переписки. Напишите родителю из карточки ученика.',
    parentInbox: 'Сообщения от учителя',
    unread: (n: number) => `${n} новых`,
    about: (child: string) => `об ученике: ${child}`,
    you: 'Вы',
    teacher: 'Учитель',
    parent: 'Родитель',
    view: 'Посмотреть',
    reply: 'Ответить',
    replyPlaceholder: 'Ваш ответ…',
  },
  kk: {
    write: '✉️ Ата-анаға жазу',
    templates: (name: string, pending: string) => [
      pending ? `Сәлеметсіз бе! ${name} үй жұмысын әлі орындаған жоқ: ${pending}. Еске салыңызшы.` : `Сәлеметсіз бе! ${name} екі үй жұмысын өткізіп алды. Еске салыңызшы.`,
      `Сәлеметсіз бе! ${name} жарайсың — сабақта жақсы жұмыс істейді. Үйде мақтаңыз!`,
      `Сәлеметсіз бе! Әлсіз тақырыпты бекіту үшін үйде күніне 10 минут жаттығуды ұсынамын. Қолдап жіберіңізші — ${name} үлгереді!`,
    ],
    text: 'Хабарлама',
    addLink: '«Қарау» батырмасын қосу (баланың тапсырмаларын ашады)',
    send: 'Жіберу',
    sent: (n: number) => `Жіберілді (${n} ата-анаға).`,
    noParents: 'Оқушыға әлі ата-ана байланыстырылмаған. Балаға профиліндегі отбасы кодын беріңіз.',
    error: 'Жіберілмеді. Қайта көріңіз.',
    inbox: 'Ата-аналармен хат алмасу',
    inboxEmpty: 'Әзірге хат жоқ. Ата-анаға оқушы картасынан жазыңыз.',
    parentInbox: 'Мұғалімнен хабарламалар',
    unread: (n: number) => `${n} жаңа`,
    about: (child: string) => `оқушы туралы: ${child}`,
    you: 'Сіз',
    teacher: 'Мұғалім',
    parent: 'Ата-ана',
    view: 'Қарау',
    reply: 'Жауап беру',
    replyPlaceholder: 'Жауабыңыз…',
  },
}

const FIELD = 'w-full rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-semibold text-ink focus-visible:ring-4 focus-visible:ring-sun'

/** Compose box in the teacher's student card. */
export function WriteToParent({ studentId, name, pending, lang }: { studentId: number; name: string; pending: string; lang: Lang }) {
  const c = COPY[lang]
  const id = useId()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [link, setLink] = useState(true)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      const threads = await accounts.writeToParents(studentId, text.trim(), link ? PARENT_LINK : undefined)
      setStatus({ ok: true, text: c.sent(threads.length) })
      setText('')
    } catch (err) {
      setStatus({ ok: false, text: (err as { status?: number }).status === 409 ? c.noParents : c.error })
    } finally {
      setBusy(false)
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="self-start rounded-xl border-[3px] border-ink bg-white px-3 py-2 text-sm font-black text-ink hover:bg-sky">{c.write}</button>
  return (
    <form onSubmit={send} className="flex flex-col gap-2 rounded-xl border-2 border-ink/25 bg-sky-50 p-3">
      <p className="font-black">{c.write}</p>
      <div className="flex flex-col gap-1">
        {c.templates(name, pending).map((t) => (
          <button key={t} type="button" onClick={() => setText(t)} className="rounded-lg border-2 border-ink/25 bg-white px-2 py-1 text-left text-xs font-semibold text-ink hover:border-ink">{t}</button>
        ))}
      </div>
      <label htmlFor={`${id}-t`} className="sr-only">{c.text}</label>
      <textarea id={`${id}-t`} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} className={FIELD} />
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} className="size-4" />{c.addLink}</label>
      <button type="submit" disabled={busy || !text.trim()} className={`${PRIMARY} self-start`}>{c.send}</button>
      {status && <p role="status" className={`text-sm font-bold ${status.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{status.text}</p>}
    </form>
  )
}

function Thread({ thread, as, lang, onChange }: { thread: MessageThread; as: 'teacher' | 'parent'; lang: Lang; onChange: () => void }) {
  const c = COPY[lang]
  const id = useId()
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const other = as === 'teacher' ? thread.parentName : thread.teacherName

  async function toggle(open: boolean) {
    if (!open || !thread.unread) return
    await accounts.readThread(as, as === 'teacher' ? thread.parentId : thread.teacherId, thread.studentId).catch(() => {})
    onChange()
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!reply.trim()) return
    setBusy(true)
    try {
      if (as === 'parent') await accounts.parentReply(thread.teacherId, thread.studentId, reply.trim())
      else await accounts.writeToParents(thread.studentId, reply.trim())
      setReply('')
      onChange()
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="rounded-xl border-2 border-ink/25 bg-white" onToggle={(e) => toggle((e.target as HTMLDetailsElement).open)}>
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-black text-ink">{other}</span>
          <span className="block truncate text-xs font-semibold text-ink/65">{c.about(thread.studentName)} · {thread.messages.at(-1)?.text}</span>
        </span>
        {thread.unread > 0 && <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-black text-white">{c.unread(thread.unread)}</span>}
      </summary>
      <ol className="flex flex-col gap-2 px-3 pb-2">
        {thread.messages.map((m) => {
          const mine = m.sender === as
          return (
            <li key={m.id} className={`max-w-[85%] rounded-xl border-2 px-3 py-1.5 text-sm ${mine ? 'self-end border-ink/20 bg-sky-50' : 'self-start border-ink/40 bg-cream'}`}>
              <span className="block text-[11px] font-black text-ink/55">{mine ? c.you : m.sender === 'teacher' ? c.teacher : c.parent} · {new Date(m.at).toLocaleString(lang === 'kk' ? 'kk-KZ' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="font-semibold whitespace-pre-line text-ink">{m.text}</span>
              {m.link && m.link.startsWith('#/') && as === 'parent' && <a href={m.link} className="mt-1 block w-fit rounded-lg border-2 border-ink bg-sun px-2 py-0.5 text-xs font-black text-ink">👀 {c.view}</a>}
            </li>
          )
        })}
      </ol>
      <form onSubmit={send} className="flex gap-2 border-t-2 border-ink/10 p-2">
        <label htmlFor={`${id}-r`} className="sr-only">{c.reply}</label>
        <input id={`${id}-r`} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} placeholder={c.replyPlaceholder} className="min-h-10 min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-3 text-sm font-semibold text-ink focus-visible:ring-4 focus-visible:ring-sun" />
        <button type="submit" disabled={busy || !reply.trim()} className="shrink-0 rounded-xl border-[3px] border-ink bg-sun px-3 text-sm font-black text-ink disabled:opacity-60">{c.reply}</button>
      </form>
    </details>
  )
}

export function MessagesCard({ as, lang }: { as: 'teacher' | 'parent'; lang: Lang }) {
  const c = COPY[lang]
  const load = useCallback((s: AbortSignal) => (as === 'teacher' ? accounts.teacherThreads(s) : accounts.parentThreads(s)), [as])
  const { value: threads, refresh } = usePolled(load, 30000)
  if (!threads || (as === 'parent' && threads.length === 0)) return null
  const unread = threads.reduce((s, t) => s + t.unread, 0)
  return (
    <section className={`${CARD} flex flex-col gap-2`}>
      <h2 className="flex items-center gap-2 text-lg font-black text-ink">✉️ {as === 'teacher' ? c.inbox : c.parentInbox}{unread > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-black text-white">{c.unread(unread)}</span>}</h2>
      {threads.length === 0 ? <p className="text-sm font-semibold text-ink/70">{c.inboxEmpty}</p> : threads.map((t) => (
        <Thread key={`${t.teacherId}-${t.parentId}-${t.studentId}`} thread={t} as={as} lang={lang} onChange={refresh} />
      ))}
    </section>
  )
}

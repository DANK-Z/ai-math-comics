import { useCallback, useId, useState, type FormEvent } from 'react'
import { accounts, LOCAL_COMICS, type BattleTopic, type CastHeroId, type Lang } from '../api'
import { CLASSROOM_COPY } from '../classroomCopy'
import { CAST_ORDER } from '../myStory'
import { printSheet } from '../print'
import { useLoaded } from '../usePolled'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'
import { chapterTitle } from './CurriculumCard'
import { HERO_NAMES, TaskPanel } from './StudentExtras'

// Teacher's «Задания» tab: a printable drill sheet, and the teacher's own problem turned into a
// comic panel (a chapter scene, a hero and a speech bubble) that the class solves in «Мой класс».

const COPY = {
  ru: {
    drillTitle: 'Распечатать тренировку',
    drillLead: 'Лист задач по теме для самостоятельной на бумаге. Ответы — на отдельной странице.',
    topic: 'Тема',
    count: 'Задач',
    grade: 'Класс',
    print: '🖨 Печать / PDF',
    sheet: (topic: string) => `Самостоятельная: ${topic}`,
    nameLine: 'Имя: ______________________   Дата: __________',
    answers: 'Ответы (для учителя)',
    popup: 'Разрешите всплывающие окна, чтобы открыть печать.',
    taskTitle: 'Своя задача в комиксе',
    taskLead: 'Напишите задачу — герой задаст её классу прямо в сцене из главы. Ответ — целое число.',
    hero: 'Герой',
    scene: 'Сцена',
    mainField: 'Задача (рус.)',
    otherField: 'Задача на казахском — необязательно',
    answer: 'Ответ',
    hintRu: 'Подсказка — необязательно',
    preview: 'Так увидят ученики',
    create: 'Отправить классу',
    created: 'Задача отправлена классу.',
    badAnswer: 'Ответ должен быть целым числом.',
    list: 'Задачи классу',
    solved: (s: number, t: number) => `Решили: ${s} из ${t}`,
    remove: 'Убрать',
    who: 'Кто решил',
    error: 'Не получилось. Попробуйте ещё раз.',
    placeholder: 'У Аруны 3 коробки по 12 карандашей. Сколько всего карандашей?',
  },
  kk: {
    drillTitle: 'Жаттығуды басып шығару',
    drillLead: 'Қағаздағы өзіндік жұмысқа арналған тақырып бойынша есептер парағы. Жауаптар — бөлек бетте.',
    topic: 'Тақырып',
    count: 'Есеп саны',
    grade: 'Сынып',
    print: '🖨 Басып шығару / PDF',
    sheet: (topic: string) => `Өзіндік жұмыс: ${topic}`,
    nameLine: 'Аты: ______________________   Күні: __________',
    answers: 'Жауаптар (мұғалімге)',
    popup: 'Басып шығаруды ашу үшін қалқымалы терезелерге рұқсат етіңіз.',
    taskTitle: 'Комикстегі өз есебіңіз',
    taskLead: 'Есепті жазыңыз — кейіпкер оны тараудың сахнасында сыныпқа қояды. Жауабы — бүтін сан.',
    hero: 'Кейіпкер',
    scene: 'Сахна',
    mainField: 'Есеп (қаз.)',
    otherField: 'Есеп орыс тілінде — міндетті емес',
    answer: 'Жауап',
    hintRu: 'Кеңес — міндетті емес',
    preview: 'Оқушылар осылай көреді',
    create: 'Сыныпқа жіберу',
    created: 'Есеп сыныпқа жіберілді.',
    badAnswer: 'Жауап бүтін сан болуы керек.',
    list: 'Сыныпқа берілген есептер',
    solved: (s: number, t: number) => `Шешкендер: ${t}-тен ${s}`,
    remove: 'Алып тастау',
    who: 'Кім шешті',
    error: 'Болмады. Қайта көріңіз.',
    placeholder: 'Арунада 12 қарындаштан 3 қорап бар. Барлығы неше қарындаш?',
  },
}

const TOPICS: BattleTopic[] = ['equations', 'fractions', 'decimals', 'gcd', 'parts']
const SELECT = 'mt-1 min-h-10 w-full rounded-xl border-[3px] border-ink bg-white px-2 font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun'
const FIELD = 'mt-1 w-full rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-semibold text-ink focus-visible:ring-4 focus-visible:ring-sun'

export function PrintDrillCard({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const id = useId()
  const [topic, setTopic] = useState<BattleTopic>('fractions')
  const [count, setCount] = useState(10)
  const [grade, setGrade] = useState(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const topicName = CLASSROOM_COPY[lang].board.topics[topic]

  async function print() {
    setBusy(true)
    setError(null)
    try {
      const problems = await accounts.printDrill(topic, count, grade, lang)
      const ok = printSheet(c.sheet(topicName), [
        { kind: 'h1', text: c.sheet(topicName) },
        { kind: 'p', text: c.nameLine },
        { kind: 'ol', items: problems.map((p) => p.prompt), lines: true },
        { kind: 'break' },
        { kind: 'h2', text: c.answers },
        { kind: 'ol', items: problems.map((p) => p.answer) },
      ])
      if (!ok) setError(c.popup)
    } catch {
      setError(c.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={CARD} aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="text-xl font-black text-ink">🖨 {c.drillTitle}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{c.drillLead}</p>
      <div className="mt-3 grid grid-cols-[2fr_1fr_1fr] gap-2">
        <label className="text-sm font-black text-ink/80">{c.topic}
          <select value={topic} onChange={(e) => setTopic(e.target.value as BattleTopic)} className={SELECT}>
            {TOPICS.map((t) => <option key={t} value={t}>{CLASSROOM_COPY[lang].board.topics[t]}</option>)}
          </select>
        </label>
        <label className="text-sm font-black text-ink/80">{c.count}
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={SELECT}>
            {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-sm font-black text-ink/80">{c.grade}
          <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className={SELECT}>
            {[5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <button type="button" onClick={print} disabled={busy} className={`${SECONDARY} mt-3`}>{c.print}</button>
      {error && <p role="alert" className="mt-2 font-bold text-rose-700">{error}</p>}
    </section>
  )
}

const SCENES = ['pizza-fractions', ...LOCAL_COMICS.map((d) => d.id)]

export function TeacherTasksCard({ classId, lang }: { classId: number; lang: Lang }) {
  const c = COPY[lang]
  const id = useId()
  const { value: tasks, setValue: setTasks } = useLoaded(useCallback((s: AbortSignal) => accounts.teacherTasks(classId, s), [classId]))
  const [hero, setHero] = useState<CastHeroId>('aruna')
  const [scene, setScene] = useState('library-boxes')
  const [textRu, setTextRu] = useState('')
  const [textKk, setTextKk] = useState('')
  const [answer, setAnswer] = useState('')
  const [hintRu, setHintRu] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mainText = lang === 'kk' ? textKk : textRu

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{1,9}$/.test(answer.trim())) { setStatus(c.badAnswer); return }
    setBusy(true)
    setStatus(null)
    try {
      const made = await accounts.createTeacherTask(classId, {
        hero, scene, textRu: textRu.trim() || textKk.trim(), textKk: textKk.trim(), answer: answer.trim(),
        ...(hintRu.trim() ? { hintRu: hintRu.trim() } : {}),
      })
      setTasks([made, ...(tasks ?? [])])
      setTextRu(''); setTextKk(''); setAnswer(''); setHintRu('')
      setStatus(c.created)
    } catch {
      setStatus(c.error)
    } finally {
      setBusy(false)
    }
  }

  async function remove(taskId: string) {
    try {
      await accounts.deleteTeacherTask(taskId)
      setTasks((tasks ?? []).filter((t) => t.id !== taskId))
    } catch {
      setStatus(c.error)
    }
  }

  // The main field follows the interface language; the other one is optional.
  const [mainLabel, otherLabel] = [c.mainField, c.otherField]
  const [mainValue, setMain, otherValue, setOther] = lang === 'kk' ? [textKk, setTextKk, textRu, setTextRu] : [textRu, setTextRu, textKk, setTextKk]

  return (
    <section className={CARD} aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="text-xl font-black text-ink">✏️ {c.taskTitle}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{c.taskLead}</p>
      <form onSubmit={create} className="mt-3 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-black text-ink/80">{c.hero}
            <select value={hero} onChange={(e) => setHero(e.target.value as CastHeroId)} className={SELECT}>
              {CAST_ORDER.map((h) => <option key={h} value={h}>{HERO_NAMES[h][lang]}</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-ink/80">{c.scene}
            <select value={scene} onChange={(e) => setScene(e.target.value)} className={SELECT}>
              {SCENES.map((s) => <option key={s} value={s}>{chapterTitle(s, lang)}</option>)}
            </select>
          </label>
        </div>
        <label className="text-sm font-black text-ink/80">{mainLabel}
          <textarea value={mainValue} onChange={(e) => setMain(e.target.value)} required maxLength={400} rows={3} placeholder={c.placeholder} className={FIELD} />
        </label>
        <details>
          <summary className="cursor-pointer text-sm font-black text-brand-dark">{otherLabel}</summary>
          <textarea aria-label={otherLabel} value={otherValue} onChange={(e) => setOther(e.target.value)} maxLength={400} rows={2} className={FIELD} />
        </details>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <label className="text-sm font-black text-ink/80">{c.answer}
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} required inputMode="numeric" maxLength={9} className={`${FIELD} font-mono`} />
          </label>
          <label className="text-sm font-black text-ink/80">{c.hintRu}
            <input value={hintRu} onChange={(e) => setHintRu(e.target.value)} maxLength={200} className={FIELD} />
          </label>
        </div>
        {mainText.trim() && (
          <div>
            <p className="mb-1 text-xs font-black tracking-wide text-ink/60 uppercase">{c.preview}</p>
            <TaskPanel task={{ hero, scene, textRu: textRu || textKk, textKk: textKk || textRu }} lang={lang} />
          </div>
        )}
        <button type="submit" disabled={busy || !mainText.trim() || !answer.trim()} className={`${PRIMARY} self-start`}>{c.create}</button>
        {status && <p role="status" className={`font-bold ${status === c.created ? 'text-emerald-700' : 'text-rose-700'}`}>{status}</p>}
      </form>
      {!!tasks?.length && (
        <>
          <h3 className="mt-4 font-black text-ink">{c.list}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {tasks.map((t) => (
              <li key={t.id} className="rounded-xl border-2 border-ink/20 bg-sky-50 px-3 py-2">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm font-bold text-ink">{(lang === 'kk' ? t.textKk : t.textRu) || t.textRu} <span className="font-mono text-ink/60">= {t.answer}</span></p>
                  <button type="button" onClick={() => remove(t.id)} className="shrink-0 text-xs font-black text-rose-700 underline">{c.remove}</button>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs font-black text-ink/75">{c.solved(t.solved, t.total)}</summary>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {t.students.map((s) => (
                      <li key={s.id} className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${s.solved ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-ink/60'}`}>{s.solved ? '✓' : '·'} {s.name}{s.tries ? ` (${s.tries})` : ''}</li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

import type { ClassSummary, Lang } from './api'
import { pct, pupilIn, topicRows } from './components/ClassAnalytics'
import { dayMonth } from './dates'
import { printSheet, type PrintBlock } from './print'

// Parent-meeting report: one printed page per child for the chosen period — activity,
// accuracy by topic, what goes well, what to work on — with room for the teacher's comment.

const COPY = {
  ru: {
    title: (cls: string) => `Отчёт к родительскому собранию — ${cls}`,
    period: (from: string, to: string) => `Период: ${from} — ${to}`,
    stats: ['Дней с занятиями', 'Глав пройдено', 'Задач решено', 'Верных ответов'],
    topics: 'Темы',
    topicHead: ['Тема', 'Ответов', 'Верно'],
    noTopics: 'За этот период ответов по темам ещё нет.',
    good: (t: string) => `Получается хорошо: ${t}.`,
    work: (t: string) => `Стоит потренировать: ${t}.`,
    lagging: 'Ученик давно не занимался или часто ошибается — нужна поддержка дома.',
    comment: 'Комментарий учителя: ____________________________________________',
    signature: 'Подпись родителя: ______________',
  },
  kk: {
    title: (cls: string) => `Ата-аналар жиналысына есеп — ${cls}`,
    period: (from: string, to: string) => `Кезең: ${from} — ${to}`,
    stats: ['Сабақ болған күндер', 'Өтілген тараулар', 'Шешілген есептер', 'Дұрыс жауаптар'],
    topics: 'Тақырыптар',
    topicHead: ['Тақырып', 'Жауаптар', 'Дұрыс'],
    noTopics: 'Бұл кезеңде тақырыптар бойынша жауап әлі жоқ.',
    good: (t: string) => `Жақсы шығады: ${t}.`,
    work: (t: string) => `Жаттықтыру керек: ${t}.`,
    lagging: 'Оқушы көптен бері айналыспаған немесе жиі қателеседі — үйде қолдау қажет.',
    comment: 'Мұғалімнің пікірі: ____________________________________________',
    signature: 'Ата-ананың қолы: ______________',
  },
}

export function printMeetingReport(summary: ClassSummary, className: string, lang: Lang) {
  const c = COPY[lang]
  const rows = topicRows(summary, lang)
  const period = c.period(dayMonth(new Date(summary.since), lang), dayMonth(new Date(), lang))
  const blocks: PrintBlock[] = []
  const pupils = [...summary.pupils].sort((a, b) => a.name.localeCompare(b.name, lang))
  pupils.forEach((p, i) => {
    const mine = rows.map((r) => ({ label: r.label, ...pupilIn(r, p, lang) })).filter((r) => r.answers > 0)
    const good = mine.filter((r) => pct(r.correct, r.answers) >= 80).map((r) => r.label)
    const work = mine.filter((r) => pct(r.correct, r.answers) < 60).map((r) => r.label)
    blocks.push(
      { kind: 'small', text: c.title(className) },
      { kind: 'h1', text: p.name },
      { kind: 'p', text: period },
      { kind: 'table', head: c.stats, rows: [[String(p.activeDays), String(p.chapters), String(p.solved), p.answers ? `${pct(p.correct, p.answers)}%` : '—']] },
      { kind: 'h2', text: c.topics },
      mine.length
        ? { kind: 'table', head: c.topicHead, rows: mine.map((r) => [r.label, String(r.answers), `${pct(r.correct, r.answers)}%`]) }
        : { kind: 'p', text: c.noTopics },
    )
    if (good.length) blocks.push({ kind: 'p', text: c.good(good.join(', ')) })
    if (work.length) blocks.push({ kind: 'p', text: c.work(work.join(', ')) })
    if (p.lagging) blocks.push({ kind: 'p', text: c.lagging })
    blocks.push({ kind: 'p', text: ' ' }, { kind: 'p', text: c.comment }, { kind: 'p', text: c.signature })
    if (i < pupils.length - 1) blocks.push({ kind: 'break' })
  })
  return printSheet(c.title(className), blocks)
}

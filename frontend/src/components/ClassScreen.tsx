import { useCallback } from 'react'
import { accounts, type Lang } from '../api'
import { useAccount } from '../account'
import { rememberAfterLogin } from '../afterLogin'
import { SECTION_HREFS } from '../route'
import { usePolled } from '../usePolled'
import { BattleAlert, LessonAlert } from './BoardAlerts'
import { StudentAssignments } from './ClassAssignments'
import { ClassLeague } from './ClassLeague'
import { MyHomeworkCard } from './HomeworkCards'
import { DailyCard, ReviewCard } from './StudentDaily'

// «Мой класс»: everything the student does together with the class in one place. A lesson or a
// battle in progress, homework and the teacher's assignments, and the weekly class league.
// The home page keeps only the live «lesson / battle now» alerts so they are never missed.

const COPY = {
  ru: {
    title: 'Мой класс',
    lead: (name: string) => `${name}: уроки, батлы, домашние задания и лига класса — всё здесь.`,
    guest: 'Здесь будут уроки, битвы с боссом и лига твоего класса. Войди как ученик или присоединись к классу по коду учителя.',
    signIn: 'Войти',
    noClass: 'Ты пока не в классе. Попроси у учителя код класса и введи его в профиле.',
    toProfile: 'Ввести код класса',
    battleTitle: 'Битва с боссом',
    battleIdle: 'Учитель запускает битву на уроке. Когда она начнётся, здесь появится кнопка «В бой», а на главной — яркая плашка.',
  },
  kk: {
    title: 'Менің сыныбым',
    lead: (name: string) => `${name}: сабақтар, шайқастар, үй тапсырмалары және сынып лигасы — бәрі осында.`,
    guest: 'Мұнда сыныбыңның сабақтары, босспен шайқастары және лигасы болады. Оқушы ретінде кір немесе мұғалімнің коды арқылы сыныпқа қосыл.',
    signIn: 'Кіру',
    noClass: 'Сен әзірге сыныпта емессің. Мұғалімнен сынып кодын сұрап, оны профильге енгіз.',
    toProfile: 'Сынып кодын енгізу',
    battleTitle: 'Босспен шайқас',
    battleIdle: 'Мұғалім шайқасты сабақта бастайды. Ол басталғанда мұнда «Шайқасқа» батырмасы, ал басты бетте жарқын белгі пайда болады.',
  },
}

const CARD = 'rounded-2xl border-[3px] border-ink bg-white p-4 shadow-[0_4px_0_var(--shadow-ink)] sm:p-5'
const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl border-[3px] border-ink bg-sun px-5 font-black text-ink shadow-[0_3px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand'

/** A short note on how a battle starts (while none is running). */
function BattleIdle({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  return (
    <section aria-label={c.battleTitle} className="flex items-start gap-2.5 rounded-2xl border-2 border-ink/40 bg-white px-3 py-2.5">
      <span aria-hidden className="text-2xl leading-none">⚔️</span>
      <p className="min-w-0 text-sm font-semibold text-ink/80"><span className="font-black text-ink">{c.battleTitle}.</span> {c.battleIdle}</p>
    </section>
  )
}

export function ClassScreen({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const user = useAccount().user
  const schoolClass = user?.role === 'student' ? user.schoolClass : undefined

  let body
  if (user?.role !== 'student') {
    body = (
      <div className={`${CARD} flex flex-col items-start gap-3`}>
        <p className="font-semibold text-ink">{c.guest}</p>
        <a href={SECTION_HREFS.login} onClick={() => rememberAfterLogin(SECTION_HREFS.myClass)} className={BUTTON}>{c.signIn}</a>
      </div>
    )
  } else if (!schoolClass) {
    body = (
      <div className={`${CARD} flex flex-col items-start gap-3`}>
        <p className="font-semibold text-ink">{c.noClass}</p>
        <a href={SECTION_HREFS.profile} className={BUTTON}>{c.toProfile}</a>
      </div>
    )
  } else {
    body = <StudentClass lang={lang} />
  }

  return (
    <section aria-labelledby="class-title" className="flex flex-col gap-4">
      <div>
        <h1 id="class-title" className="text-2xl font-black text-ink sm:text-3xl">👥 {c.title}</h1>
        {schoolClass && <p className="mt-1 font-semibold text-ink/80">{c.lead(schoolClass.name)}</p>}
      </div>
      {body}
    </section>
  )
}

/** The class page of a student in a class: live alerts on top, then two balanced columns. */
function StudentClass({ lang }: { lang: Lang }) {
  const load = useCallback((signal: AbortSignal) => accounts.myBattle(lang, signal), [lang])
  const { value: battle } = usePolled(load, 15000, true)
  const live = battle?.status === 'active'
  return (
      <>
        <LessonAlert lang={lang} />
        {live && <BattleAlert lang={lang} />}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <DailyCard lang={lang} />
            <MyHomeworkCard lang={lang} />
            <ReviewCard lang={lang} />
            <StudentAssignments lang={lang} />
            {!live && <BattleIdle lang={lang} />}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <ClassLeague lang={lang} limit={6} />
          </div>
        </div>
      </>
  )
}

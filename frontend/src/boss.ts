import type { BossKind, Lang } from './api/types'

// Panel-four boss fight copy. Each correct round deals maxHp / rounds (30 of 90 HP).

interface BossCopy {
  arena: string
  names: Record<BossKind, string>
  taunts: Record<BossKind, string>
  hp: (hp: number, max: number) => string
  round: (n: number, total: number) => string
  status: { cleared: string; active: string; upcoming: string }
  hit: Record<BossKind, (damage: number) => string>
  answerLabel: string
  defeated: string
  defeatedText: Record<BossKind, string>
  readOn: string
  draft: string
  draftLabel: string
  draftPlaceholder: string
  triumph: {
    title: string
    trophy: string
    hits: (n: number, total: number) => string
    misses: (n: number) => string
    perfect: string
    stars: (n: number) => string
    readOn: string
    share: string
    copied: string
    shared: string
    shareManual: string
    coins: (earned: number, total: number) => string
    close: string
    reopen: string
    shareText: (boss: string, total: number, misses: number) => string
  }
}

export const BOSS_COPY: Record<Lang, BossCopy> = {
  ru: {
    arena: 'Битва с боссом',
    names: { 'fraction-slime': 'Дробный Слайм', 'x-master': 'Магистр Иксов' },
    taunts: {
      'fraction-slime': 'Хлюп! Я разделю всё нечестно. Попробуй меня остановить!',
      'x-master': 'Ха-ха! Мой щит из иксов не пробить. Найди x — если сможешь!',
    },
    hp: (hp, max) => `Здоровье босса: ${hp} из ${max}`,
    round: (n, total) => `Удар ${n} из ${total}`,
    status: { cleared: 'Пройден', active: 'Сейчас', upcoming: 'Впереди' },
    hit: {
      'fraction-slime': (d) => `Точный удар! Слайм теряет ${d} HP.`,
      'x-master': (d) => `Щит треснул! Магистр теряет ${d} HP.`,
    },
    answerLabel: 'Твой ответ',
    defeated: 'Босс повержен!',
    defeatedText: {
      'fraction-slime': 'Слайм растёкся лужицей и признал: делить надо честно и поровну!',
      'x-master': 'Щит рассыпался искрами — Магистр Иксов признал поражение!',
    },
    readOn: 'Листай дальше — история продолжается',
    draft: 'Черновик',
    draftLabel: 'Черновик для вычислений',
    draftPlaceholder: 'Считай здесь как удобно — черновик никто не проверяет.',
    triumph: {
      title: 'Победа!',
      trophy: 'Трофей',
      hits: (n, total) => `Удары: ${n} из ${total}`,
      misses: (n) => `Ошибки: ${n}`,
      perfect: 'Без единой ошибки!',
      stars: (n) => `Оценка: ${n} из 3 звёзд`,
      readOn: 'Читать дальше',
      share: 'Поделиться',
      copied: 'Текст скопирован — вставь его в сообщение.',
      shared: 'Готово, успех отправлен!',
      shareManual: 'Скопируй этот текст и отправь его друзьям:',
      coins: (earned, total) => `+${earned} монет · всего ${total}`,
      close: 'Закрыть',
      reopen: 'Показать трофей',
      shareText: (boss, total, misses) =>
        `🏆 Босс «${boss}» повержен! Удары: ${total} из ${total}, ошибок: ${misses}. AI Math Comics`,
    },
  },
  kk: {
    arena: 'Босспен шайқас',
    names: { 'fraction-slime': 'Бөлшек Слайм', 'x-master': 'Икстер Магистрі' },
    taunts: {
      'fraction-slime': 'Шалп! Бәрін әділетсіз бөлемін. Мені тоқтатып көр!',
      'x-master': 'Ха-ха! Икстерден жасалған қалқанымды ешкім бұза алмайды. x-ті тауып көр!',
    },
    hp: (hp, max) => `Босстың денсаулығы: ${hp} / ${max}`,
    round: (n, total) => `${total} соққының ${n}-сі`,
    status: { cleared: 'Өтті', active: 'Қазір', upcoming: 'Алда' },
    hit: {
      'fraction-slime': (d) => `Дәл соққы! Слайм ${d} HP жоғалтты.`,
      'x-master': (d) => `Қалқан жарылды! Магистр ${d} HP жоғалтты.`,
    },
    answerLabel: 'Сенің жауабың',
    defeated: 'Босс жеңілді!',
    defeatedText: {
      'fraction-slime': 'Слайм шалшыққа айналып, бәрін әділ әрі тең бөлу керек екенін мойындады!',
      'x-master': 'Қалқан ұшқынға айналды — Икстер Магистрі жеңілгенін мойындады!',
    },
    readOn: 'Әрі қарай парақта — оқиға жалғасады',
    draft: 'Жоба дәптер',
    draftLabel: 'Есептеуге арналған жоба дәптер',
    draftPlaceholder: 'Мұнда өзіңе ыңғайлы есепте — жобаны ешкім тексермейді.',
    triumph: {
      title: 'Жеңіс!',
      trophy: 'Олжа',
      hits: (n, total) => `Соққылар: ${total}-тен ${n}`,
      misses: (n) => `Қателер: ${n}`,
      perfect: 'Бірде-бір қатесіз!',
      stars: (n) => `Баға: 3 жұлдыздан ${n}`,
      readOn: 'Әрі қарай оқу',
      share: 'Бөлісу',
      copied: 'Мәтін көшірілді — оны хабарламаға қой.',
      shared: 'Дайын, жетістігің жіберілді!',
      shareManual: 'Осы мәтінді көшіріп, достарыңа жібер:',
      coins: (earned, total) => `+${earned} тиын · барлығы ${total}`,
      close: 'Жабу',
      reopen: 'Олжаны көрсету',
      shareText: (boss, total, misses) =>
        `🏆 «${boss}» жеңілді! Соққылар: ${total}-тен ${total}, қателер: ${misses}. AI Math Comics`,
    },
  },
}

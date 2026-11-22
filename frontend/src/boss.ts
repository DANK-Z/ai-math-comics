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
  },
}

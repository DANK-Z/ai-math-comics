export const GUARDIAN_TOPICS = ['pizzas', 'prize', 'map'] as const
export type GuardianTopic = (typeof GUARDIAN_TOPICS)[number]
export type GuardianBoost = 'example' | 'plan'

export interface GuardianAssignment {
  topics: GuardianTopic[]
  variant: number
  boosts: boolean
}

export function guardianAssignmentHref(assignment: GuardianAssignment) {
  const query = new URLSearchParams({ rounds: assignment.topics.join(','), set: String(assignment.variant), boosts: assignment.boosts ? '1' : '0' })
  return `#/guardian/assignment?${query}`
}

export function parseGuardianAssignment(hash: string): GuardianAssignment | null {
  const prefix = '#/guardian/assignment?'
  if (!hash.startsWith(prefix)) return null
  const query = new URLSearchParams(hash.slice(prefix.length))
  const requested = query.get('rounds')?.split(',') ?? []
  const topics = GUARDIAN_TOPICS.filter((topic) => requested.includes(topic))
  const set = query.get('set')
  const boosts = query.get('boosts')
  if (!topics.length || topics.length !== requested.length || !['0', '1', '2'].includes(set ?? '') || (boosts !== '0' && boosts !== '1')) return null
  return { topics, variant: Number(set), boosts: boosts === '1' }
}

export const GUARDIAN_SETUP = {
  ru: {
    title: 'Настроить раунды Стража', topics: 'Темы раундов', preset: 'Набор чисел', numbers: ['Начальный', 'Вариант один', 'Вариант два'],
    boosts: 'Разрешить усиления', link: 'Ссылка на испытание', copy: 'Скопировать испытание', copied: 'Ссылка скопирована.', manual: 'Скопируй выделенную ссылку.',
    lead: 'Ученики открывают испытание по ссылке после прохождения всех глав.', task: 'Испытание от учителя', finished: 'Ты решил все раунды задания.',
    powers: 'Усиления', example: 'Разобрать похожий пример', plan: 'Открыть план решения', used: 'Использовано',
    topicNames: { pizzas: 'Дроби', prize: 'Проценты', map: 'Масштаб' },
    examples: { pizzas: 'Если поровну разделить 5 пирогов между 8 друзьями, каждый получит 5/8 пирога.', prize: 'Товар стоит 1 000 тенге. Скидка 10% равна 100 тенге. Новая цена — 900 тенге.', map: 'Если 1 см означает 10 м, то 2 см на карте означают 2 × 10 = 20 м.' },
    plans: { pizzas: 'Определи, что делят и между сколькими друзьями. Запиши первое число в числитель, второе — в знаменатель.', prize: 'Найди сумму скидки от исходной цены. Затем вычти её из исходной цены.', map: 'Найди сантиметры на карте и метры для одного сантиметра. Перемножь и проверь единицы.' },
  },
  kk: {
    title: 'Сақшы раундтарын баптау', topics: 'Раунд тақырыптары', preset: 'Сандар жиыны', numbers: ['Бастапқы', 'Бірінші нұсқа', 'Екінші нұсқа'],
    boosts: 'Күшейтулерге рұқсат беру', link: 'Сынақ сілтемесі', copy: 'Сынақ сілтемесін көшіру', copied: 'Сілтеме көшірілді.', manual: 'Белгіленген сілтемені көшір.',
    lead: 'Оқушылар барлық тарауды аяқтаған соң сілтеме арқылы сынақты аша алады.', task: 'Мұғалімнің сынағы', finished: 'Тапсырманың барлық раундын шештің.',
    powers: 'Күшейтулер', example: 'Ұқсас мысалды талдау', plan: 'Шешу жоспарын ашу', used: 'Қолданылды',
    topicNames: { pizzas: 'Бөлшектер', prize: 'Пайыздар', map: 'Масштаб' },
    examples: { pizzas: '5 бәлішті 8 досқа тең бөлсек, әрқайсына бәліштің 5/8 бөлігі тиеді.', prize: 'Тауар 1 000 теңге тұрады. 10% жеңілдік — 100 теңге. Жаңа баға — 900 теңге.', map: '1 см 10 м-ді білдірсе, картадағы 2 см жердегі 2 × 10 = 20 м-ге тең.' },
    plans: { pizzas: 'Нені және неше адамға бөлетінін анықта. Алғашқы санды алымға, екіншісін бөлімге жаз.', prize: 'Бастапқы баға бойынша жеңілдік сомасын тап. Содан кейін оны бастапқы бағадан шегер.', map: 'Картадағы сантиметрлерді және бір сантиметрге сәйкес метрлерді тап. Көбейтіп, өлшем бірлігін тексер.' },
  },
}

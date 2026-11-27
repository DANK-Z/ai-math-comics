import type { BattleTopic, Lang } from './api/types'

// Where each bundled chapter sits in the school mathematics course of grades 5–6: the section
// and what the student learns to do. Shown in the reader, on season pages and on the teacher's
// class page, so a teacher can pick the chapter for a lesson. Official objective codes of the
// curriculum are not listed here: a teacher can match them to their own lesson plan.

type Text = Record<Lang, string>
const t = (ru: string, kk: string): Text => ({ ru, kk })

export interface CurriculumGoal {
  grade: 5 | 6
  section: Text
  goal: Text
}

const g = (grade: 5 | 6, section: Text, goal: Text): CurriculumGoal => ({ grade, section, goal })

const FRACTIONS = t('Обыкновенные дроби', 'Жай бөлшектер')
const PERCENT = t('Проценты', 'Пайыздар')
const SCALE = t('Масштаб', 'Масштаб')
const EQUATIONS = t('Уравнения', 'Теңдеулер')
const PROPORTION = t('Отношения и пропорции', 'Қатынастар мен пропорциялар')
const PERIMETER = t('Периметр и площадь', 'Периметр және аудан')
const MOTION = t('Задачи на движение', 'Қозғалысқа берілген есептер')
const COORDINATES = t('Координатная плоскость', 'Координаталық жазықтық')
const SYMMETRY = t('Симметрия', 'Симметрия')
const NEGATIVE = t('Положительные и отрицательные числа', 'Оң және теріс сандар')
const DATA = t('Графики и статистика', 'Графиктер және статистика')
const UNITS = t('Величины и единицы измерения', 'Шамалар және өлшем бірліктері')
const DIVISIBILITY = t('Делимость чисел', 'Сандардың бөлінгіштігі')
const VOLUME = t('Объём', 'Көлем')
const DECIMALS = t('Десятичные дроби', 'Ондық бөлшектер')

export const CURRICULUM: Readonly<Record<string, CurriculumGoal>> = {
  // Operation: School Fair
  'pizza-fractions': g(5, FRACTIONS, t('Записывать результат деления натуральных чисел обыкновенной дробью', 'Натурал сандарды бөлу нәтижесін жай бөлшекпен жазу')),
  'school-store-discount': g(5, PERCENT, t('Находить цену после скидки в процентах', 'Пайыздық жеңілдіктен кейінгі бағаны табу')),
  'school-quest-map': g(6, SCALE, t('Находить расстояние на местности по масштабу карты', 'Карта масштабы бойынша жердегі қашықтықты табу')),
  'library-boxes': g(5, EQUATIONS, t('Составлять и решать уравнение в два действия по условию задачи', 'Есептің шарты бойынша екі амалды теңдеу құрып, шешу')),
  'fair-lemonade': g(6, PROPORTION, t('Решать задачи на прямую пропорциональность', 'Тура пропорционалдыққа берілген есептерді шығару')),
  'fair-garland': g(5, PERIMETER, t('Находить периметр прямоугольника', 'Тіктөртбұрыштың периметрін табу')),
  // Fair Roads
  'roads-flag': g(5, MOTION, t('Решать задачи на движение вдогонку', 'Қуып жету қозғалысына берілген есептерді шығару')),
  'roads-bridge': g(5, MOTION, t('Решать задачи на встречное движение', 'Қарсы қозғалысқа берілген есептерді шығару')),
  'roads-river': g(5, MOTION, t('Находить скорость по течению и против течения', 'Ағыспен және ағысқа қарсы жылдамдықты табу')),
  'roads-hill': g(5, MOTION, t('Находить среднюю скорость на маршруте', 'Бағыттағы орташа жылдамдықты табу')),
  // Kokshetau Lights
  'lights-park': g(6, SCALE, t('Переводить расстояние с плана в реальное по масштабу', 'Масштаб бойынша жоспардағы қашықтықты шын қашықтыққа айналдыру')),
  'lights-launch': g(6, COORDINATES, t('Находить точку по её координатам', 'Нүктені координаталары бойынша табу')),
  'lights-garland': g(5, PERIMETER, t('Находить периметр фигуры с учётом свободного участка', 'Бос бөлігін ескеріп, фигураның периметрін табу')),
  'lights-kiosks': g(5, PERCENT, t('Сравнивать скидку в процентах и в тенге', 'Пайыздық және теңгелік жеңілдікті салыстыру')),
  // Museum After Hours
  'museum-mirror': g(6, SYMMETRY, t('Достраивать фигуру, симметричную относительно оси', 'Оське қатысты симметриялы фигураны салып бітіру')),
  'museum-tower': g(6, PROPORTION, t('Находить размеры объекта по масштабу модели', 'Модель масштабы бойынша нысанның өлшемдерін табу')),
  'museum-scales': g(5, EQUATIONS, t('Составлять уравнение по равновесию весов и решать его', 'Таразы тепе-теңдігі бойынша теңдеу құрып, шешу')),
  'museum-carpet': g(5, PERIMETER, t('Находить площадь прямоугольника и число плиток', 'Тіктөртбұрыштың ауданын және плитка санын табу')),
  // Tomorrow's Weather
  'weather-frost': g(6, NEGATIVE, t('Находить изменение температуры при переходе через ноль', 'Нөлден өткендегі температура өзгерісін табу')),
  'weather-rain': g(6, DATA, t('Читать данные с графика', 'Графиктен деректерді оқу')),
  'weather-units': g(5, UNITS, t('Переводить сантиметры в миллиметры', 'Сантиметрді миллиметрге айналдыру')),
  'weather-average': g(5, DATA, t('Находить среднее арифметическое ряда чисел', 'Сандар қатарының арифметикалық ортасын табу')),
  // Mars at Recess
  'mars-crater': g(6, COORDINATES, t('Находить длину пути по клеткам координатной сетки', 'Координаталық тордағы жолдың ұзындығын табу')),
  'mars-battery': g(5, FRACTIONS, t('Находить дробь от числа и от остатка', 'Саннан және қалдықтан бөлшек табу')),
  'mars-signal': g(5, UNITS, t('Складывать время в минутах и секундах', 'Минут пен секундтағы уақытты қосу')),
  'mars-greenhouse': g(6, PROPORTION, t('Делить величину в данном отношении', 'Шаманы берілген қатынаста бөлу')),
  // The Secret of Burabay
  'burabay-bus': g(5, DIVISIBILITY, t('Находить наименьшее общее кратное двух чисел', 'Екі санның ең кіші ортақ еселігін табу')),
  'burabay-water': g(5, VOLUME, t('Находить объём прямоугольного параллелепипеда и переводить см³ в литры', 'Тікбұрышты параллелепипедтің көлемін табу және см³-ті литрге айналдыру')),
  'burabay-trail': g(5, DECIMALS, t('Складывать десятичные дроби', 'Ондық бөлшектерді қосу')),
  'burabay-snacks': g(5, DIVISIBILITY, t('Находить наибольший общий делитель двух чисел', 'Екі санның ең үлкен ортақ бөлгішін табу')),
}

// Where the chapter's topic is in the most used textbook, Abylkasymova A.E. et al., «Мектеп»
// (grade 5 — 2017, grade 6 — 2018, part 1). Only chapters checked against the table of
// contents are listed; topics of part 2 (percent, decimals, volume, coordinates…) are not yet.
const TEXTBOOK: Readonly<Record<string, { grade: 5 | 6; section: number }>> = {
  'pizza-fractions': { grade: 5, section: 16 },
  'mars-battery': { grade: 5, section: 26 },
  'library-boxes': { grade: 5, section: 6 },
  'museum-scales': { grade: 5, section: 6 },
  'roads-flag': { grade: 5, section: 8 },
  'roads-bridge': { grade: 5, section: 8 },
  'roads-river': { grade: 5, section: 8 },
  'roads-hill': { grade: 5, section: 8 },
  'fair-garland': { grade: 5, section: 7 },
  'lights-garland': { grade: 5, section: 7 },
  'museum-carpet': { grade: 5, section: 7 },
  'burabay-bus': { grade: 5, section: 15 },
  'burabay-snacks': { grade: 5, section: 15 },
  'school-quest-map': { grade: 6, section: 5 },
  'lights-park': { grade: 6, section: 5 },
  'museum-tower': { grade: 6, section: 5 },
  'fair-lemonade': { grade: 6, section: 3 },
  'mars-greenhouse': { grade: 6, section: 1 },
  'weather-frost': { grade: 6, section: 15 },
}

/** «Абылкасымова, 5 кл., § 15» for a chapter checked against the textbook. */
export function textbookRef(comicId: string, lang: Lang): string | undefined {
  const ref = Object.hasOwn(TEXTBOOK, comicId) ? TEXTBOOK[comicId] : undefined
  if (!ref) return undefined
  // No-break spaces keep «5 кл.» and «§ 15» on one line.
  return lang === 'kk' ? `Әбілқасымова, ${ref.grade}-сынып, § ${ref.section}` : `Абылкасымова, ${ref.grade} кл., § ${ref.section}`
}

export function curriculumFor(comicId: string): CurriculumGoal | undefined {
  return Object.hasOwn(CURRICULUM, comicId) ? CURRICULUM[comicId] : undefined
}

export const CURRICULUM_COPY = {
  ru: {
    grade: (n: number) => `${n} класс`,
    goal: 'Цель урока',
    title: 'Главы по программе 5–6 классов',
    lead: 'Каждая глава — одна тема курса. Откройте нужную на уроке или дайте классу как домашнее задание.',
    open: 'Открыть главу',
    note: 'Разделы соответствуют курсу математики 5–6 классов. Коды целей обучения сверьте со своим планом урока.',
  },
  kk: {
    grade: (n: number) => `${n}-сынып`,
    goal: 'Сабақ мақсаты',
    title: '5–6-сынып бағдарламасы бойынша тараулар',
    lead: 'Әр тарау — курстың бір тақырыбы. Сабақта керегін ашыңыз немесе сыныпқа үй жұмысы ретінде беріңіз.',
    open: 'Тарауды ашу',
    note: 'Бөлімдер 5–6-сыныптардың математика курсына сәйкес. Оқу мақсаттарының кодтарын өз сабақ жоспарыңызбен салыстырыңыз.',
  },
}

/** The review drill that fits a chapter's section, if there is one. */
export function practiceTopicFor(comicId: string): BattleTopic | undefined {
  const section = curriculumFor(comicId)?.section
  if (section === FRACTIONS) return 'fractions'
  if (section === EQUATIONS) return 'equations'
  if (section === PROPORTION) return 'parts'
  if (section === DECIMALS) return 'decimals'
  if (section === DIVISIBILITY) return 'gcd'
  return undefined
}

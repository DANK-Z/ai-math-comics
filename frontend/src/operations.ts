import { useCallback, useRef, useState } from 'react'
import { LIGHTS_GARLAND_ID, LIGHTS_KIOSKS_ID, LIGHTS_LAUNCH_ID, LIGHTS_PARK_ID } from './api/lightsChapters'
import { MARS_BATTERY_ID, MARS_CRATER_ID, MARS_GREENHOUSE_ID, MARS_SIGNAL_ID } from './api/marsChapters'
import { MUSEUM_CARPET_ID, MUSEUM_MIRROR_ID, MUSEUM_SCALES_ID, MUSEUM_TOWER_ID } from './api/museumChapters'
import { ROADS_BRIDGE_ID, ROADS_FLAG_ID, ROADS_HILL_ID, ROADS_RIVER_ID } from './api/roadsChapters'
import type { Lang } from './api/types'
import { WEATHER_AVERAGE_ID, WEATHER_FROST_ID, WEATHER_RAIN_ID, WEATHER_UNITS_ID } from './api/weatherChapters'
import type { CharacterId } from './characters'
import { finaleHref } from './finales'

// Operations after the School Fair: five short seasons of four chapters and a finale.
// A chapter with `comicId` is playable; the others are announced on the season page until
// their comic is written. Progress is kept apart from the School Fair season.

type Text = Record<Lang, string>

export interface OperationChapter {
  number: number
  title: Text
  /** What happens in the story. */
  story: Text
  /** The math inside the story. */
  math: Text
  comicId?: string
  /** Transition line under the ending panel once the exercise is solved. */
  speaker?: CharacterId
  ending?: Text
}

export interface Operation {
  id: string
  icon: string
  title: Text
  lead: Text
  chapters: OperationChapter[]
  finale: { title: Text; story: Text; math: Text; href?: string }
  /** Optional practice open at any time, e.g. the Motion League for «Дороги ярмарки». */
  practice?: { title: Text; lead: Text; href: string }
}

const t = (ru: string, kk: string): Text => ({ ru, kk })

export const OPERATIONS: readonly Operation[] = [
  {
    id: 'roads',
    icon: '🚲',
    title: t('Операция «Дороги ярмарки»', '«Жәрмеңке жолдары» операциясы'),
    lead: t(
      'Сразу после ярмарки Хранитель Дорог даёт друзьям маршрут. Чтобы открыть финишные ворота, нужно собрать три отметки.',
      'Жәрмеңкеден кейін бірден Жолдар Сақшысы достарға бағыт береді. Мәре қақпасын ашу үшін үш белгі жинау керек.',
    ),
    chapters: [
      {
        number: 1,
        comicId: ROADS_FLAG_ID,
        title: t('Флажок на колёсах', 'Дөңгелектегі жалауша'),
        story: t('Алдияр уехал вперёд с флажком для отметки. Аруна догоняет его.', 'Алдияр белгі жалаушасымен алға кетті. Аруна оны қуып жетпек.'),
        math: t('Движение вдогонку', 'Қуып жету қозғалысы'),
        speaker: 'aldiyar',
        ending: t('Первая отметка есть! Теперь к мосту — Пифик готовит встречу.', 'Алғашқы белгі бар! Енді көпірге — Пифик кездесу дайындап жатыр.'),
      },
      {
        number: 2,
        comicId: ROADS_BRIDGE_ID,
        title: t('Встреча у моста', 'Көпір жанындағы кездесу'),
        story: t('Друзья стартуют с разных концов дорожки. Пифик ждёт их там, где они поравняются.', 'Достар жолдың екі шетінен шығады. Пифик оларды кездесетін жерде күтеді.'),
        math: t('Встречное движение', 'Қарсы қозғалыс'),
        speaker: 'pifik',
        ending: t('Вторая отметка! Призы уже ждут лодку у реки.', 'Екінші белгі! Сыйлықтар өзен жағасында қайықты күтіп тұр.'),
      },
      {
        number: 3,
        comicId: ROADS_RIVER_ID,
        title: t('Река с характером', 'Мінезді өзен'),
        story: t('По течению лодка идёт быстро, а обратно едва успевает к закрытию причала.', 'Ағыспен қайық жылдам жүреді, ал кері қайтқанда айлақ жабылуына әрең үлгереді.'),
        math: t('Скорость по течению и против течения', 'Ағыспен және ағысқа қарсы жылдамдық'),
        speaker: 'aruna',
        ending: t('Третья отметка! Осталось проверить рекорд Алдияра на горке.', 'Үшінші белгі! Енді Алдиярдың төбедегі рекордын тексеру қалды.'),
      },
      {
        number: 4,
        comicId: ROADS_HILL_ID,
        title: t('Быстро только с горки', 'Тек төбеден ғана жылдам'),
        story: t('Алдияр уверен, что побил рекорд. Аруна просит учесть и медленный подъём.', 'Алдияр рекорд жаңарттым деп сенімді. Аруна баяу өрлеуді де ескеруді сұрайды.'),
        math: t('Средняя скорость', 'Орташа жылдамдық'),
        speaker: 'pifik',
        ending: t('Все отметки собраны. Финишные ворота ждут — и Хранитель Дорог тоже!', 'Барлық белгі жиналды. Мәре қақпасы күтіп тұр — Жолдар Сақшысы да!'),
      },
    ],
    finale: {
      title: t('Три замка Хранителя', 'Сақшының үш құлпы'),
      story: t('Каждый верный ответ зажигает фонарь на финишных воротах, а три фонаря открывают путь на ярмарку.', 'Әр дұрыс жауап мәре қақпасындағы шамды жағады, ал үш шам жәрмеңкеге жол ашады.'),
      math: t('Погоня, встреча и течение', 'Қуу, кездесу және ағыс'),
      href: '#/road-guardian',
    },
    practice: {
      title: t('Лига движения', 'Қозғалыс лигасы'),
      lead: t('Тренировка задач на движение — открыта в любое время.', 'Қозғалысқа есептер жаттығуы — кез келген уақытта ашық.'),
      href: '#/motion-league',
    },
  },
  {
    id: 'lights',
    icon: '🏙️',
    title: t('Операция «Огни Кокшетау»', '«Көкшетау шамдары» операциясы'),
    lead: t(
      'Друзья готовят вечерний праздник у озера. В городе уже зажигаются огни, а сцена ещё тёмная: нет ни декораций, ни света.',
      'Достар көл жағасындағы кешкі мерекеге дайындалып жатыр. Қалада шамдар жанып жатыр, ал сахна әлі қараңғы: безендіру де, жарық та жоқ.',
    ),
    chapters: [
      {
        number: 1, comicId: LIGHTS_PARK_ID, title: t('Парк на ладони', 'Алақандағы саябақ'), story: t('Аруна находит короткий путь к сцене на маленькой карте.', 'Аруна шағын картадан сахнаға апаратын қысқа жол табады.'), math: t('Масштаб', 'Масштаб'),
        speaker: 'aruna', ending: t('Декорации у сцены! Теперь найдём пульт, который зажигает огни.', 'Безендіру сахнада! Енді шамдарды жағатын пультті табайық.'),
      },
      {
        number: 2, comicId: LIGHTS_LAUNCH_ID, title: t('Точка запуска', 'Іске қосу нүктесі'), story: t('Пифик передаёт координаты нужного пульта, пока Алдияр идёт к первому попавшемуся.', 'Алдияр алғашқы пультке бара жатқанда, Пифик керек пульттің координаттарын айтады.'), math: t('Координатная сетка', 'Координаттық тор'),
        speaker: 'pifik', ending: t('Пульт готов. Осталось обвести сцену гирляндой.', 'Пульт дайын. Енді сахнаны шамтізбемен қоршау қалды.'),
      },
      {
        number: 3, comicId: LIGHTS_GARLAND_ID, title: t('Гирлянда с запасом', 'Қоры бар шамтізбе'), story: t('Сцену обводят огнями, оставив свободным вход для музыкантов.', 'Музыканттардың кіретін жерін бос қалдырып, сахнаны шаммен қоршайды.'), math: t('Периметр', 'Периметр'),
        speaker: 'aldiyar', ending: t('Гирлянда на месте! А на световую мозаику огоньков не хватает — идём к киоскам.', 'Шамтізбе орнында! Ал жарық мозаикасына шам жетпейді — дүңгіршектерге барайық.'),
      },
      {
        number: 4, comicId: LIGHTS_KIOSKS_ID, title: t('Два киоска, две скидки', 'Екі дүңгіршек, екі жеңілдік'), story: t('Скидка в процентах или в тенге — бюджета хватит только при удачном выборе.', 'Пайыздық па, теңгелік пе — бюджет тек дұрыс таңдауда жетеді.'), math: t('Проценты', 'Пайыздар'),
        speaker: 'pifik', ending: t('Всё готово к празднику! Осталось включить световую мозаику на сцене.', 'Мерекеге бәрі дайын! Енді сахнадағы жарық мозаикасын қосу қалды.'),
      },
    ],
    finale: {
      title: t('Последний свет', 'Соңғы жарық'),
      story: t('С каждым верным ответом загорается часть световой мозаики.', 'Әр дұрыс жауап сайын жарық мозаикасының бір бөлігі жанады.'),
      math: t('Площадь, дроби и проценты', 'Аудан, бөлшектер және пайыздар'),
      href: finaleHref('lights'),
    },
  },
  {
    id: 'museum',
    icon: '🏛️',
    title: t('Операция «Музей после закрытия»', '«Жабылғаннан кейінгі мұражай» операциясы'),
    lead: t(
      'Перед школьной экскурсией Пифик помогает проверить новую выставку. Архив выдаёт по одной улике в каждом зале.',
      'Мектеп экскурсиясы алдында Пифик жаңа көрмені тексеруге көмектеседі. Мұрағат әр залда бір айғақ береді.',
    ),
    chapters: [
      { number: 1, comicId: MUSEUM_MIRROR_ID, speaker: 'aruna', ending: t('Первая улика у нас! Следующий зал — с башней в витрине.', 'Алғашқы айғақ бізде! Келесі зал — витринадағы мұнарасы бар зал.'), title: t('Узор в разбитом зеркале', 'Сынған айнадағы өрнек'), story: t('Половина орнамента исчезла. Его нужно восстановить по уцелевшей части.', 'Өрнектің жартысы жоғалған. Оны қалған бөлігі бойынша қалпына келтіру керек.'), math: t('Осевая симметрия', 'Осьтік симметрия') },
      { number: 2, comicId: MUSEUM_TOWER_ID, speaker: 'pifik', ending: t('Вторая улика найдена. Архив зовёт в зал со старинными весами.', 'Екінші айғақ табылды. Мұрағат ескі таразы тұрған залға шақырады.'), title: t('Башня в витрине', 'Витринадағы мұнара'), story: t('Аудиогид спрашивает, какой была бы башня в натуральную величину.', 'Аудиогид мұнараның шын өлшемі қандай болатынын сұрайды.'), math: t('Отношения и масштаб', 'Қатынастар және масштаб') },
      { number: 3, comicId: MUSEUM_SCALES_ID, speaker: 'aldiyar', ending: t('Ключ у нас! Он открывает зал с пустой рамой.', 'Кілт бізде! Ол бос жақтауы бар залды ашады.'), title: t('Весы без гирь', 'Кірсіз таразы'), story: t('На чашах одинаковые фигурки и известные грузы.', 'Таразы табақтарында бірдей мүсіншелер мен белгілі жүктер.'), math: t('Уравнение', 'Теңдеу') },
      { number: 4, comicId: MUSEUM_CARPET_ID, speaker: 'pifik', ending: t('Все улики собраны. За панно — вход в зал, которого нет на карте!', 'Барлық айғақ жиналды. Панноның артында — картада жоқ залдың кіреберісі!'), title: t('Ковёр для выставки', 'Көрмеге арналған кілем'), story: t('Из цветных квадратов собирают панно, чтобы оно поместилось в раму.', 'Түрлі түсті шаршылардан жақтауға сыятын панно құрастырады.'), math: t('Площадь', 'Аудан') },
    ],
    finale: {
      title: t('Зал, которого нет на карте', 'Картада жоқ зал'),
      story: t('Улики открывают секретный зал с незавершённой выставкой школьников.', 'Айғақтар оқушылардың аяқталмаған көрмесі бар құпия залды ашады.'),
      math: t('План зала: площадь, стены и витрины', 'Зал жоспары: аудан, қабырғалар және витриналар'),
      href: finaleHref('museum'),
    },
  },
  {
    id: 'weather',
    icon: '🌦️',
    title: t('Операция «Погода на завтра»', '«Ертеңгі ауа райы» операциясы'),
    lead: t(
      'Школьная метеостанция перестала давать прогноз. Друзья собирают данные вручную, чтобы выбрать место для праздника.',
      'Мектеп метеостансасы болжам беруді тоқтатты. Достар мереке орнын таңдау үшін деректерді қолмен жинайды.',
    ),
    chapters: [
      { number: 1, comicId: WEATHER_FROST_ID, speaker: 'pifik', ending: t('Первая запись в журнале! Теперь разберёмся с дождём по графику самописца.', 'Журналдағы алғашқы жазба! Енді жаңбырды құралдың графигі бойынша анықтайық.'), title: t('Утро ниже нуля', 'Нөлден төмен таң'), story: t('Утром −4 °C, к обеду +6 °C. Алдияр считает, что потеплело на два градуса.', 'Таңертең −4 °C, түске қарай +6 °C. Алдияр екі градусқа жылыды деп ойлайды.'), math: t('Отрицательные числа', 'Теріс сандар') },
      { number: 2, comicId: WEATHER_RAIN_ID, speaker: 'aruna', ending: t('Ливень отмечен. А теперь сверим дождемеры двух команд.', 'Нөсер белгіленді. Енді екі топтың өлшегіштерін салыстырайық.'), title: t('В какой час пришёл дождь?', 'Жаңбыр қай сағатта келді?'), story: t('По графику самописца друзья ищут, когда дождь усилился и закончился.', 'Өздігінен жазатын құралдың графигі бойынша достар жаңбырдың қашан күшейіп, қашан тоқтағанын іздейді.'), math: t('Чтение графика', 'Графикті оқу') },
      { number: 3, comicId: WEATHER_UNITS_ID, speaker: 'pifik', ending: t('Все данные в миллиметрах. Осталось подвести итог недели.', 'Барлық дерек миллиметрмен. Енді аптаның қорытындысын шығару қалды.'), title: t('Два ведра и одна шкала', 'Екі шелек, бір шкала'), story: t('Одна команда записала осадки в миллиметрах, другая — в сантиметрах.', 'Бір топ жауын-шашынды миллиметрмен, екіншісі сантиметрмен жазды.'), math: t('Единицы измерения', 'Өлшем бірліктері') },
      { number: 4, comicId: WEATHER_AVERAGE_ID, speaker: 'aldiyar', ending: t('Журнал погоды готов. Пора решать, где ставить сцену!', 'Ауа райы журналы дайын. Сахнаны қайда қоятынымызды шешетін кез келді!'), title: t('Тёплый день в холодной неделе', 'Суық аптадағы жылы күн'), story: t('Одна температура за неделю может исказить впечатление.', 'Аптаға бір температура жаңылыстыруы мүмкін.'), math: t('Среднее арифметическое', 'Арифметикалық орта') },
    ],
    finale: {
      title: t('Где ставить сцену?', 'Сахнаны қайда қоямыз?'),
      story: t('Прогноз сравнивают с условиями для открытой площадки и выбирают место.', 'Болжамды ашық алаңның шарттарымен салыстырып, орын таңдайды.'),
      math: t('Дождь, ветер и места: решение по условиям', 'Жаңбыр, жел және орындар: шарт бойынша шешім'),
      href: finaleHref('weather'),
    },
  },
  {
    id: 'mars',
    icon: '🚀',
    title: t('Операция «Марс на перемене»', '«Үзілістегі Марс» операциясы'),
    lead: t(
      'Для школьного фестиваля друзья запускают симулятор марсианской базы. Нужно вернуть марсоход к станции.',
      'Мектеп фестивалі үшін достар Марс базасының симуляторын іске қосады. Марсоходты бекетке қайтару керек.',
    ),
    chapters: [
      { number: 1, comicId: MARS_CRATER_ID, speaker: 'aldiyar', ending: t('Кратер позади. Но индикатор заряда уже мигает…', 'Кратер артта қалды. Бірақ заряд индикаторы жыпылықтай бастады…'), title: t('Объезд кратера', 'Кратерді айналып өту'), story: t('Прямая дорога закрыта, а заряда хватит только на один объезд.', 'Тура жол жабық, ал заряд тек бір айналма жолға жетеді.'), math: t('Координаты и расстояния по сетке', 'Тордағы координаттар мен қашықтықтар') },
      { number: 2, comicId: MARS_BATTERY_ID, speaker: 'pifik', ending: t('Заряда хватит. Отправляем марсоходу команду «Вперёд»!', 'Заряд жетеді. Марсоходқа «Алға» командасын жібереміз!'), title: t('Батарея на исходе', 'Батарея таусылып барады'), story: t('Четверть заряда ушла на подъём, ещё треть остатка — на объезд.', 'Зарядтың төрттен бірі өрлеуге, қалғанының үштен бірі айналма жолға кетті.'), math: t('Дроби', 'Бөлшектер') },
      { number: 3, comicId: MARS_SIGNAL_ID, speaker: 'aruna', ending: t('Подтверждение пришло! Пока марсоход едет, заглянем в теплицу базы.', 'Растау келді! Марсоход жүріп келе жатқанда, базаның жылыжайына кіріп шығайық.'), title: t('Сигнал с задержкой', 'Кешігетін сигнал'), story: t('Алдияр считает только время отправки, забыв про обратный сигнал.', 'Алдияр кері сигналды ұмытып, тек жіберу уақытын есептейді.'), math: t('Сложение времени, минуты и секунды', 'Уақытты қосу, минут пен секунд') },
      { number: 4, comicId: MARS_GREENHOUSE_ID, speaker: 'aldiyar', ending: t('Марсоход у станции. Осталась самая сложная часть — стыковка вслепую!', 'Марсоход бекеттің жанында. Ең қиын бөлігі қалды — соқыр түйісу!'), title: t('Теплица на шестерых', 'Алты адамдық жылыжай'), story: t('Урожай делят между экипажем и запасом на завтра.', 'Өнімді экипаж бен ертеңгі қор арасында бөледі.'), math: t('Пропорции', 'Пропорциялар') },
    ],
    finale: {
      title: t('Стыковка вслепую', 'Соқыр түйісу'),
      story: t('Каждый верный ответ — выравнивание, открытие ворот или подключение зарядки.', 'Әр дұрыс жауап — түзету, қақпаны ашу немесе зарядты қосу.'),
      math: t('Три задачи по пройденным темам', 'Өтілген тақырыптар бойынша үш есеп'),
    },
  },
]

const byComicId = new Map(
  OPERATIONS.flatMap((operation) => operation.chapters
    .filter((chapter) => chapter.comicId)
    .map((chapter) => [chapter.comicId!, { operation, chapter }] as const)),
)

export function operationHref(id: string) {
  return `#/operation/${id}`
}

/** Chapters of an operation the student still has to solve before its finale opens. */
export function chaptersLeft(id: string, completed: ReadonlySet<string>): number {
  const operation = findOperation(id)
  return operation ? operation.chapters.filter((c) => !c.comicId || !completed.has(c.comicId)).length : 0
}

/** Locked-finale copy shared by the operation finales. */
export const FINALE_LOCK = {
  ru: { locked: 'Финал откроется, когда пройдёшь все главы операции.', left: (n: number) => `Осталось глав: ${n}` },
  kk: { locked: 'Финал операцияның барлық тарауынан өткен соң ашылады.', left: (n: number) => `Қалған тараулар: ${n}` },
}

export function findOperation(id: string): Operation | undefined {
  return OPERATIONS.find((operation) => operation.id === id)
}

/** The operation chapter behind a comic, with its ending line and the next stop. */
export function operationChapter(comicId: string) {
  const found = byComicId.get(comicId)
  if (!found) return undefined
  const { operation, chapter } = found
  const next = operation.chapters.find((c) => c.number === chapter.number + 1)
  return {
    operation,
    chapter,
    speaker: chapter.speaker ?? 'pifik' as CharacterId,
    ending: chapter.ending ?? operation.lead,
    nextComicId: next?.comicId,
    /** Where the last chapter leads: the finale, or the season page while it is not ready. */
    doneHref: operation.finale.href ?? operationHref(operation.id),
  }
}

const STORAGE_KEY = 'amc.operations.completed'

function readCompleted(): ReadonlySet<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(saved)) return new Set(saved.filter((id): id is string => typeof id === 'string' && byComicId.has(id)))
  } catch {
    // A bad or inaccessible save starts with empty progress.
  }
  return new Set()
}

/** Completed operation chapters, saved in this browser (and merged from the server for students). */
export function useOperationProgress() {
  const [completed, setCompleted] = useState(readCompleted)
  const current = useRef(completed)
  const save = useCallback((ids: readonly string[]) => {
    const known = ids.filter((id) => byComicId.has(id) && !current.current.has(id))
    if (known.length === 0) return false
    const next = new Set([...current.current, ...readCompleted(), ...known])
    current.current = next
    setCompleted(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    } catch {
      // Keep progress in memory for this visit.
    }
    return true
  }, [])
  const complete = useCallback((comicId: string) => save([comicId]), [save])
  return { completed, complete, merge: save }
}

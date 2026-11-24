import { expect, test, type Page } from '@playwright/test'

// Key journeys in demo mode: reading and solving a chapter, coins and secrets, review drills,
// a class battle from the teacher's board to a student's phone, and the night theme.

/** Demo accounts in this browser: a teacher with class 5 «А» and one student in it. */
async function seed(page: Page, as: 'student' | 'teacher' | 'guest') {
  await page.addInitScript((role) => {
    if (sessionStorage.getItem('e2e-seeded')) return
    sessionStorage.setItem('e2e-seeded', '1')
    localStorage.clear()
    localStorage.setItem('amc.mock.accounts', JSON.stringify({
      users: [
        { id: 1, role: 'student', login: 'aruna_e2e', displayName: 'Аруна Омарова', password: 'e2e-pass-123', classId: 1, completedChapters: [], stickers: [] },
        { id: 2, role: 'teacher', email: 'teacher@e2e.test', displayName: 'Айгуль Серикова', password: 'e2e-pass-123', completedChapters: [], stickers: [] },
      ],
      classes: [{ id: 1, teacherId: 2, name: '5 «А»', grade: 5, code: 'E2E-5A-2026', students: 1 }],
    }))
    if (role !== 'guest') localStorage.setItem('amc.auth.token', role === 'student' ? 'mock-1' : 'mock-2')
  }, as)
}

/** Solves "x + a = b" or "a · x = b" from a battle or drill prompt. */
function solveEquation(prompt: string): string {
  const add = /x \+ (\d+) = (\d+)/.exec(prompt)
  if (add) return String(Number(add[2]) - Number(add[1]))
  const mul = /(\d+) · x = (\d+)/.exec(prompt)
  if (mul) return String(Number(mul[2]) / Number(mul[1]))
  throw new Error(`unexpected prompt: ${prompt}`)
}

async function openExercise(page: Page) {
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Далее', exact: true }).click()
}

test('a guest reads a chapter, gets a targeted hint and unlocks the ending', async ({ page }) => {
  await seed(page, 'guest')
  await page.goto('/#/comic/roads-flag')
  await expect(page.getByText(/Салем! Нам нужна твоя помощь/)).toBeVisible()
  await expect(page.getByText(/Цель урока: решать задачи на движение вдогонку/)).toBeVisible()
  await openExercise(page)
  const answer = page.getByLabel('Твой ответ')
  await answer.fill('7')
  await page.getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByRole('button', { name: 'Далее', exact: true })).toBeDisabled()
  await answer.fill('4')
  await page.getByRole('button', { name: 'Проверить' }).click()
  await page.getByRole('button', { name: 'Далее', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Следующая глава' })).toBeVisible()
  await expect(page.getByText('Войди как ученик, чтобы получать монеты')).toBeVisible()
})

test('a student earns coins once for a chapter and once for a secret', async ({ page }) => {
  await seed(page, 'student')
  await page.goto('/#/comic/roads-flag')
  const coins = page.getByRole('link', { name: /Монеты: \d+/ })
  await expect(coins).toHaveAccessibleName(/Монеты: 120/)
  await expect(page.getByText(/Салем, Аруна!/)).toBeVisible()

  await page.getByRole('button', { name: 'Здесь что-то спрятано' }).click()
  await expect(page.getByText(/Секрет найден: рисунок велосипеда/)).toBeVisible()
  await expect(coins).toHaveAccessibleName(/Монеты: 125/)

  await openExercise(page)
  await page.getByLabel('Твой ответ').fill('4')
  await page.getByRole('button', { name: 'Проверить' }).click()
  await expect(coins).toHaveAccessibleName(/Монеты: 130/)

  // A reload and a replay pay nothing more.
  await page.reload()
  await expect(coins).toHaveAccessibleName(/Монеты: 130/)
  await expect(page.getByRole('button', { name: 'Здесь что-то спрятано' })).toHaveCount(0)
})

test('a student repeats a weak spot in a five-problem drill', async ({ page }) => {
  await seed(page, 'student')
  await page.goto('/')
  await page.getByRole('link', { name: /Тренироваться/ }).click()
  await expect(page.getByRole('heading', { name: /Тренировка/ })).toBeVisible()
  for (let n = 1; n <= 5; n++) {
    await expect(page.getByText(`Задача ${n} из 5`)).toBeVisible()
    const prompt = await page.locator('form p').first().innerText()
    await page.getByLabel('Твой ответ').fill(solveEquation(prompt))
    await page.getByRole('button', { name: 'Проверить' }).click()
  }
  await expect(page.getByText('Тренировка пройдена! Тема закреплена.')).toBeVisible()
})

test('a class battle: the teacher starts it, a student hits the boss @phone', async ({ page }) => {
  await seed(page, 'teacher')
  await page.goto('/#/teacher/class/1')
  await page.getByRole('button', { name: 'Бои и лига' }).click()
  await page.getByRole('button', { name: /300 HP/ }).click()
  await page.getByRole('button', { name: 'Запустить на доске' }).click()
  await expect(page.getByText(/Код класса: E2E-5A-2026/)).toBeVisible()
  const boardUrl = page.url()

  // The same browser switches to the student (demo accounts live in this browser).
  await page.evaluate(() => localStorage.setItem('amc.auth.token', 'mock-1'))
  await page.goto('/')
  await page.reload()
  await page.getByRole('link', { name: /В бой/ }).click()
  const prompt = await page.locator('form p').first().innerText()
  await page.getByLabel('Твой ответ').fill(solveEquation(prompt))
  await page.getByRole('button', { name: /Ударить/ }).click()
  await expect(page.getByText(/Попадание! −10 HP/)).toBeVisible()
  await expect(page.getByText('Твои удары: 1')).toBeVisible()

  await page.evaluate(() => localStorage.setItem('amc.auth.token', 'mock-2'))
  await page.reload()
  await page.goto(boardUrl)
  await expect(page.getByText('Аруна О.').first()).toBeVisible()
})

test('the night theme switches the whole site and is remembered', async ({ page }) => {
  await seed(page, 'guest')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Включить ночную тему' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Включить светлую тему' }).click()
  await expect(html).toHaveAttribute('data-theme', 'light')
})

test('a teacher makes a student account; the student signs in from the battle QR link', async ({ page }) => {
  await seed(page, 'teacher')
  await page.goto('/#/teacher/class/1')
  await page.getByRole('button', { name: 'Ученики', exact: true }).click()
  await page.getByLabel('Имена учеников').fill('Әлия Сапарова')
  await page.getByRole('button', { name: 'Создать аккаунты' }).click()
  const row = page.getByRole('row', { name: /Әлия Сапарова/ })
  await expect(row).toBeVisible()
  const [, login, password] = await row.getByRole('cell').allInnerTexts()
  expect(login).toMatch(/^aliya\d{3}$/)

  // The teacher signs out; the student scans the QR (opens #/battle), signs in, lands in the battle.
  await page.evaluate(() => localStorage.removeItem('amc.auth.token'))
  await page.reload()
  await page.goto('/#/battle')
  await expect(page).toHaveURL(/#\/login$/)
  await page.getByLabel('Логин (или почта учителя)').fill(login)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).last().click()
  await expect(page).toHaveURL(/#\/battle$/)
  await expect(page.getByRole('heading', { name: 'Классный батл' })).toBeVisible()
})

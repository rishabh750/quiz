import { parseQuestions } from '../lib/quizFormat.js'

const COURSES_KEY = 'ip_courses'
const ANSWERS_KEY = 'ip_answers'
const ARCHIVE_KEY = 'ip_archive'

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {}
  } catch {
    return {}
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    throw new Error(
      e && e.name === 'QuotaExceededError'
        ? 'Browser storage is full — delete or archive some courses.'
        : 'Could not save to browser storage.'
    )
  }
}

const names = (store) => Object.keys(store).filter((n) => store[n] && store[n].txt).sort()

export async function getCourses() {
  return names(load(COURSES_KEY))
}

export async function uploadCourseFile(filename, content) {
  const base = String(filename).split(/[\\/]/).pop()
  if (!/\.(txt|md)$/i.test(base)) throw new Error('only .txt and .md files are allowed')
  const name = base.replace(/\.(txt|md)$/i, '')
  const isMd = /\.md$/i.test(base)
  const courses = load(COURSES_KEY)
  courses[name] = courses[name] || {}
  courses[name][isMd ? 'md' : 'txt'] = String(content ?? '')
  save(COURSES_KEY, courses)
  return { saved: base }
}

export async function getQuestions(course) {
  const entry = load(COURSES_KEY)[course]
  return entry && entry.txt ? parseQuestions(entry.txt) : []
}

export async function getNotes(course) {
  const entry = load(COURSES_KEY)[course]
  const md = entry && entry.md
  return { exists: !!md, content: md || '' }
}

export async function getAnswers(course) {
  return load(ANSWERS_KEY)[course] || []
}

export async function saveAnswer(course, { questionNumber, candidateAnswer, marks }) {
  const store = load(ANSWERS_KEY)
  const list = store[course] ? store[course].slice() : []
  const row = {
    questionNumber: String(questionNumber),
    candidateAnswer: String(candidateAnswer),
    marks: Number(marks) || 0,
  }
  const idx = list.findIndex((a) => a.questionNumber === row.questionNumber)
  if (idx >= 0) list[idx] = row
  else list.push(row)
  store[course] = list
  save(ANSWERS_KEY, store)
  return list
}

export async function resetAnswers(course, questionNumbers) {
  const store = load(ANSWERS_KEY)
  if (questionNumbers) {
    const drop = new Set(questionNumbers.map(String))
    const remaining = (store[course] || []).filter((a) => !drop.has(String(a.questionNumber)))
    if (remaining.length) store[course] = remaining
    else delete store[course]
    save(ANSWERS_KEY, store)
    return remaining
  }
  delete store[course]
  save(ANSWERS_KEY, store)
  return []
}

export async function getArchive() {
  return names(load(ARCHIVE_KEY))
}

export async function archiveCourse(course) {
  const courses = load(COURSES_KEY)
  const archive = load(ARCHIVE_KEY)
  if (courses[course]) {
    archive[course] = courses[course]
    delete courses[course]
    save(ARCHIVE_KEY, archive)
    save(COURSES_KEY, courses)
  }
  const answers = load(ANSWERS_KEY)
  delete answers[course]
  save(ANSWERS_KEY, answers)
  return { archived: course, archive: names(archive) }
}

export async function reviveCourse(course) {
  const courses = load(COURSES_KEY)
  const archive = load(ARCHIVE_KEY)
  if (archive[course]) {
    courses[course] = archive[course]
    delete archive[course]
    save(COURSES_KEY, courses)
    save(ARCHIVE_KEY, archive)
  }
  return { revived: course, archive: names(archive) }
}

export async function purgeCourse(course) {
  const archive = load(ARCHIVE_KEY)
  if (archive[course]) {
    delete archive[course]
    save(ARCHIVE_KEY, archive)
  }
  const answers = load(ANSWERS_KEY)
  if (answers[course]) {
    delete answers[course]
    save(ANSWERS_KEY, answers)
  }
  return { purged: course, archive: names(archive) }
}

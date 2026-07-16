import { apiFetch } from '../auth.js'

const enc = encodeURIComponent
const json = (res) => res.json()

export async function getCourses() {
  return apiFetch('/api/courses').then(json)
}

export async function uploadCourseFile(filename, content) {
  return apiFetch('/api/courses', {
    method: 'POST',
    body: JSON.stringify({ filename, content }),
  }).then(json)
}

export async function getQuestions(course) {
  return apiFetch('/api/courses/' + enc(course) + '/questions').then(json)
}

export async function getNotes(course) {
  return apiFetch('/api/courses/' + enc(course) + '/notes').then(json)
}

export async function getAnswers(course) {
  return apiFetch('/api/answers/' + enc(course)).then(json)
}

export async function saveAnswer(course, payload) {
  return apiFetch('/api/answers/' + enc(course), {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(json)
}

export async function resetAnswers(course, questionNumbers) {
  return apiFetch('/api/answers/' + enc(course), {
    method: 'DELETE',
    body: JSON.stringify(questionNumbers ? { questionNumbers } : {}),
  }).then(json)
}

export async function getArchive() {
  return apiFetch('/api/archive').then(json)
}

export async function archiveCourse(course) {
  return apiFetch('/api/archive/' + enc(course), { method: 'POST' }).then(json)
}

export async function reviveCourse(course) {
  return apiFetch('/api/archive/' + enc(course) + '/revive', { method: 'POST' }).then(json)
}

export async function purgeCourse(course) {
  return apiFetch('/api/archive/' + enc(course), { method: 'DELETE' }).then(json)
}

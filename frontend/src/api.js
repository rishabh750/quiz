import { apiFetch } from './auth.js'

const enc = encodeURIComponent
const json = (res) => res.json()

export const getCourses = () => apiFetch('/api/courses').then(json)

export const uploadCourseFile = (filename, content) =>
  apiFetch('/api/courses', { method: 'POST', json: { filename, content } }).then(json)

export const getQuestions = (course) =>
  apiFetch('/api/courses/' + enc(course) + '/questions').then(json)

export const getNotes = (course) => apiFetch('/api/courses/' + enc(course) + '/notes').then(json)

export const getAnswers = (course) => apiFetch('/api/answers/' + enc(course)).then(json)

export const saveAnswer = (course, payload) =>
  apiFetch('/api/answers/' + enc(course), { method: 'POST', json: payload }).then(json)

export const resetAnswers = (course, questionNumbers) =>
  apiFetch('/api/answers/' + enc(course), {
    method: 'DELETE',
    json: questionNumbers ? { questionNumbers } : {},
  }).then(json)

export const getArchive = () => apiFetch('/api/archive').then(json)

export const archiveCourse = (course) =>
  apiFetch('/api/archive/' + enc(course), { method: 'POST' }).then(json)

export const reviveCourse = (course) =>
  apiFetch('/api/archive/' + enc(course) + '/revive', { method: 'POST' }).then(json)

export const purgeCourse = (course) =>
  apiFetch('/api/archive/' + enc(course), { method: 'DELETE' }).then(json)

const json = (r) => {
  if (!r.ok) throw new Error('request failed: ' + r.status)
  return r.json()
}

export const getCourses = () => fetch('/api/courses').then(json)

export const uploadCourseFile = (filename, content) =>
  fetch('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content }),
  }).then(json)

export const getQuestions = (course) =>
  fetch('/api/courses/' + encodeURIComponent(course)).then(json)

export const getAnswers = (course) =>
  fetch('/api/answers/' + encodeURIComponent(course)).then(json)

export const getNotes = (course) =>
  fetch('/api/notes/' + encodeURIComponent(course)).then(json)

export const getArchive = () => fetch('/api/archive').then(json)

export const archiveCourse = (course) =>
  fetch('/api/archive/' + encodeURIComponent(course), { method: 'POST' }).then(json)

export const reviveCourse = (course) =>
  fetch('/api/archive/' + encodeURIComponent(course) + '/revive', { method: 'POST' }).then(json)

// Reset all attempts for a course, or only specific questions when
// questionNumbers is provided (per-section reset).
export const resetAnswers = (course, questionNumbers) =>
  fetch('/api/answers/' + encodeURIComponent(course), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(questionNumbers ? { questionNumbers } : {}),
  }).then(json)

export const saveAnswer = (course, payload) =>
  fetch('/api/answers/' + encodeURIComponent(course), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(json)

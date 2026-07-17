import { IS_DESKTOP } from './mode.js'
import * as local from './backends/local.js'
import * as remote from './backends/remote.js'

const backend = IS_DESKTOP ? local : remote

export const getCourses = (...a) => backend.getCourses(...a)
export const uploadCourseFile = (...a) => backend.uploadCourseFile(...a)
export const getQuestions = (...a) => backend.getQuestions(...a)
export const getNotes = (...a) => backend.getNotes(...a)
export const getAnswers = (...a) => backend.getAnswers(...a)
export const saveAnswer = (...a) => backend.saveAnswer(...a)
export const resetAnswers = (...a) => backend.resetAnswers(...a)
export const getArchive = (...a) => backend.getArchive(...a)
export const archiveCourse = (...a) => backend.archiveCourse(...a)
export const reviveCourse = (...a) => backend.reviveCourse(...a)
export const purgeCourse = (...a) => backend.purgeCourse(...a)

import path from 'node:path'
import apiModule from './server/api.cjs'

const { createApiHandler } = apiModule

export default function quizApiPlugin() {
  return {
    name: 'quiz-api',
    configureServer(server) {
      const root = server.config.root
      const handle = createApiHandler({
        courseDir: path.join(root, 'course'),
        answersDir: path.join(root, 'answers'),
        archiveDir: path.join(root, 'archive'),
      })
      server.middlewares.use((req, res, next) => {
        handle(req, res).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}

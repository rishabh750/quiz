import path from 'node:path'

export default function quizApiPlugin() {
  return {
    name: 'quiz-api',
    async configureServer(server) {
      const { createApiHandler } = (await import('./server/api.cjs')).default
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

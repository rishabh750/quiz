const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { createApiHandler } = require('../server/api.cjs')

// Where the built frontend lives (bundled inside the app).
const distDir = path.join(app.getAppPath(), 'dist')

// Course/answers/archive live in a writable, user-visible location. In a
// packaged app that's the per-user data folder; in dev it's the project root.
const dataDir = app.isPackaged ? app.getPath('userData') : path.join(__dirname, '..')
const courseDir = path.join(dataDir, 'course')
const answersDir = path.join(dataDir, 'answers')
const archiveDir = path.join(dataDir, 'archive')

const logFile = path.join(dataDir, 'quiz-error.log')

function logError(err) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${err && err.stack ? err.stack : err}\n`)
  } catch {
    // ignore logging failures
  }
}

// On first launch, seed the course folder with the bundled sample files.
function seedCourses() {
  if (fs.existsSync(courseDir)) return
  fs.mkdirSync(courseDir, { recursive: true })
  const bundled = app.isPackaged
    ? path.join(process.resourcesPath, 'course')
    : path.join(__dirname, '..', 'course')
  if (fs.existsSync(bundled)) {
    for (const f of fs.readdirSync(bundled)) {
      fs.copyFileSync(path.join(bundled, f), path.join(courseDir, f))
    }
  }
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  let filePath = path.join(distDir, pathname)
  // SPA fallback: anything without a real file extension serves index.html.
  if (!path.extname(filePath) || !fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html')
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.statusCode = 404
      res.end('Not found')
      return
    }
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream')
    res.end(buf)
  })
}

function startServer() {
  const api = createApiHandler({ courseDir, answersDir, archiveDir })
  const server = http.createServer((req, res) => {
    Promise.resolve(api(req, res))
      .then((handled) => {
        if (!handled) serveStatic(req, res)
      })
      .catch((e) => {
        logError(e)
        res.statusCode = 500
        res.end('Internal error')
      })
  })
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'Course',
      submenu: [
        {
          label: 'Open Course Folder',
          click: () => {
            fs.mkdirSync(courseDir, { recursive: true })
            shell.openPath(courseDir)
          },
        },
        {
          label: 'Open Answers Folder',
          click: () => {
            fs.mkdirSync(answersDir, { recursive: true })
            shell.openPath(answersDir)
          },
        },
      ],
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Always create a window so the user sees something; load the app once the
// server is up, or an inline error page if startup fails.
async function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'Quiz',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  // Open external links (e.g. the AI Studio sign-in) in the system default
  // browser instead of a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
  try {
    const port = await startServer()
    await win.loadURL(`http://127.0.0.1:${port}/`)
  } catch (err) {
    logError(err)
    const msg = String(err && err.stack ? err.stack : err)
    win.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          `<body style="font-family:sans-serif;padding:24px">
             <h1>Quiz failed to start</h1>
             <p>Details were written to:<br><code>${logFile}</code></p>
             <pre style="white-space:pre-wrap;color:#b00">${msg}</pre>
           </body>`
        )
    )
  }
}

app.whenReady().then(async () => {
  try {
    seedCourses()
    buildMenu()
    await createWindow()
  } catch (err) {
    logError(err)
    dialog.showErrorBox('Quiz failed to start', String(err && err.stack ? err.stack : err))
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Surface any otherwise-silent crashes.
process.on('uncaughtException', (err) => {
  logError(err)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

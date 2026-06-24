#!/usr/bin/env node
// Build the frontend, then package desktop executables with electron-builder.
//
// Usage:
//   node scripts/build.mjs                 # current platform
//   node scripts/build.mjs mac             # macOS (.dmg + .zip)
//   node scripts/build.mjs win             # Windows (NSIS installer + portable .exe)
//   node scripts/build.mjs linux           # Linux (AppImage)
//   node scripts/build.mjs mac win         # multiple targets
//   node scripts/build.mjs all             # mac + win + linux
//
// Output goes to ./release.
import { spawnSync } from 'node:child_process'

const ALIASES = {
  mac: '--mac',
  macos: '--mac',
  osx: '--mac',
  win: '--win',
  windows: '--win',
  linux: '--linux',
}

const args = process.argv.slice(2).map((a) => a.toLowerCase())

let flags
if (args.length === 0) {
  // No platform given: let electron-builder default to the host platform.
  flags = []
} else if (args.includes('all')) {
  flags = ['--mac', '--win', '--linux']
} else {
  const unknown = args.filter((a) => !ALIASES[a])
  if (unknown.length) {
    console.error(`Unknown platform(s): ${unknown.join(', ')}`)
    console.error('Valid values: mac, win, linux, all')
    process.exit(1)
  }
  flags = [...new Set(args.map((a) => ALIASES[a]))]
}

const run = (cmd, cmdArgs) => {
  console.log(`\n> ${cmd} ${cmdArgs.join(' ')}`)
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

run('npx', ['vite', 'build'])
run('npx', ['electron-builder', ...flags])

console.log('\nDone. Executables are in ./release')

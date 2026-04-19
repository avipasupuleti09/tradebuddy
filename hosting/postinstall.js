import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const frontendDir = path.join(rootDir, 'frontend')
const require = createRequire(import.meta.url)
const npmCliPath = process.env.npm_execpath || require.resolve('npm/bin/npm-cli.js')
const venvDir = process.env.PYTHON_VENV_DIR
  ? path.resolve(rootDir, process.env.PYTHON_VENV_DIR)
  : path.join(rootDir, '.venv-hosting')
const hostedVenvPython = process.platform === 'win32'
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python')
const localVenvPython = process.platform === 'win32'
  ? path.join(rootDir, '.venv', 'Scripts', 'python.exe')
  : path.join(rootDir, '.venv', 'bin', 'python')

function readBoolEnv(name, fallback = false) {
  const value = process.env[name]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    ...options,
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`)
  }
}

function npmEnvForChild() {
  const env = { ...process.env }
  delete env.npm_lifecycle_event
  delete env.npm_lifecycle_script
  delete env.npm_command
  delete env.npm_config_local_prefix
  delete env.npm_config_prefix
  delete env.INIT_CWD
  return env
}

function runNpm(args, cwd) {
  run(process.execPath, [npmCliPath, ...args], {
    cwd,
    env: npmEnvForChild(),
  })
}

function detectPythonCommand() {
  if (process.env.PYTHON_CMD) {
    return process.env.PYTHON_CMD
  }

  const candidates = process.platform === 'win32'
    ? ['python', 'py']
    : ['python3', 'python']

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' })
    if (!result.error && result.status === 0) {
      return candidate
    }
  }

  return null
}

function bootstrapPython() {
  const skipBootstrap = readBoolEnv('SKIP_PYTHON_BOOTSTRAP', false)
    || (!readBoolEnv('PYTHON_AUTOSTART', !process.env.PYTHON_API_BASE) && Boolean(process.env.PYTHON_API_BASE))

  if (skipBootstrap) {
    console.log('Skipping Python bootstrap because hosted Python autostart is disabled.')
    return
  }

  if (fs.existsSync(localVenvPython)) {
    console.log('Using existing local virtual environment; skipping hosted Python bootstrap.')
    return
  }

  const pythonCommand = detectPythonCommand()
  if (!pythonCommand) {
    console.warn('Python executable not found during postinstall. Hosted /api routes require Python for the FYERS backend.')
    return
  }

  if (!fs.existsSync(hostedVenvPython)) {
    run(pythonCommand, ['-m', 'venv', venvDir])
  }

  run(hostedVenvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'])
  run(hostedVenvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt'])
}

runNpm(['run', 'build', '--workspace', 'frontend'], rootDir)
bootstrapPython()
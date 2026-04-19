import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { createScannerApp } from '../scanner/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'frontend', 'dist')

function readBoolEnv(name, fallback = false) {
  const value = process.env[name]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

function resolvePythonCommand() {
  if (process.env.PYTHON_CMD) {
    return process.env.PYTHON_CMD
  }
  const hostedVenv = process.platform === 'win32'
    ? path.join(rootDir, '.venv-hosting', 'Scripts', 'python.exe')
    : path.join(rootDir, '.venv-hosting', 'bin', 'python')
  if (fs.existsSync(hostedVenv)) {
    return hostedVenv
  }
  if (process.platform === 'win32') {
    const localVenv = path.join(rootDir, '.venv', 'Scripts', 'python.exe')
    return fs.existsSync(localVenv) ? localVenv : 'python'
  }
  return 'python3'
}

const port = Number(process.env.PORT || 3000)
const backendPort = Number(process.env.BACKEND_PORT || 5000)
const pythonApiBase = (process.env.PYTHON_API_BASE || `http://127.0.0.1:${backendPort}`).replace(/\/$/, '')
const autoStartPython = readBoolEnv('PYTHON_AUTOSTART', !process.env.PYTHON_API_BASE)

let pythonProcess = null
let pythonStartupError = null

if (autoStartPython) {
  const pythonCommand = resolvePythonCommand()
  pythonProcess = spawn(pythonCommand, ['server.py'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      BACKEND_PORT: String(backendPort),
      FRONTEND_URL: process.env.FRONTEND_URL || '',
    },
  })

  pythonProcess.on('error', (error) => {
    pythonStartupError = error.message
    console.error(`Failed to start Python backend using ${pythonCommand}:`, error.message)
  })
}

function shutdownChild() {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill('SIGTERM')
  }
}

process.on('SIGINT', shutdownChild)
process.on('SIGTERM', shutdownChild)
process.on('exit', shutdownChild)

const app = express()
const scannerApp = createScannerApp()

app.disable('x-powered-by')

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    port,
    distReady: fs.existsSync(path.join(distDir, 'index.html')),
    pythonApiBase,
    pythonAutostart: autoStartPython,
    pythonStartupError,
  })
})

app.use('/scanner-api', (req, res, next) => {
  req.url = `/api${req.url === '/' ? '' : req.url}`
  scannerApp(req, res, next)
})

const apiProxy = createProxyMiddleware({
  target: pythonApiBase,
  changeOrigin: true,
  ws: true,
  proxyTimeout: 120000,
  pathRewrite: (requestPath) => `/api${requestPath}`,
})

app.use('/api', apiProxy)

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  app.get('*', (_req, res) => {
    res.status(500).send('frontend/dist is missing. Run npm run build before starting the hosted server.')
  })
}

const server = app.listen(port, () => {
  console.log(`TradeBuddy hosted server listening on http://0.0.0.0:${port}`)
})

server.on('upgrade', apiProxy.upgrade)
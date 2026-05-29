#!/usr/bin/env node

import { spawn } from 'node:child_process'
import http from 'node:http'
import net from 'node:net'

const HOST = process.env.E2E_LOCAL_HOST || '127.0.0.1'
const START_PORT = Number(process.env.E2E_LOCAL_PORT || 3010)
const READY_TIMEOUT_MS = Number(process.env.E2E_LOCAL_READY_TIMEOUT_MS || 60_000)
const PLAYWRIGHT_ARGS = process.argv.slice(2)

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} failed with ${signal || `exit code ${code}`}`))
    })
  })
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, HOST)
  })
}

async function findPort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await isPortAvailable(port)) return port
  }
  throw new Error(`No open local port found from ${startPort} to ${startPort + 49}`)
}

function waitForReady(url, timeoutMs) {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) {
          resolve()
          return
        }
        retry()
      })

      req.on('error', retry)
      req.setTimeout(2_000, () => {
        req.destroy()
        retry()
      })
    }

    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`))
        return
      }
      setTimeout(check, 500)
    }

    check()
  })
}

function stopServer(child) {
  if (!child || child.killed) return Promise.resolve()

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5_000)

    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })

    child.kill('SIGTERM')
  })
}

async function main() {
  const port = await findPort(START_PORT)
  const baseUrl = `http://${HOST}:${port}`
  let server

  const cleanup = async () => {
    await stopServer(server)
  }

  process.once('SIGINT', async () => {
    await cleanup()
    process.exit(130)
  })
  process.once('SIGTERM', async () => {
    await cleanup()
    process.exit(143)
  })

  try {
    console.log(`[e2e-local] Building production app...`)
    await run('npm', ['run', 'build'])

    console.log(`[e2e-local] Starting production server at ${baseUrl}...`)
    server = spawn('npm', ['start'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        HOSTNAME: HOST,
        PORT: String(port),
        E2E_BASE_URL: baseUrl,
        AI_EMBEDDINGS_ENABLED: process.env.AI_EMBEDDINGS_ENABLED || '0',
      },
    })

    await waitForReady(baseUrl, READY_TIMEOUT_MS)

    const args = ['playwright', 'test', ...PLAYWRIGHT_ARGS]
    console.log(`[e2e-local] Running npx ${args.join(' ')} against ${baseUrl}...`)
    await run('npx', args, {
      env: {
        ...process.env,
        E2E_BASE_URL: baseUrl,
        E2E_WORKERS: process.env.E2E_WORKERS || '2',
        AI_EMBEDDINGS_ENABLED: process.env.AI_EMBEDDINGS_ENABLED || '0',
      },
    })
  } finally {
    await cleanup()
  }
}

main().catch((error) => {
  console.error(`[e2e-local] ${error.message}`)
  process.exit(1)
})

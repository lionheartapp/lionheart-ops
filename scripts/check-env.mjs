import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const required = ['DATABASE_URL', 'DIRECT_URL', 'AUTH_SECRET']
const optional = ['GEMINI_API_KEY']

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function mask(value) {
  if (!value) return ''
  if (value.length <= 8) return '********'
  return `${value.slice(0, 4)}…${value.slice(-2)}`
}

function main() {
  loadEnvFile(resolve(process.cwd(), '.env'))
  loadEnvFile(resolve(process.cwd(), '.env.local'))

  const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim())

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    for (const key of missing) {
      console.error(`- ${key}`)
    }
    console.error('\nAdd these to your environment (and Vercel Project Settings for deploys).')
    process.exit(1)
  }

  console.log('✅ Required environment variables are set:')
  for (const key of required) {
    console.log(`- ${key} (${mask(String(process.env[key]))})`)
  }

  const missingOptional = optional.filter((key) => !process.env[key] || !String(process.env[key]).trim())
  if (missingOptional.length > 0) {
    console.log('\nℹ️ Optional environment variables not set:')
    for (const key of missingOptional) {
      console.log(`- ${key}`)
    }
  }
}

main()

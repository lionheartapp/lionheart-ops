import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function main() {
  if (!isGitRepo()) {
    console.log('ℹ️ Skipping hooks install (not a git repository).')
    return
  }

  const hooksDir = join(ROOT, '.githooks')
  if (!existsSync(hooksDir)) {
    console.log('ℹ️ Skipping hooks install (.githooks directory not found).')
    return
  }

  try {
    execSync('git config core.hooksPath .githooks', { cwd: ROOT, stdio: 'ignore' })
    console.log('✅ Git hooks path configured: .githooks')
  } catch {
    console.log('⚠️ Unable to configure git hooks path automatically.')
    console.log('   Run manually: git config core.hooksPath .githooks')
  }
}

main()

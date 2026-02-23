import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

function getFilesFromStaged() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, acc)
      continue
    }
    acc.push(full)
  }
  return acc
}

function fileHasAllowedExt(relPath) {
  for (const ext of ALLOWED_EXT) {
    if (relPath.endsWith(ext)) return true
  }
  return false
}

function getAllCandidateFiles() {
  const srcFiles = walk(join(ROOT, 'src'))
  return srcFiles
    .map((abs) => abs.replace(`${ROOT}/`, ''))
    .filter((rel) => rel.startsWith('src/'))
    .filter(fileHasAllowedExt)
}

function getCandidateFiles() {
  const staged = process.argv.includes('--staged')
  if (!staged) return getAllCandidateFiles()

  const stagedFiles = getFilesFromStaged()
  return stagedFiles
    .filter((rel) => rel.startsWith('src/'))
    .filter(fileHasAllowedExt)
}

function isViolationPath(importPath) {
  if (importPath.startsWith('@/services')) return true

  const containsServicesSegment = importPath.includes('/services/') || importPath.endsWith('/services')
  const isAllowedLibServices =
    importPath.includes('/lib/services/') ||
    importPath === '@/lib/services' ||
    importPath.startsWith('@/lib/services')

  return containsServicesSegment && !isAllowedLibServices
}

function findViolations(content, relPath) {
  const lines = content.split('\n')
  const violations = []
  const importPatterns = [
    /from\s+['\"]([^'\"]+)['\"]/g,
    /import\(\s*['\"]([^'\"]+)['\"]\s*\)/g,
    /require\(\s*['\"]([^'\"]+)['\"]\s*\)/g,
  ]

  lines.forEach((line, index) => {
    for (const pattern of importPatterns) {
      let match
      while ((match = pattern.exec(line)) !== null) {
        const importPath = match[1]
        if (isViolationPath(importPath)) {
          violations.push({
            file: relPath,
            line: index + 1,
            importPath,
            source: line.trim(),
          })
        }
      }
      pattern.lastIndex = 0
    }
  })

  return violations
}

function main() {
  const files = getCandidateFiles()
  const allViolations = []

  for (const relPath of files) {
    const absPath = join(ROOT, relPath)
    if (!existsSync(absPath)) continue
    const content = readFileSync(absPath, 'utf8')
    allViolations.push(...findViolations(content, relPath))
  }

  if (allViolations.length === 0) {
    console.log('✅ Architecture import boundaries check passed.')
    process.exit(0)
  }

  console.error('❌ Architecture boundary violations found:\n')
  for (const v of allViolations) {
    console.error(`- ${v.file}:${v.line}`)
    console.error(`  import: ${v.importPath}`)
    console.error(`  code:   ${v.source}`)
  }

  console.error('\nUse @/lib/services/... instead of legacy /services imports.')
  process.exit(1)
}

main()

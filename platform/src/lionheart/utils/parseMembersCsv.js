/**
 * Parse a team members CSV file.
 * Expected columns (case-insensitive): Name, Email, Role, Teams
 * Teams can be comma-separated in a cell.
 * Returns [{ name, email, role?, teamNames? }]
 */
export function parseMembersCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const header = lines[0]
  const headerCols = parseRow(header)
  const nameIdx = findColumnIndex(headerCols, ['name', 'full name', 'fullname'])
  const emailIdx = findColumnIndex(headerCols, ['email', 'email address', 'e-mail'])
  const roleIdx = findColumnIndex(headerCols, ['role'])
  const teamsIdx = findColumnIndex(headerCols, ['teams', 'team', 'team tags', 'team tags'])

  if (nameIdx < 0 && emailIdx < 0) return []

  const result = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i])
    const name = (cols[nameIdx] ?? cols[emailIdx] ?? '').trim()
    const email = (cols[emailIdx] ?? '').trim()
    if (!name && !email) continue
    if (email && !email.includes('@')) continue

    const role = roleIdx >= 0 ? (cols[roleIdx] ?? '').trim() : ''
    let teamNames = []
    if (teamsIdx >= 0 && cols[teamsIdx]) {
      teamNames = cols[teamsIdx].split(/[,;]/).map((t) => t.trim()).filter(Boolean)
    }
    result.push({
      name: name || email.split('@')[0] || 'Unknown',
      email: email || '',
      role: role || undefined,
      teamNames,
    })
  }
  return result
}

function parseRow(line) {
  const cols = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let val = ''
      i++
      while (i < line.length) {
        if (line[i] === '"') {
          i++
          if (line[i] === '"') {
            val += '"'
            i++
          } else break
        } else {
          val += line[i]
          i++
        }
      }
      cols.push(val)
      if (i < line.length && line[i] === ',') i++
    } else {
      let val = ''
      while (i < line.length && line[i] !== ',') {
        val += line[i]
        i++
      }
      cols.push(val.trim())
      if (line[i] === ',') i++
    }
  }
  return cols
}

function findColumnIndex(headers, aliases) {
  const normalized = aliases.map((a) => a.toLowerCase())
  const idx = headers.findIndex((h) => {
    const hh = (h || '').toLowerCase().trim()
    return normalized.some((a) => hh === a || hh.includes(a))
  })
  return idx >= 0 ? idx : -1
}

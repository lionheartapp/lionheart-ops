#!/usr/bin/env node
/**
 * Seed comprehensive test data for Calendar, Athletics & Events.
 * Run: node scripts/seed-test-data.mjs
 */

import { SignJWT } from 'jose'

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3004'
const ORG_ID = 'cmm53helb0000n8hbhthyh4b7'       // Linfield Christian School
const USER_ID = 'cmm53helb0001n8hbfhbowqr3'       // Michael Kerley
const USER2_ID = 'cmma6qnc70001tcahhl63zuvu'       // Tom Riddle
const EMAIL = 'mkerley@linfield.com'
const AUTH_SECRET = 'dev-lionheart-secret-change-before-production'

// Calendar IDs (Master is soft-deleted, use campus calendars instead)
const CAL_MAIN_CAMPUS = 'cal_main_campus_master'
const CAL_SANGER_CAMPUS = 'cal_sanger_campus_master'
const CAL_PERSONAL = 'cmm7dievp000110bapsu2z3j6'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function makeToken() {
  const secret = new TextEncoder().encode(AUTH_SECRET)
  return new SignJWT({ userId: USER_ID, organizationId: ORG_ID, email: EMAIL })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

let TOKEN = ''
function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) {
    console.error(`  ✗ POST ${path} failed:`, data.error?.message || JSON.stringify(data))
    return null
  }
  return data.data
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() })
  const data = await res.json()
  if (!data.ok) return null
  return data.data
}

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) {
    console.error(`  ✗ PUT ${path} failed:`, data.error?.message || JSON.stringify(data))
    return null
  }
  return data.data
}

function futureDate(daysFromNow, hour = 9, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function pastDate(daysAgo, hour = 15, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// ─── Calendar Events ────────────────────────────────────────────────────────

async function seedCalendarEvents() {
  console.log('\n📅 Seeding Calendar Events...')

  // Fetch existing events to avoid duplicates (wide window: 90 days past to 120 days future)
  const now = new Date()
  const start = new Date(now); start.setDate(start.getDate() - 90)
  const end = new Date(now); end.setDate(end.getDate() + 120)
  const allCalIds = [CAL_MAIN_CAMPUS, CAL_SANGER_CAMPUS, CAL_PERSONAL].join(',')
  const existing = await get(`/api/calendar-events?calendarIds=${allCalIds}&start=${start.toISOString()}&end=${end.toISOString()}`) || []
  const existingTitles = new Set(existing.map(e => `${e.calendarId}::${e.title}`))

  const events = [
    // Upcoming meetings & events on Main Campus
    { calendarId: CAL_MAIN_CAMPUS, title: 'All-Staff Meeting', startTime: futureDate(1, 9, 0), endTime: futureDate(1, 10, 0), locationText: 'Main Auditorium', attendeeIds: [USER2_ID] },
    { calendarId: CAL_MAIN_CAMPUS, title: 'Parent-Teacher Conference Day', startTime: futureDate(3, 8, 0), endTime: futureDate(3, 16, 0), locationText: 'Classrooms', isAllDay: true },
    { calendarId: CAL_MAIN_CAMPUS, title: 'Board of Directors Meeting', startTime: futureDate(5, 18, 0), endTime: futureDate(5, 20, 0), locationText: 'Conference Room A' },
    { calendarId: CAL_MAIN_CAMPUS, title: 'Spring Open House', startTime: futureDate(10, 10, 0), endTime: futureDate(10, 14, 0), locationText: 'Main Campus', description: 'Annual open house for prospective families. Tours, demos, and Q&A sessions.' },
    { calendarId: CAL_MAIN_CAMPUS, title: 'Teacher Professional Development', startTime: futureDate(7, 8, 30), endTime: futureDate(7, 15, 30), locationText: 'Library', description: 'Full-day PD session on curriculum alignment.' },
    { calendarId: CAL_MAIN_CAMPUS, title: 'Chapel Service', startTime: futureDate(2, 10, 0), endTime: futureDate(2, 10, 45), locationText: 'Chapel' },
    { calendarId: CAL_MAIN_CAMPUS, title: 'Senior Class Trip Planning', startTime: futureDate(4, 14, 0), endTime: futureDate(4, 15, 0), locationText: 'Room 204', attendeeIds: [USER2_ID] },
    { calendarId: CAL_MAIN_CAMPUS, title: 'Spring Band Concert', startTime: futureDate(14, 19, 0), endTime: futureDate(14, 21, 0), locationText: 'Performing Arts Center' },
    // Sanger Campus events
    { calendarId: CAL_SANGER_CAMPUS, title: 'Sanger Campus Assembly', startTime: futureDate(2, 8, 30), endTime: futureDate(2, 9, 30), locationText: 'Sanger Auditorium' },
    { calendarId: CAL_SANGER_CAMPUS, title: 'Field Day', startTime: futureDate(15, 9, 0), endTime: futureDate(15, 14, 0), locationText: 'Sanger Athletic Field', description: 'Annual field day for elementary students.' },
    // Personal calendar
    { calendarId: CAL_PERSONAL, title: 'Lunch w/ Athletic Director', startTime: futureDate(1, 12, 0), endTime: futureDate(1, 13, 0), locationText: 'Off campus' },
    { calendarId: CAL_PERSONAL, title: 'Budget Review', startTime: futureDate(6, 14, 0), endTime: futureDate(6, 15, 30), locationText: 'My Office' },
    // Recurring weekly staff meeting
    {
      calendarId: CAL_MAIN_CAMPUS,
      title: 'Weekly Admin Huddle',
      startTime: futureDate(1, 7, 30),
      endTime: futureDate(1, 8, 0),
      locationText: 'Conference Room B',
      rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=12',
      attendeeIds: [USER2_ID],
    },
    // Past events
    { calendarId: CAL_MAIN_CAMPUS, title: 'Admissions Committee Review', startTime: pastDate(2, 10, 0), endTime: pastDate(2, 11, 30), locationText: 'Admin Office' },
    { calendarId: CAL_MAIN_CAMPUS, title: 'Fire Drill', startTime: pastDate(5, 13, 0), endTime: pastDate(5, 13, 30) },
    { calendarId: CAL_MAIN_CAMPUS, title: 'Science Fair', startTime: pastDate(8, 9, 0), endTime: pastDate(8, 15, 0), locationText: 'Gymnasium', description: 'Annual K-12 science fair with judging and awards.' },
  ]

  let created = 0, skipped = 0
  for (const ev of events) {
    const key = `${ev.calendarId}::${ev.title}`
    if (existingTitles.has(key)) {
      skipped++
      continue
    }
    const result = await post('/api/calendar-events', ev)
    if (result) {
      created++
      existingTitles.add(key) // prevent duplicates within same run
    }
  }
  console.log(`  ✓ Created ${created} calendar events (${skipped} skipped — already exist)`)
}

// ─── Athletics ──────────────────────────────────────────────────────────────

async function seedAthletics() {
  console.log('\n🏆 Seeding Athletics...')

  // ── Sports (skip existing)
  console.log('  Creating sports...')
  const existingSports = await get('/api/athletics/sports') || []
  const existingSportNames = new Set(existingSports.map(s => s.name))

  const sportsData = [
    { name: 'Baseball', abbreviation: 'BB', color: '#DC2626', seasonType: 'SPRING' },
    { name: 'Basketball', abbreviation: 'BKB', color: '#F97316', seasonType: 'WINTER' },
    { name: 'Soccer', abbreviation: 'SOC', color: '#16A34A', seasonType: 'FALL' },
    { name: 'Volleyball', abbreviation: 'VB', color: '#7C3AED', seasonType: 'FALL' },
    { name: 'Track & Field', abbreviation: 'TF', color: '#0EA5E9', seasonType: 'SPRING' },
  ]

  const sports = [...existingSports]
  let sportsCreated = 0
  for (const s of sportsData) {
    if (existingSportNames.has(s.name)) continue
    const result = await post('/api/athletics/sports', s)
    if (result) { sports.push(result); sportsCreated++ }
  }
  console.log(`  ✓ ${sportsCreated} sports created, ${existingSports.length} already existed`)

  if (sports.length === 0) { console.log('  ✗ No sports created — stopping athletics seed'); return }

  // ── Seasons
  console.log('  Creating seasons...')
  const seasons = []
  for (const sport of sports) {
    const season = await post('/api/athletics/seasons', {
      sportId: sport.id,
      name: `2025-26 ${sport.name}`,
      startDate: '2025-08-15T00:00:00Z',
      endDate: '2026-06-01T00:00:00Z',
      isCurrent: true,
    })
    if (season) seasons.push({ ...season, sportName: sport.name, sportColor: sport.color })
  }
  console.log(`  ✓ Created ${seasons.length} seasons`)

  // ── Teams
  console.log('  Creating teams...')
  const teams = []
  const teamDefs = [
    // Baseball
    { sportIdx: 0, name: 'Varsity Baseball', level: 'VARSITY' },
    { sportIdx: 0, name: 'JV Baseball', level: 'JUNIOR_VARSITY' },
    // Basketball
    { sportIdx: 1, name: 'Varsity Boys Basketball', level: 'VARSITY' },
    { sportIdx: 1, name: 'JV Boys Basketball', level: 'JUNIOR_VARSITY' },
    { sportIdx: 1, name: 'Varsity Girls Basketball', level: 'VARSITY' },
    // Soccer
    { sportIdx: 2, name: 'Varsity Boys Soccer', level: 'VARSITY' },
    { sportIdx: 2, name: 'Varsity Girls Soccer', level: 'VARSITY' },
    { sportIdx: 2, name: 'JV Boys Soccer', level: 'JUNIOR_VARSITY' },
    // Volleyball
    { sportIdx: 3, name: 'Varsity Girls Volleyball', level: 'VARSITY' },
    { sportIdx: 3, name: 'JV Girls Volleyball', level: 'JUNIOR_VARSITY' },
    // Track
    { sportIdx: 4, name: 'Varsity Track & Field', level: 'VARSITY' },
  ]

  for (const def of teamDefs) {
    const sport = sports[def.sportIdx]
    const season = seasons.find(s => s.sportName === sport.name)
    if (!season) continue
    const team = await post('/api/athletics/teams', {
      sportId: sport.id,
      seasonId: season.id,
      name: def.name,
      level: def.level,
    })
    if (team) teams.push({ ...team, sportIdx: def.sportIdx })
  }
  console.log(`  ✓ Created ${teams.length} teams`)

  // ── Games (with scores for past games)
  console.log('  Creating games...')
  const opponents = [
    'Heritage Christian', 'Valley Christian', 'Riverside Prep', 'Calvary Chapel',
    'Ontario Christian', 'Arrowhead Christian', 'Aquinas', 'St. Lucy\'s',
    'Damien', 'San Dimas', 'Bonita', 'Covina',
  ]

  let gamesCreated = 0
  const gameIds = []

  for (const team of teams) {
    // 4 past games with scores
    for (let i = 0; i < 4; i++) {
      const daysAgo = 28 - (i * 7)
      const isHome = i % 2 === 0
      const game = await post('/api/athletics/games', {
        athleticTeamId: team.id,
        opponentName: opponents[(team.sportIdx * 3 + i) % opponents.length],
        homeAway: isHome ? 'HOME' : 'AWAY',
        startTime: pastDate(daysAgo, 15 + (i % 3), 0),
        endTime: pastDate(daysAgo, 17 + (i % 3), 0),
        venue: isHome ? 'Linfield Stadium' : `${opponents[(team.sportIdx * 3 + i) % opponents.length]} Field`,
      })
      if (game) {
        gamesCreated++
        gameIds.push(game.id)
        // Add score
        const homeScore = Math.floor(Math.random() * 6) + 1
        const awayScore = Math.floor(Math.random() * 6)
        await put(`/api/athletics/games/${game.id}`, {
          homeScore, awayScore, isFinal: true,
        })
      }
    }

    // 3 upcoming games
    for (let i = 0; i < 3; i++) {
      const daysOut = 3 + (i * 5)
      const isHome = i % 2 === 1
      const game = await post('/api/athletics/games', {
        athleticTeamId: team.id,
        opponentName: opponents[(team.sportIdx * 3 + i + 4) % opponents.length],
        homeAway: isHome ? 'HOME' : 'AWAY',
        startTime: futureDate(daysOut, 15 + (i % 2), 30),
        endTime: futureDate(daysOut, 17 + (i % 2), 30),
        venue: isHome ? 'Linfield Stadium' : `${opponents[(team.sportIdx * 3 + i + 4) % opponents.length]} Field`,
      })
      if (game) gamesCreated++
    }
  }
  console.log(`  ✓ Created ${gamesCreated} games (with scores on past games)`)

  // ── Practices
  console.log('  Creating practices...')
  let practicesCreated = 0
  for (const team of teams.slice(0, 6)) { // first 6 teams get practices
    const practice = await post('/api/athletics/practices', {
      athleticTeamId: team.id,
      startTime: futureDate(1, 15, 0),
      endTime: futureDate(1, 17, 0),
      location: 'Linfield Practice Field',
      notes: 'Regular practice session',
      rrule: 'FREQ=WEEKLY;BYDAY=TU,TH;COUNT=16',
    })
    if (practice) practicesCreated++
  }
  console.log(`  ✓ Created ${practicesCreated} recurring practices`)

  // ── Roster players (for first 4 teams)
  console.log('  Creating roster players...')
  const firstNames = ['Jake', 'Ethan', 'Noah', 'Liam', 'Mason', 'Lucas', 'Aiden', 'James', 'Logan', 'Oliver', 'Emma', 'Sophia', 'Ava', 'Isabella', 'Mia']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson']
  const positions = {
    0: ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH'],           // Baseball
    1: ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C'],           // Basketball
    2: ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'],       // Soccer
    3: ['S', 'OH', 'MB', 'L', 'RS', 'OH', 'MB', 'S', 'DS', 'OH'],             // Volleyball
    4: ['100m', '200m', '400m', '800m', 'Mile', 'Hurdles', 'HJ', 'LJ', 'SP', 'Discus'], // Track
  }

  let rosterCount = 0
  for (const team of teams.slice(0, 4)) {
    for (let i = 0; i < 12; i++) {
      const fn = firstNames[(team.sportIdx * 5 + i) % firstNames.length]
      const ln = lastNames[(team.sportIdx * 3 + i) % lastNames.length]
      const pos = positions[team.sportIdx]?.[i % 10] || 'UTIL'
      const player = await post('/api/athletics/roster', {
        athleticTeamId: team.id,
        firstName: fn,
        lastName: ln,
        jerseyNumber: String(i + 1),
        position: pos,
        grade: ['9th', '10th', '11th', '12th'][i % 4],
      })
      if (player) rosterCount++
    }
  }
  console.log(`  ✓ Created ${rosterCount} roster players`)

  // ── Stat configs
  console.log('  Creating stat configs...')
  const statConfigsBySport = {
    0: [{ statKey: 'hits', label: 'Hits' }, { statKey: 'runs', label: 'Runs' }, { statKey: 'rbis', label: 'RBIs' }, { statKey: 'strikeouts', label: 'Strikeouts' }],
    1: [{ statKey: 'points', label: 'Points' }, { statKey: 'rebounds', label: 'Rebounds' }, { statKey: 'assists', label: 'Assists' }, { statKey: 'steals', label: 'Steals' }],
    2: [{ statKey: 'goals', label: 'Goals' }, { statKey: 'assists', label: 'Assists' }, { statKey: 'shots', label: 'Shots' }, { statKey: 'saves', label: 'Saves' }],
  }

  for (const [idx, configs] of Object.entries(statConfigsBySport)) {
    const sport = sports[Number(idx)]
    if (!sport) continue
    await put(`/api/athletics/sports/${sport.id}/stat-configs`, {
      configs: configs.map((c, i) => ({ ...c, sortOrder: i })),
    })
  }
  console.log('  ✓ Created stat configs for Baseball, Basketball, Soccer')

  // ── Tournament (single elimination for Basketball)
  console.log('  Creating tournament...')
  const bball = sports[1]
  if (bball) {
    const tourney = await post('/api/athletics/tournaments', {
      name: 'Winter Invitational',
      sportId: bball.id,
      startDate: futureDate(20),
      endDate: futureDate(22),
      format: 'SINGLE_ELIMINATION',
    })
    if (tourney) {
      console.log(`  ✓ Created tournament: ${tourney.name}`)
      // Generate bracket with basketball teams
      const bballTeams = teams.filter(t => t.sportIdx === 1)
      if (bballTeams.length >= 2) {
        await post(`/api/athletics/tournaments/${tourney.id}/brackets`, {
          teamIds: bballTeams.map(t => t.id),
        })
        console.log(`  ✓ Generated bracket with ${bballTeams.length} teams`)
      }
    }
  }

  // ── Round Robin tournament for Soccer
  const soccer = sports[2]
  if (soccer) {
    const tourney = await post('/api/athletics/tournaments', {
      name: 'Spring Round Robin',
      sportId: soccer.id,
      startDate: futureDate(25),
      endDate: futureDate(30),
      format: 'ROUND_ROBIN',
    })
    if (tourney) {
      console.log(`  ✓ Created tournament: ${tourney.name}`)
      const soccerTeams = teams.filter(t => t.sportIdx === 2)
      if (soccerTeams.length >= 2) {
        await post(`/api/athletics/tournaments/${tourney.id}/brackets`, {
          teamIds: soccerTeams.map(t => t.id),
        })
        console.log(`  ✓ Generated round-robin bracket with ${soccerTeams.length} teams`)
      }
    }
  }
}

// ─── Draft Events (Planning) ────────────────────────────────────────────────

async function seedDraftEvents() {
  console.log('\n📋 Seeding Draft Events (Planning)...')

  // Check existing draft events to avoid duplicates
  const existingDrafts = await get('/api/draft-events') || []
  const existingDraftTitles = new Set(existingDrafts.map(d => d.title))

  const drafts = [
    { title: 'End-of-Year Awards Ceremony', description: 'Annual awards for academic and athletic achievements. Need auditorium, catering, programs printed.', startTime: futureDate(45, 18, 0), endTime: futureDate(45, 20, 30) },
    { title: 'Senior Graduation Rehearsal', description: 'Full walkthrough of graduation ceremony.', startTime: futureDate(55, 9, 0), endTime: futureDate(55, 12, 0) },
    { title: 'Summer Camp Kickoff', description: 'First day orientation for summer camp staff and campers.', startTime: futureDate(90, 8, 0), endTime: futureDate(90, 15, 0) },
    { title: 'Fundraiser Gala Planning Meeting', description: 'Initial planning session for fall fundraiser gala. Budget, venue, sponsors.', startTime: futureDate(12, 16, 0), endTime: futureDate(12, 17, 30) },
    { title: 'Curriculum Review Committee', description: 'Quarterly curriculum review with department heads.', startTime: futureDate(8, 14, 0), endTime: futureDate(8, 16, 0) },
  ]

  let created = 0, skipped = 0
  for (const draft of drafts) {
    if (existingDraftTitles.has(draft.title)) { skipped++; continue }
    const result = await post('/api/draft-events', draft)
    if (result) created++
  }
  console.log(`  ✓ Created ${created} draft events (${skipped} skipped — already exist)`)
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Lionheart Test Data Seeder')
  console.log(`   Base URL: ${BASE}`)
  console.log(`   Org: Linfield Christian School (${ORG_ID})`)

  TOKEN = await makeToken()
  console.log('   Token generated ✓')

  // Verify auth works
  const check = await fetch(`${BASE}/api/settings/users`, { headers: headers() })
  const checkData = await check.json()
  if (!checkData.ok) {
    console.error('✗ Auth check failed:', checkData.error?.message)
    process.exit(1)
  }
  console.log(`   Auth verified — ${checkData.data.length} users in org ✓`)

  await seedCalendarEvents()
  await seedAthletics()
  await seedDraftEvents()

  console.log('\n✅ Done! All test data seeded successfully.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

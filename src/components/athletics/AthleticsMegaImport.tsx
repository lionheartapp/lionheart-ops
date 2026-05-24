'use client'

import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries'
import {
  Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2,
  Dribbble, CalendarDays, Users, UserPlus, ChevronDown, ChevronRight,
} from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import DetailDrawer from '@/components/DetailDrawer'
import { FileInput } from '@/components/ui/FileInput'

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  sport: string
  season: string
  team: string
  level: string
  firstName: string
  lastName: string
  jerseyNumber: string
  position: string
  grade: string
  height: string
  weight: string
}

interface ImportResult {
  sports: { created: number; reused: number }
  seasons: { created: number; reused: number }
  teams: { created: number; reused: number }
  players: { created: number; errors: string[] }
  totalRows: number
}

interface AthleticsMegaImportProps {
  isOpen: boolean
  onClose: () => void
}

// ── CSV Template ─────────────────────────────────────────────────────────────

const CSV_TEMPLATE = `Sport,Season,Team,Level,First Name,Last Name,Jersey Number,Position,Grade,Height,Weight
Baseball,Spring 2026,Varsity Baseball,Varsity,John,Doe,23,Pitcher,11th,6'1",185
Baseball,Spring 2026,Varsity Baseball,Varsity,Jane,Smith,7,Outfield,10th,5'8",155
Baseball,Spring 2026,JV Baseball,JV,Mike,Johnson,12,Catcher,9th,5'10",165
Basketball,Winter 2026,Varsity Basketball,Varsity,Alex,Williams,5,Guard,12th,6'0",175
Basketball,Winter 2026,Varsity Basketball,Varsity,Sam,Brown,21,Forward,11th,6'3",195
Soccer,Fall 2026,Varsity Soccer,Varsity,Chris,Davis,10,Midfielder,12th,5'11",170
Soccer,Fall 2026,JV Soccer,JV,Pat,Wilson,3,Defender,9th,5'7",150
`

// ── CSV Parsing ──────────────────────────────────────────────────────────────

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue }
    if (char === ',' && !inQuotes) { result.push(current); current = ''; continue }
    current += char
  }
  result.push(current)
  return result
}

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const errors: string[] = []

  if (lines.length < 2) {
    return { rows: [], errors: ['File must have a header row and at least one data row'] }
  }

  // Flexible header detection
  const rawHeaders = splitCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''))

  const colMap: Record<string, number> = {}
  rawHeaders.forEach((h, i) => {
    if (h === 'sport' || h === 'sportname') colMap.sport = i
    else if (h === 'season' || h === 'seasonname') colMap.season = i
    else if (h === 'team' || h === 'teamname') colMap.team = i
    else if (h === 'level' || h === 'teamlevel') colMap.level = i
    else if (h.includes('first')) colMap.firstName = i
    else if (h.includes('last')) colMap.lastName = i
    else if (h.includes('jersey') || h.includes('number') || h === 'no' || h === 'num') colMap.jerseyNumber = i
    else if (h.includes('pos')) colMap.position = i
    else if (h.includes('grade') || h.includes('year') || h.includes('class')) colMap.grade = i
    else if (h.includes('height') || h === 'ht') colMap.height = i
    else if (h.includes('weight') || h === 'wt') colMap.weight = i
  })

  // Validate required columns
  const missing: string[] = []
  if (colMap.sport === undefined) missing.push('Sport')
  if (colMap.season === undefined) missing.push('Season')
  if (colMap.team === undefined) missing.push('Team')
  if (colMap.firstName === undefined) missing.push('First Name')
  if (colMap.lastName === undefined) missing.push('Last Name')

  if (missing.length) {
    return { rows: [], errors: [`Missing required columns: ${missing.join(', ')}`] }
  }

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    const sport = cols[colMap.sport]?.trim() || ''
    const season = cols[colMap.season]?.trim() || ''
    const team = cols[colMap.team]?.trim() || ''
    const firstName = cols[colMap.firstName]?.trim() || ''
    const lastName = cols[colMap.lastName]?.trim() || ''

    // Skip fully blank rows
    if (!sport && !season && !team && !firstName && !lastName) continue

    const rowErrors: string[] = []
    if (!sport) rowErrors.push('sport')
    if (!season) rowErrors.push('season')
    if (!team) rowErrors.push('team')
    if (!firstName) rowErrors.push('first name')
    if (!lastName) rowErrors.push('last name')

    if (rowErrors.length) {
      errors.push(`Row ${i + 1}: Missing ${rowErrors.join(', ')}`)
      continue
    }

    rows.push({
      sport,
      season,
      team,
      level: colMap.level !== undefined ? cols[colMap.level]?.trim() || '' : '',
      firstName,
      lastName,
      jerseyNumber: colMap.jerseyNumber !== undefined ? cols[colMap.jerseyNumber]?.trim() || '' : '',
      position: colMap.position !== undefined ? cols[colMap.position]?.trim() || '' : '',
      grade: colMap.grade !== undefined ? cols[colMap.grade]?.trim() || '' : '',
      height: colMap.height !== undefined ? cols[colMap.height]?.trim() || '' : '',
      weight: colMap.weight !== undefined ? cols[colMap.weight]?.trim() || '' : '',
    })
  }

  return { rows, errors }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AthleticsMegaImport({ isOpen, onClose }: AthleticsMegaImportProps) {
  const queryClient = useQueryClient()

  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [expandedSports, setExpandedSports] = useState<Set<string>>(new Set())

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // ── Hierarchy summary from parsed rows ───────────────────────────────

  const hierarchy = useMemo(() => {
    const sports = new Map<string, Map<string, Map<string, ParsedRow[]>>>()

    for (const row of parsed) {
      if (!sports.has(row.sport)) sports.set(row.sport, new Map())
      const seasons = sports.get(row.sport)!
      if (!seasons.has(row.season)) seasons.set(row.season, new Map())
      const teams = seasons.get(row.season)!
      if (!teams.has(row.team)) teams.set(row.team, [])
      teams.get(row.team)!.push(row)
    }

    return sports
  }, [parsed])

  const stats = useMemo(() => {
    let sportCount = 0, seasonCount = 0, teamCount = 0
    for (const [, seasons] of hierarchy) {
      sportCount++
      for (const [, teams] of seasons) {
        seasonCount++
        teamCount += teams.size
      }
    }
    return { sports: sportCount, seasons: seasonCount, teams: teamCount, players: parsed.length }
  }, [hierarchy, parsed])

  // ── Handlers ─────────────────────────────────────────────────────────

  const reset = () => {
    setParsed([])
    setFileName('')
    setParseErrors([])
    setResult(null)
    setExpandedSports(new Set())
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'athletics-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileSelect = (files: File[]) => {
    const file = files[0]
    if (!file) return

    reset()

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseErrors(['Please upload a .csv file'])
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setParseErrors(['File must be under 2 MB'])
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') {
        const { rows, errors } = parseCSV(text)
        setParsed(rows)
        setParseErrors(errors)
        // Auto-expand all sports in preview
        const sportNames = new Set(rows.map((r) => r.sport))
        setExpandedSports(sportNames)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (parsed.length === 0) return
    setImporting(true)

    try {
      const res = await fetch('/api/athletics/mega-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rows: parsed }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setParseErrors([data.error?.message || 'Import failed'])
        return
      }
      setResult(data.data)
      // Invalidate all athletics queries
      queryClient.invalidateQueries({ queryKey: queryKeys.athleticsSports.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.athleticsSeasons.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.athleticsTeams.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.athleticsRoster.all })
    } catch {
      setParseErrors(['Something went wrong during import'])
    } finally {
      setImporting(false)
    }
  }

  const toggleSport = (sport: string) => {
    setExpandedSports((prev) => {
      const next = new Set(prev)
      if (next.has(sport)) next.delete(sport)
      else next.add(sport)
      return next
    })
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Athletics Data"
      width="lg"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="flex-1 py-2.5 text-sm font-medium text-stone-700 border border-stone-200 rounded-full hover:bg-stone-50 transition disabled:opacity-50 cursor-pointer"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || parsed.length === 0}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              {importing ? 'Importing...' : `Import ${parsed.length} Row${parsed.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Step indicator */}
        {!result && (
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <span className={`flex items-center gap-1.5 ${!fileName ? 'text-slate-900 font-semibold' : 'text-emerald-600'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${!fileName ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                {fileName ? '✓' : '1'}
              </span>
              Upload
            </span>
            <div className="flex-1 h-px bg-stone-200" />
            <span className={`flex items-center gap-1.5 ${fileName && parsed.length > 0 && !result ? 'text-slate-900 font-semibold' : ''}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                parsed.length > 0 ? 'bg-slate-900 text-white' : 'bg-stone-100 text-stone-400'
              }`}>2</span>
              Review
            </span>
            <div className="flex-1 h-px bg-stone-200" />
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center text-[10px] font-bold">3</span>
              Import
            </span>
          </div>
        )}

        {/* Template download */}
        <button
          type="button"
          onClick={downloadTemplate}
          className="w-full flex items-center gap-3 px-4 py-3 border border-dashed border-stone-300 rounded-xl text-left hover:border-stone-400 hover:bg-stone-50/50 transition-colors group cursor-pointer"
        >
          <div className="p-2 rounded-lg bg-stone-100 group-hover:bg-indigo-50 transition-colors">
            <Download className="w-4 h-4 text-stone-500 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Download CSV Template</p>
            <p className="text-xs text-stone-500 mt-0.5">Includes columns for sport, season, team, and player info with example data</p>
          </div>
        </button>

        {!result && (
          <FileInput
            accept=".csv"
            onFiles={handleFileSelect}
            className="px-4 py-8 border-stone-200 hover:border-stone-400 hover:bg-stone-50/30"
          >
            <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-stone-100">
              <FileSpreadsheet className="w-6 h-6 text-stone-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-stone-700">
                {fileName || 'Click to upload a CSV file'}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                One row per player — sport, season, and team are auto-created
              </p>
            </div>
            </div>
          </FileInput>
        )}

        {/* Parse errors */}
        {parseErrors.length > 0 && !result && (
          <div className="px-3.5 py-3 rounded-lg bg-red-50 border border-red-100 space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-800">{parseErrors.length} issue{parseErrors.length !== 1 ? 's' : ''} found</p>
            </div>
            <ul className="text-xs text-red-700 space-y-0.5 ml-6">
              {parseErrors.slice(0, 5).map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
              {parseErrors.length > 5 && (
                <li className="text-red-400">...and {parseErrors.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        {/* Preview hierarchy */}
        {parsed.length > 0 && !result && (
          <div>
            {/* Summary badges */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-stone-700">Preview</p>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                <Dribbble className="w-3 h-3" />
                {stats.sports} sport{stats.sports !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                <CalendarDays className="w-3 h-3" />
                {stats.seasons} season{stats.seasons !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                <Users className="w-3 h-3" />
                {stats.teams} team{stats.teams !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                <UserPlus className="w-3 h-3" />
                {stats.players} player{stats.players !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Tree view */}
            <div className="border border-stone-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              {Array.from(hierarchy.entries()).map(([sportName, seasons]) => (
                <div key={sportName}>
                  <button
                    type="button"
                    onClick={() => toggleSport(sportName)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-stone-50 hover:bg-stone-100 text-left transition-colors cursor-pointer border-b border-stone-100"
                  >
                    {expandedSports.has(sportName) ? (
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                    )}
                    <Dribbble className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-sm font-semibold text-slate-900">{sportName}</span>
                    <span className="text-[10px] text-stone-400 ml-auto">
                      {Array.from(seasons.values()).reduce((sum, teams) =>
                        sum + Array.from(teams.values()).reduce((s, p) => s + p.length, 0), 0
                      )} players
                    </span>
                  </button>

                  {expandedSports.has(sportName) && (
                    <div className="bg-white">
                      {Array.from(seasons.entries()).map(([seasonName, teams]) => (
                        <div key={seasonName}>
                          <div className="flex items-center gap-2 px-3 py-1.5 pl-8 border-b border-stone-50">
                            <CalendarDays className="w-3 h-3 text-purple-400" />
                            <span className="text-xs font-medium text-stone-600">{seasonName}</span>
                          </div>
                          {Array.from(teams.entries()).map(([teamName, players]) => (
                            <div key={teamName}>
                              <div className="flex items-center gap-2 px-3 py-1.5 pl-12 border-b border-stone-50">
                                <Users className="w-3 h-3 text-emerald-400" />
                                <span className="text-xs text-stone-600">{teamName}</span>
                                <span className="text-[10px] text-stone-400 ml-auto">{players.length}</span>
                              </div>
                              {players.map((p, pi) => (
                                <div key={pi} className="flex items-center gap-2 px-3 py-1 pl-16 text-xs text-stone-500 border-b border-stone-50/50">
                                  <span className="w-5 text-right text-stone-400 font-mono">{p.jerseyNumber || '—'}</span>
                                  <span className="text-stone-700">{p.firstName} {p.lastName}</span>
                                  {p.position && <span className="text-stone-400">· {p.position}</span>}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import result */}
        {result && (
          <div className="space-y-4">
            {/* Success header */}
            <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Import Complete</p>
                <p className="text-xs text-emerald-700 mt-1">{result.totalRows} rows processed successfully</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <Dribbble className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-900">Sports</span>
                </div>
                <p className="text-lg font-bold text-blue-900">{result.sports.created + result.sports.reused}</p>
                <p className="text-[10px] text-blue-600">
                  {result.sports.created} new · {result.sports.reused} existing
                </p>
              </div>
              <div className="px-4 py-3 rounded-lg bg-purple-50 border border-purple-100">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-semibold text-purple-900">Seasons</span>
                </div>
                <p className="text-lg font-bold text-purple-900">{result.seasons.created + result.seasons.reused}</p>
                <p className="text-[10px] text-purple-600">
                  {result.seasons.created} new · {result.seasons.reused} existing
                </p>
              </div>
              <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-900">Teams</span>
                </div>
                <p className="text-lg font-bold text-emerald-900">{result.teams.created + result.teams.reused}</p>
                <p className="text-[10px] text-emerald-600">
                  {result.teams.created} new · {result.teams.reused} existing
                </p>
              </div>
              <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-900">Players</span>
                </div>
                <p className="text-lg font-bold text-amber-900">{result.players.created}</p>
                <p className="text-[10px] text-amber-600">
                  {result.players.created} added{result.players.errors.length > 0 && ` · ${result.players.errors.length} failed`}
                </p>
              </div>
            </div>

            {/* Errors */}
            {result.players.errors.length > 0 && (
              <div className="px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-100 space-y-1">
                <p className="text-sm font-medium text-amber-800">
                  {result.players.errors.length} player{result.players.errors.length !== 1 ? 's' : ''} could not be imported
                </p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {result.players.errors.slice(0, 8).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {result.players.errors.length > 8 && (
                    <li className="text-amber-500">...and {result.players.errors.length - 8} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}

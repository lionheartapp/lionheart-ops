'use client'

import { useState, useCallback } from 'react'
import { Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import { FileInput } from '@/components/ui/FileInput'

export interface ParsedPlayer {
  firstName: string
  lastName: string
  jerseyNumber?: string
  position?: string
  grade?: string
  height?: string
  weight?: string
}

export interface UploadResult {
  created: number
  errors: string[]
}

interface RosterCSVImportProps {
  uploadParsed: ParsedPlayer[]
  uploadFileName: string
  uploadError: string
  uploading: boolean
  uploadResult: UploadResult | null
  onParsed: (players: ParsedPlayer[]) => void
  onFileNameChange: (name: string) => void
  onErrorChange: (error: string) => void
  onResetUpload: () => void
}

const CSV_HEADERS = ['First Name', 'Last Name', 'Jersey Number', 'Position', 'Grade', 'Height', 'Weight']

/** Simple CSV line splitter that handles quoted fields */
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

export default function RosterCSVImport({
  uploadParsed,
  uploadFileName,
  uploadError,
  uploading,
  uploadResult,
  onParsed,
  onFileNameChange,
  onErrorChange,
  onResetUpload,
}: RosterCSVImportProps) {

  const downloadTemplate = useCallback(() => {
    const csv = CSV_HEADERS.join(',') + '\nJohn,Doe,23,Guard,10th,6\'1",185\nJane,Smith,7,Forward,11th,5\'9",160\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'roster-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const parseCSV = useCallback((text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) {
      onErrorChange('File must have a header row and at least one player row')
      return
    }

    // Flexible header detection -- normalize column names
    const headerLine = lines[0]
    const rawHeaders = splitCSVLine(headerLine).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''))

    const colMap: Record<string, number> = {}
    rawHeaders.forEach((h, i) => {
      if (h.includes('first')) colMap.firstName = i
      else if (h.includes('last')) colMap.lastName = i
      else if (h.includes('jersey') || h.includes('number') || h === 'no' || h === 'num') colMap.jerseyNumber = i
      else if (h.includes('pos')) colMap.position = i
      else if (h.includes('grade') || h.includes('year') || h.includes('class')) colMap.grade = i
      else if (h.includes('height') || h === 'ht') colMap.height = i
      else if (h.includes('weight') || h === 'wt') colMap.weight = i
    })

    if (colMap.firstName === undefined || colMap.lastName === undefined) {
      onErrorChange('CSV must have "First Name" and "Last Name" columns')
      return
    }

    const players: ParsedPlayer[] = []
    const rowErrors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i])
      const firstName = cols[colMap.firstName]?.trim() || ''
      const lastName = cols[colMap.lastName]?.trim() || ''

      if (!firstName && !lastName) continue // skip blank rows

      if (!firstName || !lastName) {
        rowErrors.push(`Row ${i + 1}: Missing ${!firstName ? 'first' : 'last'} name`)
        continue
      }

      players.push({
        firstName,
        lastName,
        jerseyNumber: colMap.jerseyNumber !== undefined ? cols[colMap.jerseyNumber]?.trim() : undefined,
        position: colMap.position !== undefined ? cols[colMap.position]?.trim() : undefined,
        grade: colMap.grade !== undefined ? cols[colMap.grade]?.trim() : undefined,
        height: colMap.height !== undefined ? cols[colMap.height]?.trim() : undefined,
        weight: colMap.weight !== undefined ? cols[colMap.weight]?.trim() : undefined,
      })
    }

    if (players.length === 0) {
      onErrorChange(rowErrors.length ? rowErrors.join('; ') : 'No valid player rows found')
      return
    }
    if (rowErrors.length) {
      onErrorChange(`${rowErrors.length} row(s) skipped: ${rowErrors[0]}${rowErrors.length > 1 ? ` and ${rowErrors.length - 1} more` : ''}`)
    }

    onParsed(players)
  }, [onErrorChange, onParsed])

  const handleFileSelect = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return

    onErrorChange('')
    onParsed([])

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv') {
      onErrorChange('Please upload a .csv file')
      return
    }
    if (file.size > 1024 * 1024) {
      onErrorChange('File must be under 1 MB')
      return
    }

    onFileNameChange(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') parseCSV(text)
    }
    reader.readAsText(file)
  }, [onErrorChange, onParsed, onFileNameChange, parseCSV])

  return (
    <div className="space-y-5">
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
          <p className="text-xs text-stone-500 mt-0.5">Pre-formatted with the correct column headers</p>
        </div>
      </button>

      {/* File drop zone */}
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
            {uploadFileName || 'Click to upload a CSV file'}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Columns: First Name, Last Name, Jersey Number, Position, Grade, Height, Weight
          </p>
        </div>
        </div>
      </FileInput>

      {/* Parse error */}
      {uploadError && !uploadResult && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{uploadError}</p>
        </div>
      )}

      {/* Preview table */}
      {uploadParsed.length > 0 && !uploadResult && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-stone-700">
              {uploadParsed.length} player{uploadParsed.length !== 1 ? 's' : ''} ready to import
            </p>
            <button
              type="button"
              onClick={() => { onResetUpload() }}
              className="text-xs text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="border border-stone-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-stone-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-stone-500">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-stone-500">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-stone-500">Pos</th>
                  <th className="px-3 py-2 text-left font-semibold text-stone-500">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {uploadParsed.map((p, i) => (
                  <tr key={i} className="hover:bg-stone-50/50">
                    <td className="px-3 py-1.5 text-slate-900 font-medium">{p.firstName} {p.lastName}</td>
                    <td className="px-3 py-1.5 text-stone-600">{p.jerseyNumber || '\u2014'}</td>
                    <td className="px-3 py-1.5 text-stone-600">{p.position || '\u2014'}</td>
                    <td className="px-3 py-1.5 text-stone-600">{p.grade || '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload result */}
      {uploadResult && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-emerald-50 border border-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">
              Successfully imported {uploadResult.created} player{uploadResult.created !== 1 ? 's' : ''}
            </p>
          </div>
          {uploadResult.errors.length > 0 && (
            <div className="px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-100 space-y-1">
              <p className="text-sm font-medium text-amber-800">{uploadResult.errors.length} issue{uploadResult.errors.length !== 1 ? 's' : ''}</p>
              <ul className="text-xs text-amber-700 space-y-0.5">
                {uploadResult.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>&bull; {err}</li>
                ))}
                {uploadResult.errors.length > 5 && (
                  <li className="text-amber-500">...and {uploadResult.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

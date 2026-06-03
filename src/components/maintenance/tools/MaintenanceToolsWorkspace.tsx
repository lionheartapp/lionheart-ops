'use client'

import { useMemo, useState } from 'react'
import {
  Beaker,
  Calculator,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  HardHat,
  Paintbrush,
  Ruler,
  Sparkles,
} from 'lucide-react'
import PondCareDosageCalculator from '@/components/maintenance/calculators/PondCareDosageCalculator'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { CATEGORY_LABELS } from '@/lib/constants/maintenance'
import { getMaintenanceSafetyGuidance } from '@/lib/maintenance-safety'
import {
  estimateFixtureCost,
  estimateFlooringSquareFeet,
  estimatePaintGallons,
  getRepairDecision,
} from '@/lib/maintenance-tools'

type ToolId = 'pond' | 'ppe' | 'repair' | 'materials' | 'audit'

const tools: Array<{
  id: ToolId
  title: string
  description: string
  icon: typeof FlaskConical
  accent: string
}> = [
  { id: 'pond', title: 'Pond Care', description: 'Volume and dosage math', icon: FlaskConical, accent: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'ppe', title: 'PPE Finder', description: 'Protection by task category', icon: HardHat, accent: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'repair', title: 'Repair Math', description: 'Repair vs replace signal', icon: Gauge, accent: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'materials', title: 'Material Estimator', description: 'Paint, flooring, fixtures', icon: Paintbrush, accent: 'bg-violet-50 text-violet-700 border-violet-100' },
  { id: 'audit', title: 'Audit Prep', description: 'Quarterly review checklist', icon: ClipboardCheck, accent: 'bg-rose-50 text-rose-700 border-rose-100' },
]

export default function MaintenanceToolsWorkspace() {
  const [activeTool, setActiveTool] = useState<ToolId>('pond')
  const current = tools.find((tool) => tool.id === activeTool) ?? tools[0]
  const Icon = current.icon

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute right-[-4rem] top-[-5rem] h-56 w-56 rounded-full border border-white/20" />
          <div className="absolute right-12 bottom-[-7rem] h-72 w-72 rounded-full border border-amber-300/30" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
        </div>
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_20rem] lg:p-7">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Maintenance Tools
            </div>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Field math, safety checks, and practical helpers.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Use the tool that matches the job, then attach the result to the work order notes when needed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {tools.slice(0, 4).map(({ id, title, icon: TileIcon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTool(id)}
                className={`rounded-xl border p-3 text-left transition-colors duration-200 cursor-pointer ${
                  activeTool === id
                    ? 'border-amber-300 bg-amber-300/15'
                    : 'border-white/10 bg-white/[0.08] hover:bg-white/[0.12]'
                }`}
              >
                <TileIcon className="h-4 w-4 text-amber-300" />
                <p className="mt-3 text-xs font-medium text-white/80">{title}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {activeTool === 'pond' && <PondCareDosageCalculator />}
          {activeTool === 'ppe' && <PpeFinderTool />}
          {activeTool === 'repair' && <RepairMathTool />}
          {activeTool === 'materials' && <MaterialEstimatorTool />}
          {activeTool === 'audit' && <AuditPrepTool />}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${current.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Active Tool</h2>
                <p className="text-xs text-slate-500">{current.title}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-medium leading-5 text-amber-900">
                Use these helpers for estimates and documentation. Site policy, labels, codes, and supervisor direction still control the work.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Tools</h2>
            <div className="mt-4 space-y-2">
              {tools.map(({ id, title, description, icon: ToolIcon, accent }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTool(id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-200 cursor-pointer ${
                    activeTool === id
                      ? 'border-slate-300 bg-slate-100'
                      : 'border-slate-100 bg-slate-50/70 hover:bg-white'
                  }`}
                >
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${accent}`}>
                    <ToolIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{title}</p>
                    <p className="truncate text-xs text-slate-500">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ToolPanel({ icon: Icon, title, subtitle, children }: {
  icon: typeof FlaskConical
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function PpeFinderTool() {
  const [category, setCategory] = useState('GROUNDS')
  const guidance = getMaintenanceSafetyGuidance(category)

  return (
    <ToolPanel icon={HardHat} title="PPE Finder" subtitle="Pick a task category and review PPE, safety steps, and stop conditions.">
      <div className="space-y-5">
        <Select
          value={category}
          onChange={setCategory}
          options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <SafetyList title="PPE" items={guidance.ppe} />
          <SafetyList title="Safe steps" items={guidance.steps} />
          <SafetyList title="Stop and escalate" items={guidance.stopConditions} tone="danger" />
        </div>
        <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          {guidance.note}
        </p>
      </div>
    </ToolPanel>
  )
}

function SafetyList({ title, items, tone = 'default' }: { title: string; items: string[]; tone?: 'default' | 'danger' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${tone === 'danger' ? 'text-red-700' : 'text-slate-500'}`}>
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-slate-700">
            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${tone === 'danger' ? 'bg-red-400' : 'bg-slate-400'}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RepairMathTool() {
  const [repairCost, setRepairCost] = useState('')
  const [replacementCost, setReplacementCost] = useState('')
  const [repeatAttempts, setRepeatAttempts] = useState('')
  const [ageYears, setAgeYears] = useState('')
  const [expectedLifeYears, setExpectedLifeYears] = useState('')
  const [downtimeDays, setDowntimeDays] = useState('')

  const result = getRepairDecision({
    repairCost: Number(repairCost),
    replacementCost: Number(replacementCost),
    repeatAttempts: Number(repeatAttempts),
    ageYears: Number(ageYears),
    expectedLifeYears: Number(expectedLifeYears),
    downtimeDays: Number(downtimeDays),
  })

  return (
    <ToolPanel icon={Gauge} title="Repair Math" subtitle="Use cost, age, repeats, and downtime to decide whether repair still makes sense.">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Repair cost ($)" value={repairCost} onChange={setRepairCost} placeholder="e.g. 1000" />
        <NumberField label="Replacement cost ($)" value={replacementCost} onChange={setReplacementCost} placeholder="e.g. 2200" />
        <NumberField label="Repair attempts" value={repeatAttempts} onChange={setRepeatAttempts} placeholder="e.g. 3" />
        <NumberField label="Downtime days" value={downtimeDays} onChange={setDowntimeDays} placeholder="e.g. 5" />
        <NumberField label="Asset age (years)" value={ageYears} onChange={setAgeYears} placeholder="e.g. 14" />
        <NumberField label="Expected life (years)" value={expectedLifeYears} onChange={setExpectedLifeYears} placeholder="e.g. 15" />
      </div>
      <ResultBox
        title={result.decision === 'REPLACE' ? 'Replacement should be reviewed' : result.decision === 'REVIEW' ? 'Needs supervisor review' : 'Repair still looks reasonable'}
        detail={result.ratio === null ? 'Enter replacement cost to calculate repair ratio.' : `Repair is ${(result.ratio * 100).toFixed(0)}% of replacement cost.`}
        items={result.reasons}
      />
    </ToolPanel>
  )
}

function MaterialEstimatorTool() {
  const [mode, setMode] = useState('PAINT')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [c, setC] = useState('')
  const [d, setD] = useState('')

  const result = useMemo(() => {
    if (mode === 'PAINT') {
      const gallons = estimatePaintGallons({ squareFeet: Number(a), coats: Number(b), coveragePerGallon: Number(c), wastePct: Number(d) })
      return gallons === null ? null : `${Math.ceil(gallons)} gallon(s)`
    }
    if (mode === 'FLOORING') {
      const sqFt = estimateFlooringSquareFeet({ lengthFt: Number(a), widthFt: Number(b), wastePct: Number(c) })
      return sqFt === null ? null : `${Math.ceil(sqFt)} sq ft`
    }
    const cost = estimateFixtureCost({ quantity: Number(a), unitCost: Number(b), contingencyPct: Number(c) })
    return cost === null ? null : `$${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }, [a, b, c, d, mode])

  return (
    <ToolPanel icon={Paintbrush} title="Material Estimator" subtitle="Quick estimates for common facilities jobs.">
      <div className="space-y-4">
        <Select
          value={mode}
          onChange={(next) => {
            setMode(next)
            setA('')
            setB('')
            setC('')
            setD('')
          }}
          options={[
            { value: 'PAINT', label: 'Paint' },
            { value: 'FLOORING', label: 'Flooring' },
            { value: 'FIXTURES', label: 'Fixtures' },
          ]}
        />
        {mode === 'PAINT' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Surface area (sq ft)" value={a} onChange={setA} placeholder="e.g. 1200" />
            <NumberField label="Coats" value={b} onChange={setB} placeholder="e.g. 2" />
            <NumberField label="Coverage per gallon" value={c} onChange={setC} placeholder="e.g. 350" />
            <NumberField label="Waste (%)" value={d} onChange={setD} placeholder="e.g. 10" />
          </div>
        )}
        {mode === 'FLOORING' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Length (ft)" value={a} onChange={setA} placeholder="e.g. 30" />
            <NumberField label="Width (ft)" value={b} onChange={setB} placeholder="e.g. 20" />
            <NumberField label="Waste (%)" value={c} onChange={setC} placeholder="e.g. 12" />
          </div>
        )}
        {mode === 'FIXTURES' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Quantity" value={a} onChange={setA} placeholder="e.g. 8" />
            <NumberField label="Unit cost ($)" value={b} onChange={setB} placeholder="e.g. 42" />
            <NumberField label="Contingency (%)" value={c} onChange={setC} placeholder="e.g. 10" />
          </div>
        )}
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Estimate</p>
          <p className="mt-1 text-2xl font-semibold text-violet-950">{result ?? 'Enter values'}</p>
        </div>
      </div>
    </ToolPanel>
  )
}

function AuditPrepTool() {
  const [quarter, setQuarter] = useState('Q1')
  const [includeCosts, setIncludeCosts] = useState(true)
  const [includeRepeats, setIncludeRepeats] = useState(true)
  const [notes, setNotes] = useState('')
  const prompts = [
    `Review ${quarter} completed work orders by category and campus.`,
    'Find work orders that stayed open longer than expected.',
    includeCosts ? 'Compare labor, parts, and vendor costs against the prior quarter.' : '',
    includeRepeats ? 'List repeat repairs and decide which assets need replacement review.' : '',
    'Pick three process changes for next quarter.',
  ].filter(Boolean)

  return (
    <ToolPanel icon={ClipboardCheck} title="Audit Prep" subtitle="Build a quick quarterly review outline.">
      <div className="space-y-4">
        <Select
          value={quarter}
          onChange={setQuarter}
          options={['Q1', 'Q2', 'Q3', 'Q4'].map((value) => ({ value, label: value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox checked={includeCosts} onChange={(e) => setIncludeCosts(e.target.checked)} label="Include cost review" />
          <Checkbox checked={includeRepeats} onChange={(e) => setIncludeRepeats(e.target.checked)} label="Include repeat repair review" />
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Optional focus areas for this review..."
        />
        <ResultBox title={`${quarter} review outline`} detail={notes || 'Use this as the agenda for the maintenance review.'} items={prompts} />
      </div>
    </ToolPanel>
  )
}

function NumberField({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <Input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function ResultBox({ title, detail, items }: { title: string; detail: string; items: string[] }) {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-slate-700">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

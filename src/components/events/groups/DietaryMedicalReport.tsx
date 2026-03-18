'use client'

import { motion } from 'framer-motion'
import { Shield, AlertTriangle, Pill, Users, Lock } from 'lucide-react'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import { useDietaryMedicalReport } from '@/lib/hooks/useEventGroups'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DietaryMedicalReportProps {
  eventProjectId: string
  canViewMedical: boolean
}

// ─── Locked State ────────────────────────────────────────────────────────────────

function LockedState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-2">Elevated Permissions Required</h3>
      <p className="text-sm text-slate-500 max-w-sm">
        Medical data requires the <strong>events:medical:read</strong> permission (Admin or above).
        Contact your administrator if you need access.
      </p>
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="ui-glass rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export default function DietaryMedicalReport({
  eventProjectId,
  canViewMedical,
}: DietaryMedicalReportProps) {
  const { data, isLoading, error } = useDietaryMedicalReport(
    canViewMedical ? eventProjectId : null
  )

  if (!canViewMedical) {
    return <LockedState />
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
          ))}
        </div>
        <div className="h-40 bg-slate-100 rounded-2xl" />
        <div className="h-40 bg-slate-100 rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Unable to load medical data</p>
        <p className="text-xs text-slate-400 mt-1">Please try again or contact support.</p>
      </div>
    )
  }

  const totalDietaryParticipants = data.dietarySummary.reduce((sum, d) => sum + d.count, 0)

  return (
    <motion.div
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Summary stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Dietary Restrictions"
          value={totalDietaryParticipants}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Allergy Types"
          value={data.allergySummary.length}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={Pill}
          label="On Medication"
          value={data.medicationCount}
          color="bg-blue-50 text-blue-600"
        />
      </motion.div>

      {/* Dietary summary */}
      {data.dietarySummary.length > 0 && (
        <motion.div variants={fadeInUp} className="ui-glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-green-500" />
            Dietary Needs
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-2">
                    Dietary Need
                  </th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider pb-2">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.dietarySummary.map((item) => (
                  <tr key={item.need}>
                    <td className="py-2.5 text-slate-800 font-medium">{item.need}</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        {item.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Allergy summary */}
      {data.allergySummary.length > 0 && (
        <motion.div variants={fadeInUp} className="ui-glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Allergies
          </h3>
          <div className="space-y-3">
            {data.allergySummary.map((item) => (
              <div key={item.allergy} className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-amber-900">{item.allergy}</span>
                  <span className="text-xs font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                </div>
                <p className="text-xs text-amber-700">
                  {item.participantNames.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Medical notes */}
      {data.participantsWithMedicalNotes.length > 0 && (
        <motion.div variants={fadeInUp} className="ui-glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            Participants with Medical Notes
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            {data.medicationCount > 0 && (
              <span className="text-blue-600 font-medium">{data.medicationCount} on medication · </span>
            )}
            Click a participant&apos;s registration in the Registrations tab to view individual notes.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.participantsWithMedicalNotes.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100"
              >
                <Shield className="w-3 h-3 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-blue-800 font-medium truncate">{name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {data.dietarySummary.length === 0 &&
        data.allergySummary.length === 0 &&
        data.participantsWithMedicalNotes.length === 0 && (
          <motion.div
            variants={fadeInUp}
            className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"
          >
            <Shield className="w-8 h-8 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700">No medical or dietary data yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Data will appear here as participants complete their registration forms.
            </p>
          </motion.div>
        )}
    </motion.div>
  )
}

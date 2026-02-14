import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, CheckCircle2 } from 'lucide-react'
import DrawerModal from './DrawerModal'
import CompletionFlowModal from './CompletionFlowModal'
import SafetyModeOverlay from './SafetyModeOverlay'
import { requiresSafetyMode } from '../utils/safetyMode'
import {
  filterNewITRequests,
  filterInProgressITRequests,
  filterThisWeeksITRequests,
  filterRequestsByAssignee,
  filterRequestsByType,
} from '../data/supportTicketsData'
import { isITAdmin, getTeamMemberNames } from '../data/teamsData'

const priorityStyles = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  normal: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
}

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function RequestCard({ request, onClick, priorityStyles, draggable, onDragStart }) {
  const priorityClass = priorityStyles[request.priority] || priorityStyles.normal

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onClick(request)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(request)
        }
      }}
      className={`p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 transition-colors cursor-pointer text-left ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
        {request.title}
      </p>
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          IT-{String(request.id).padStart(4, '0')}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${priorityClass}`}
          >
            {request.priority === 'critical' ? 'Critical' : 'Normal'}
          </span>
          {request.assignedTo && (
            <span
              className="flex w-6 h-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium"
              title={request.assignedTo}
            >
              {getInitials(request.assignedTo)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function ITDashboardRequests({
  requests = [],
  setSupportRequests,
  currentUser,
  users = [],
  teams = [],
  onNavigateToSupport,
}) {
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [safetyModeComplete, setSafetyModeComplete] = useState(false)
  const [completionFlowOpen, setCompletionFlowOpen] = useState(false)
  const [dropTargetColumn, setDropTargetColumn] = useState(null) // 'to-do' | 'in-progress' | null
  const [dropTargetBeforeId, setDropTargetBeforeId] = useState(null)
  const justDroppedRef = useRef(false)

  const itAdmin = isITAdmin(currentUser, teams)
  const allIT = filterRequestsByType(requests, 'IT')
  const ticketsSource = itAdmin ? allIT : filterRequestsByAssignee(requests, currentUser?.name)
  const thisWeeks = filterThisWeeksITRequests(ticketsSource)
  const toDoRequests = filterNewITRequests(thisWeeks)
  const inProgressRequests = filterInProgressITRequests(thisWeeks)

  const handleDragStart = (e, request) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify({ id: request.id }))
    e.dataTransfer.setData('text/plain', String(request.id))
  }

  const applyMoveOrReorder = (draggedId, targetColumn, insertBeforeIndex) => {
    const toDoIds = toDoRequests.map((r) => r.id)
    const inProgressIds = inProgressRequests.map((r) => r.id)
    const srcColumn = toDoIds.some((id) => String(id) === String(draggedId)) ? 'to-do' : inProgressIds.some((id) => String(id) === String(draggedId)) ? 'in-progress' : null
    if (!srcColumn) return
    let newToDoIds = toDoIds.filter((id) => String(id) !== String(draggedId))
    let newInProgressIds = inProgressIds.filter((id) => String(id) !== String(draggedId))
    const maxIdx = Math.max(0, Math.min(insertBeforeIndex, targetColumn === 'to-do' ? newToDoIds.length : newInProgressIds.length))
    if (targetColumn === 'to-do') {
      newToDoIds = [...newToDoIds.slice(0, maxIdx), draggedId, ...newToDoIds.slice(maxIdx)]
    } else {
      newInProgressIds = [...newInProgressIds.slice(0, maxIdx), draggedId, ...newInProgressIds.slice(maxIdx)]
    }
    setSupportRequests?.((prev) => {
      const byId = Object.fromEntries(prev.map((r) => [String(r.id), r]))
      return prev.map((r) => {
        if (r.type !== 'IT') return r
        const toDoIdx = newToDoIds.findIndex((id) => String(id) === String(r.id))
        const inProgressIdx = newInProgressIds.findIndex((id) => String(id) === String(r.id))
        if (toDoIdx >= 0) {
          return { ...r, status: 'new', assignedTo: currentUser?.name ?? r.assignedTo, order: toDoIdx }
        }
        if (inProgressIdx >= 0) {
          const isMoved = String(r.id) === String(draggedId) && srcColumn !== 'in-progress'
          return { ...r, status: 'in-progress', assignedTo: isMoved ? currentUser?.name : r.assignedTo, order: 100 + inProgressIdx }
        }
        return r
      })
    })
  }

  const handleDrop = (e, targetColumn, insertBeforeIndex) => {
    e.preventDefault()
    setDropTargetColumn(null)
    setDropTargetBeforeId(null)
    try {
      const data = e.dataTransfer.getData('application/json')
      const parsed = data ? JSON.parse(data) : null
      const requestId = parsed?.id ?? e.dataTransfer.getData('text/plain')
      if (requestId == null || requestId === '') return
      justDroppedRef.current = true
      setTimeout(() => { justDroppedRef.current = false }, 100)
      applyMoveOrReorder(requestId, targetColumn, insertBeforeIndex)
    } catch (_) {
      // ignore
    }
  }

  const createColumnHandlers = (column) => ({
    onDragOver: (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropTargetColumn(column)
      setDropTargetBeforeId(null)
    },
    onDragLeave: (e) => {
      e.preventDefault()
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setDropTargetColumn(null)
        setDropTargetBeforeId(null)
      }
    },
    onDrop: (e) => {
      const list = column === 'to-do' ? toDoRequests : inProgressRequests
      handleDrop(e, column, list.length)
    },
  })

  const createCardDropHandlers = (column, request, index) => ({
    onDragOver: (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setDropTargetColumn(column)
      setDropTargetBeforeId(request.id)
    },
    onDragLeave: (e) => {
      e.stopPropagation()
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setDropTargetBeforeId(null)
      }
    },
    onDrop: (e) => {
      e.stopPropagation()
      handleDrop(e, column, index)
    },
  })

  const toDoDropHandlers = createColumnHandlers('to-do')
  const inProgressDropHandlers = createColumnHandlers('in-progress')

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {itAdmin ? 'Team IT queue — This week' : 'My tickets — This week'}
          </h2>
          <button
            type="button"
            onClick={onNavigateToSupport}
            className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium shrink-0"
          >
            View all requests →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-700 min-h-[200px]">
        <div
          className={`p-4 flex flex-col flex-1 min-h-[160px] rounded-lg border-2 border-dashed transition-colors ${
            dropTargetColumn === 'to-do'
              ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20'
              : 'border-transparent'
          }`}
          {...toDoDropHandlers}
        >
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            To Do
          </h3>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {toDoRequests.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
                {dropTargetColumn === 'to-do' ? 'Drop here' : 'No requests'}
              </p>
            ) : (
              <AnimatePresence mode="popLayout">
                {toDoRequests.map((req, idx) => (
                  <div
                    key={req.id}
                    className="relative"
                    {...createCardDropHandlers('to-do', req, idx)}
                  >
                    {dropTargetBeforeId === req.id && (
                      <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded z-10" aria-hidden />
                    )}
                    <RequestCard
                      request={req}
                      onClick={setSelectedRequest}
                      priorityStyles={priorityStyles}
                      draggable
                      onDragStart={(e) => handleDragStart(e, req)}
                    />
                  </div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
        <div
          className={`p-4 flex flex-col flex-1 min-h-[160px] rounded-lg border-2 border-dashed transition-colors ${
            dropTargetColumn === 'in-progress'
              ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20'
              : 'border-transparent'
          }`}
          {...inProgressDropHandlers}
        >
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            In Progress
            <span className="ml-2 text-zinc-700 dark:text-zinc-300 font-normal">
              {inProgressRequests.length}
            </span>
          </h3>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {inProgressRequests.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">
                {dropTargetColumn === 'in-progress' ? 'Drop here' : 'No requests'}
              </p>
            ) : (
              <AnimatePresence mode="popLayout">
                {inProgressRequests.map((req, idx) => (
                  <div
                    key={req.id}
                    className="relative"
                    {...createCardDropHandlers('in-progress', req, idx)}
                  >
                    {dropTargetBeforeId === req.id && (
                      <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded z-10" aria-hidden />
                    )}
                    <RequestCard
                      request={req}
                      onClick={setSelectedRequest}
                      priorityStyles={priorityStyles}
                      draggable
                      onDragStart={(e) => handleDragStart(e, req)}
                    />
                  </div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      <DrawerModal
        isOpen={!!selectedRequest}
        onClose={() => { setSelectedRequest(null); setSafetyModeComplete(false) }}
        title={selectedRequest?.title ?? 'Request details'}
      >
        {selectedRequest && (
          <>
            {requiresSafetyMode(selectedRequest) && !safetyModeComplete && (
              <SafetyModeOverlay
                ticketTitle={selectedRequest.title}
                onComplete={() => setSafetyModeComplete(true)}
              />
            )}
            {(safetyModeComplete || !requiresSafetyMode(selectedRequest)) && (
              <RequestDetailContent
                request={selectedRequest}
                currentUser={currentUser}
                users={users}
                teams={teams}
                itAdmin={itAdmin}
                setSupportRequests={setSupportRequests}
                onClose={() => setSelectedRequest(null)}
                onMarkAsDoneClick={() => setCompletionFlowOpen(true)}
              />
            )}
          </>
        )}
      </DrawerModal>

      <CompletionFlowModal
        isOpen={completionFlowOpen}
        onClose={() => setCompletionFlowOpen(false)}
        request={selectedRequest}
        ticketPrefix="IT"
        onComplete={() => {
          setSupportRequests?.((prev) =>
            prev.map((r) =>
              r.id === selectedRequest?.id ? { ...r, status: 'resolved' } : r
            )
          )
          setSelectedRequest(null)
          setCompletionFlowOpen(false)
        }}
      />
    </motion.section>
  )
}

function RequestDetailContent({ request, currentUser, users, teams, itAdmin, setSupportRequests, onClose, onMarkAsDoneClick }) {
  const [assignTo, setAssignTo] = useState(currentUser?.name ?? '')
  useEffect(() => {
    setAssignTo(currentUser?.name ?? '')
  }, [request?.id, currentUser?.name])
  const isNew = !request.status || request.status === 'new'
  const priorityClass = priorityStyles[request.priority] || priorityStyles.normal
  const itTeamNames = getTeamMemberNames(users || [], 'it')

  const handleMoveToInProgress = (assigneeName) => {
    const who = assigneeName || assignTo || currentUser?.name
    setSupportRequests?.((prev) =>
      prev.map((r) =>
        r.id === request.id ? { ...r, status: 'in-progress', assignedTo: who } : r
      )
    )
    onClose?.()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Request
          </p>
          <p className="text-zinc-900 dark:text-zinc-100 mt-1">{request.title}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Submitted by
            </p>
            <p className="text-zinc-700 dark:text-zinc-300 mt-1">
              {request.submittedBy ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Time
            </p>
            <p className="text-zinc-700 dark:text-zinc-300 mt-1">{request.time}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Priority
            </p>
            <p className="mt-1">
              <span
                className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium border ${priorityClass}`}
              >
                {request.priority === 'critical' ? 'Critical' : 'Normal'}
              </span>
            </p>
          </div>
          {request.assignedTo && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Assigned to
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 mt-1">{request.assignedTo}</p>
            </div>
          )}
          {request.recurring && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Type
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 mt-1">Recurring</p>
            </div>
          )}
        </div>
      </div>

      {isNew && (
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
          {itAdmin && itTeamNames.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Assign to
              </label>
              <select
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
              >
                {itTeamNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => handleMoveToInProgress(assignTo)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <Play className="w-4 h-4" />
            Move to In progress
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {itAdmin && itTeamNames.length > 0 ? `This will assign the request to ${assignTo}.` : 'This will assign the request to you.'}
          </p>
        </div>
      )}

      {request.status === 'in-progress' && (
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={onMarkAsDoneClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark as Done
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Complete the form to record man hours, receipt, and any takeaway.</p>
        </div>
      )}
    </div>
  )
}

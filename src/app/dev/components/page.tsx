'use client'

/**
 * Component Catalog — dev-only page showing all shared UI components.
 * Visit: http://localhost:3004/dev/components
 *
 * This page is NOT protected by auth — it's a dev tool.
 * In production, consider adding a middleware check or removing this route.
 */

import { useState } from 'react'
import { Plus, MoreVertical, Pencil, Trash2, Eye } from 'lucide-react'
import DataTable, { type Column } from '@/components/ui/DataTable'
import SearchFilterBar, { type FilterTab } from '@/components/ui/SearchFilterBar'
import FormDrawer from '@/components/ui/FormDrawer'
import Pagination from '@/components/ui/Pagination'
import { FloatingInput, FloatingSelect, FloatingTextarea } from '@/components/ui/FloatingInput'

// ─── Sample Data ──────────────────────────────────────────────────────────

interface SampleItem {
  id: string
  name: string
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  email: string
  role: string
  createdAt: string
}

const SAMPLE_DATA: SampleItem[] = [
  { id: '1', name: 'Alice Johnson', status: 'ACTIVE', email: 'alice@school.edu', role: 'Admin', createdAt: '2024-01-15' },
  { id: '2', name: 'Bob Smith', status: 'PENDING', email: 'bob@school.edu', role: 'Member', createdAt: '2024-02-20' },
  { id: '3', name: 'Carol Williams', status: 'ACTIVE', email: 'carol@school.edu', role: 'Viewer', createdAt: '2024-03-10' },
  { id: '4', name: 'David Brown', status: 'INACTIVE', email: 'david@school.edu', role: 'Member', createdAt: '2024-04-05' },
  { id: '5', name: 'Eve Davis', status: 'ACTIVE', email: 'eve@school.edu', role: 'Admin', createdAt: '2024-05-12' },
]

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  INACTIVE: 'bg-slate-100 text-slate-500',
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ComponentCatalogPage() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [page, setPage] = useState(1)

  const tabs: FilterTab[] = [
    { label: 'All', value: 'all', count: 5 },
    { label: 'Active', value: 'ACTIVE', count: 3 },
    { label: 'Pending', value: 'PENDING', count: 1 },
    { label: 'Inactive', value: 'INACTIVE', count: 1 },
  ]

  const columns: Column<SampleItem>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
            {item.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div>
            <div className="font-medium text-slate-900">{item.name}</div>
            <div className="text-xs text-slate-400">{item.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>
          {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      hideOnMobile: true,
      render: (item) => <span className="text-slate-600">{item.role}</span>,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      hideOnMobile: true,
      render: (item) => <span className="text-slate-400">{item.createdAt}</span>,
    },
  ]

  const filtered = SAMPLE_DATA.filter((item) => {
    if (activeTab !== 'all' && item.status !== activeTab) return false
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-12">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Component Catalog</h1>
          <p className="text-sm text-slate-400 mt-1">Dev-only page — shared UI primitives</p>
        </div>

        {/* ─── SearchFilterBar ───────────────────────────────────────────── */}
        <Section title="SearchFilterBar" description="Tabs + search + action buttons">
          <SearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search members…"
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            actions={
              <button
                onClick={() => setFormOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Member
              </button>
            }
          />
        </Section>

        {/* ─── DataTable ─────────────────────────────────────────────────── */}
        <Section title="DataTable" description="Animated table with row actions + mobile cards">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(item) => item.id}
            onRowClick={(item) => alert(`Clicked: ${item.name}`)}
            renderRowActions={(item) => (
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                  <Eye className="w-4 h-4 text-slate-400" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                  <Pencil className="w-4 h-4 text-slate-400" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            )}
            renderMobileCard={(item) => (
              <div className="ui-glass p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900">{item.name}</div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                    {item.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">{item.email}</div>
              </div>
            )}
          />
        </Section>

        {/* ─── DataTable Loading ──────────────────────────────────────────── */}
        <Section title="DataTable (Loading)" description="Skeleton state">
          <DataTable
            columns={columns}
            data={[]}
            getRowKey={(item) => item.id}
            isLoading={true}
            skeletonRows={3}
          />
        </Section>

        {/* ─── DataTable Empty ────────────────────────────────────────────── */}
        <Section title="DataTable (Empty)" description="Custom empty state">
          <DataTable
            columns={columns}
            data={[]}
            getRowKey={(item) => item.id}
            emptyState={
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-500 font-medium">No members found</p>
                <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filters</p>
              </div>
            }
          />
        </Section>

        {/* ─── Pagination ─────────────────────────────────────────────────── */}
        <Section title="Pagination" description="Page navigation with ellipsis">
          <div className="ui-glass p-4 rounded-xl">
            <Pagination
              page={page}
              totalPages={12}
              total={287}
              limit={25}
              onPageChange={setPage}
            />
          </div>
        </Section>

        {/* ─── FormDrawer ─────────────────────────────────────────────────── */}
        <Section title="FormDrawer" description="Slide-in form with dirty-state warnings">
          <button
            onClick={() => setFormOpen(true)}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Open Form Drawer
          </button>
          <FormDrawer
            isOpen={formOpen}
            onClose={() => setFormOpen(false)}
            onSubmit={(e) => {
              e.preventDefault()
              alert('Submitted!')
              setFormOpen(false)
            }}
            title="Add Member"
            submitLabel="Invite Member"
          >
            <FloatingInput label="First Name" name="firstName" required />
            <FloatingInput label="Last Name" name="lastName" required />
            <FloatingInput label="Email" name="email" type="email" required />
            <FloatingSelect label="Role" name="role">
              <option value="">Select a role…</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </FloatingSelect>
            <FloatingTextarea label="Notes" name="notes" rows={3} />
          </FormDrawer>
        </Section>

        {/* ─── Floating Inputs ────────────────────────────────────────────── */}
        <Section title="Floating Inputs" description="FloatingInput, FloatingSelect, FloatingTextarea">
          <div className="ui-glass p-6 rounded-xl space-y-4 max-w-md">
            <FloatingInput label="Full Name" name="demo-name" required />
            <FloatingInput label="Email Address" name="demo-email" type="email" />
            <FloatingSelect label="Department" name="demo-dept">
              <option value="">Choose…</option>
              <option value="it">IT</option>
              <option value="admin">Administration</option>
              <option value="athletics">Athletics</option>
            </FloatingSelect>
            <FloatingTextarea label="Description" name="demo-desc" rows={3} />
          </div>
        </Section>
      </div>
    </div>
  )
}

// ─── Layout helpers ───────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-400 mb-4">{description}</p>
      {children}
    </div>
  )
}

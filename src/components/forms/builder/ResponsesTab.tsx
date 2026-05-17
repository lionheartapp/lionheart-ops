'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Ticket,
  Users,
  ScanLine,
  Download,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { queryKeys } from '@/lib/queries'

// ─── Types ─────────────────────────────────────────────────────────────────

interface OrderSummary {
  totalRevenue: number
  totalOrders: number
  totalTicketsSold: number
  totalCapacity: number | null
  checkedIn: number
}

interface TicketTypeSummary {
  id: string
  name: string
  price: number
  sold: number
  total: number | null
  revenue: number
}

interface OrderItem {
  id: string
  buyerName: string
  buyerEmail: string
  status: string
  paymentStatus: string
  total: number
  discountCode: string | null
  discountAmount: number
  createdAt: string
  paidAt: string | null
  ticketCount: number
  lineItems: Array<{
    ticketTypeName: string
    quantity: number
    unitPrice: number
    subtotal: number
  }>
}

interface OrdersData {
  summary: OrderSummary
  ticketTypes: TicketTypeSummary[]
  orders: OrderItem[]
}

// ─── Order Detail Drawer ───────────────────────────────────────────────────

function OrderDrawer({ order, onClose }: { order: OrderItem; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', bounce: 0.1, duration: 0.3 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white border-l border-slate-200 shadow-xl z-50 overflow-y-auto"
      >
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Order Details</h3>
            <button
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Close ✕
            </button>
          </div>

          {/* Buyer info */}
          <div>
            <p className="text-sm font-medium text-slate-900">{order.buyerName}</p>
            <p className="text-xs text-slate-500">{order.buyerEmail}</p>
          </div>

          {/* Line items */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tickets</h4>
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              {order.lineItems.map((li, i) => (
                <div key={i} className="flex justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">
                    {li.quantity}× {li.ticketTypeName}
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    ${(li.subtotal / 100).toFixed(2)}
                  </span>
                </div>
              ))}
              {order.discountCode && (
                <div className="flex justify-between px-4 py-2.5 border-t border-slate-200 bg-emerald-50/50">
                  <span className="text-sm text-emerald-700">{order.discountCode}</span>
                  <span className="text-sm font-medium text-emerald-700">
                    -${(order.discountAmount / 100).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 bg-slate-100">
                <span className="text-sm font-semibold text-slate-900">Total</span>
                <span className="text-sm font-semibold text-slate-900">
                  ${(order.total / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment status */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payment</h4>
            <div className="flex items-center gap-2">
              {order.paymentStatus === 'PAID' ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Paid
                </span>
              ) : order.paymentStatus === 'REFUNDED' ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-full">
                  <XCircle className="w-3 h-3" /> Refunded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full">
                  <Clock className="w-3 h-3" /> Pending
                </span>
              )}
              {order.paidAt && (
                <span className="text-xs text-slate-400">
                  {new Date(order.paidAt).toLocaleDateString()} {new Date(order.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {/* Order meta */}
          <div className="text-xs text-slate-400 pt-3 border-t border-slate-100">
            <p>Order placed: {new Date(order.createdAt).toLocaleString()}</p>
            <p>Tickets: {order.ticketCount}</p>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

interface ResponsesTabProps {
  formId: string
  hasTicketTypes: boolean
}

export default function ResponsesTab({ formId, hasTicketTypes }: ResponsesTabProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null)

  const { data, isLoading } = useQuery<OrdersData>({
    queryKey: ['forms', formId, 'orders'],
    queryFn: () => fetchApi<OrdersData>(`/api/forms/${formId}/orders`),
    staleTime: 15_000,
    enabled: hasTicketTypes,
  })

  // Loading
  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="h-40 bg-slate-100 rounded-xl" />
      </div>
    )
  }

  // No ticket types — show placeholder
  if (!hasTicketTypes || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
        <Users className="w-10 h-10 text-slate-300 mb-3" />
        <h3 className="text-sm font-semibold text-slate-700 mb-1">No orders yet</h3>
        <p className="text-xs text-slate-500 max-w-xs">
          Orders will appear here once you add ticket types and someone makes a purchase.
        </p>
      </div>
    )
  }

  const { summary, ticketTypes, orders } = data

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">

        {/* ── Summary Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-slate-500">Revenue</span>
            </div>
            <p className="text-lg font-bold text-slate-900">${(summary.totalRevenue / 100).toFixed(2)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Ticket className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-slate-500">Tickets Sold</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              {summary.totalTicketsSold}
              {summary.totalCapacity && <span className="text-sm font-normal text-slate-400"> / {summary.totalCapacity}</span>}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-500">Orders</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{summary.totalOrders}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ScanLine className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-slate-500">Checked In</span>
            </div>
            <p className="text-lg font-bold text-slate-900">{summary.checkedIn}</p>
          </div>
        </div>

        {/* ── Ticket Types Breakdown ─────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">By Ticket Type</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-right px-4 py-2 font-medium">Sold</th>
                <th className="text-right px-4 py-2 font-medium">Remaining</th>
                <th className="text-right px-4 py-2 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {ticketTypes.map((tt) => (
                <tr key={tt.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 text-slate-900 font-medium">{tt.name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {tt.sold}{tt.total != null ? `/${tt.total}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {tt.total != null ? tt.total - tt.sold : '∞'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-900 font-medium">
                    ${(tt.revenue / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Orders List ────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Orders ({orders.length})</span>
            <button
              onClick={() => window.open(`/api/forms/${formId}/submissions/export`, '_blank')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              {"No orders yet. They'll show up here once someone purchases tickets."}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">{order.buyerName}</span>
                      {order.paymentStatus === 'PAID' ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      ) : order.status === 'CANCELLED' ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span>{order.lineItems.map((li) => `${li.quantity}× ${li.ticketTypeName}`).join(', ')}</span>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    ${(order.total / 100).toFixed(2)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order detail drawer */}
      {selectedOrder && (
        <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  )
}

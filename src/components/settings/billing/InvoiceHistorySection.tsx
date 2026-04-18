'use client'

import { CreditCard, Download } from 'lucide-react'
import type { InvoiceItem } from './billing-types'
import { formatCents, formatDate, getInvoiceStatusConfig } from './billing-types'

interface InvoiceHistorySectionProps {
  invoices: InvoiceItem[]
  invoicesLoading: boolean
}

export function InvoiceHistorySection({ invoices, invoicesLoading }: InvoiceHistorySectionProps) {
  return (
    <section className="ui-glass p-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Invoice History</h3>
          <p className="text-sm text-slate-500 mt-0.5">View and download past invoices</p>
        </div>
      </div>

      {invoicesLoading ? (
        <div className="ui-glass-table">
          <div className="animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 border-b border-slate-100 px-6 flex items-center gap-4">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-4 flex-1 bg-slate-100 rounded" />
                <div className="h-4 w-16 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="ui-glass p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">No invoices yet</p>
          <p className="text-slate-400 text-sm mt-1">Your billing history will appear here.</p>
        </div>
      ) : (
        <div className="ui-glass-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => {
                const invoiceStatus = getInvoiceStatusConfig(invoice.status)
                return (
                  <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                      {invoice.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">
                      {formatCents(invoice.amount, invoice.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${invoiceStatus.className}`}>
                        {invoiceStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {invoice.pdfUrl ? (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors text-xs font-medium cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

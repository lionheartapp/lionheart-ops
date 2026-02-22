import { motion } from 'framer-motion'
import { Ticket } from 'lucide-react'

const mockSales = [
  { id: 1, event: 'Spring Gala 2025', buyer: 'J. Smith', qty: 2, amount: 40, date: 'Feb 8, 2025' },
  { id: 2, event: 'Tech Talk: AI in Education', buyer: 'M. Johnson', qty: 1, amount: 0, date: 'Feb 8, 2025' },
  { id: 3, event: 'Pep Rally', buyer: 'Student Council', qty: 50, amount: 0, date: 'Feb 7, 2025' },
  { id: 4, event: 'Spring Gala 2025', buyer: 'A. Williams', qty: 4, amount: 80, date: 'Feb 7, 2025' },
  { id: 5, event: 'Parent Night', buyer: 'R. Brown', qty: 2, amount: 0, date: 'Feb 6, 2025' },
]

export default function TicketingTable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Ticketing & Sales Hub
          </h3>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/30 bg-zinc-50/50 dark:bg-zinc-800/50">
              <th className="text-left py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">
                Event
              </th>
              <th className="text-left py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">
                Buyer
              </th>
              <th className="text-right py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">
                Qty
              </th>
              <th className="text-right py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">
                Amount
              </th>
              <th className="text-left py-3 px-4 font-medium text-zinc-600 dark:text-zinc-400">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {mockSales.map((row) => (
              <tr
                key={row.id}
className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">
                {row.event}
              </td>
              <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                {row.buyer}
              </td>
              <td className="py-3 px-4 text-right text-zinc-700 dark:text-zinc-300">
                  {row.qty}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={row.amount > 0 ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-500 dark:text-zinc-500'}>
                    {row.amount > 0 ? `$${row.amount}` : '—'}
                  </span>
                </td>
                <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                  {row.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

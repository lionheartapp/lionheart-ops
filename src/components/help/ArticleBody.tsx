import { Info, AlertTriangle, Lightbulb } from 'lucide-react'
import type { HelpBlock } from '@/lib/help/types'

/**
 * Generate a kebab-case URL anchor from heading text — used when the
 * author hasn't supplied an explicit `id` on the heading block.
 */
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const CALLOUT_STYLE: Record<
  Extract<HelpBlock, { type: 'callout' }>['tone'],
  { wrapper: string; iconColor: string; Icon: typeof Info }
> = {
  info: {
    wrapper: 'bg-slate-50 border-slate-200 text-slate-700',
    iconColor: 'text-slate-500',
    Icon: Info,
  },
  warn: {
    wrapper: 'bg-amber-50 border-amber-200 text-amber-900',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
  },
  tip: {
    wrapper: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    iconColor: 'text-emerald-600',
    Icon: Lightbulb,
  },
}

interface ArticleBodyProps {
  blocks: HelpBlock[]
}

/**
 * Renders a typed sequence of HelpBlock objects to HTML. Kept as a server
 * component — no interactivity needed beyond the anchor links Next handles
 * for free.
 */
export function ArticleBody({ blocks }: ArticleBodyProps) {
  return (
    <div className="space-y-6">
      {blocks.map((block, idx) => {
        const key = `${block.type}-${idx}`

        switch (block.type) {
          case 'paragraph':
            return (
              <p key={key} className="text-[16px] leading-[1.75] text-slate-700">
                {block.text}
              </p>
            )

          case 'heading': {
            const id = block.id ?? slugifyHeading(block.text)
            const className =
              block.level === 2
                ? 'text-2xl font-semibold text-slate-900 tracking-tight scroll-mt-24 mt-12'
                : 'text-lg font-semibold text-slate-900 scroll-mt-24 mt-8'
            return block.level === 2 ? (
              <h2 key={key} id={id} className={className}>
                {block.text}
              </h2>
            ) : (
              <h3 key={key} id={id} className={className}>
                {block.text}
              </h3>
            )
          }

          case 'list':
            return block.ordered ? (
              <ol
                key={key}
                className="list-decimal pl-6 space-y-2 text-[16px] leading-[1.75] text-slate-700 marker:text-slate-400"
              >
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            ) : (
              <ul
                key={key}
                className="list-disc pl-6 space-y-2 text-[16px] leading-[1.75] text-slate-700 marker:text-slate-400"
              >
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )

          case 'steps':
            return (
              <ol key={key} className="space-y-4">
                {block.items.map((step, i) => (
                  <li
                    key={i}
                    className="relative pl-12 py-1"
                  >
                    <span
                      className="absolute left-0 top-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-semibold"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <p className="font-semibold text-slate-900 mb-1">{step.title}</p>
                    <p className="text-[15px] leading-[1.7] text-slate-600">{step.body}</p>
                  </li>
                ))}
              </ol>
            )

          case 'callout': {
            const style = CALLOUT_STYLE[block.tone]
            const Icon = style.Icon
            return (
              <aside
                key={key}
                className={`flex gap-3 rounded-xl border p-4 ${style.wrapper}`}
                role="note"
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconColor}`}
                  aria-hidden
                />
                <div className="text-[15px] leading-[1.65]">
                  {block.title && <p className="font-semibold mb-1">{block.title}</p>}
                  <p>{block.body}</p>
                </div>
              </aside>
            )
          }

          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-xl bg-slate-900 text-slate-100 p-4 text-[13px] leading-[1.6]"
              >
                <code className={block.language ? `language-${block.language}` : undefined}>
                  {block.code}
                </code>
              </pre>
            )

          case 'divider':
            return <hr key={key} className="border-slate-200 my-8" />

          default:
            return null
        }
      })}
    </div>
  )
}

export { slugifyHeading }

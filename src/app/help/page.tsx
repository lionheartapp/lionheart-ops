import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import { HELP_ARTICLES, HELP_CATEGORIES, getArticlesByCategory } from '@/lib/help/articles'
import { CategoryIcon } from '@/components/help/CategoryIcon'
import { HelpSearch } from '@/components/help/HelpSearch'

/**
 * Knowledge base index page — discoverable, SEO-indexed entry point at
 * lionheartapp.com/help. Server-rendered for crawlability; the only client
 * component is the search input.
 */
export default function HelpIndexPage() {
  const featured = HELP_ARTICLES.filter((a) =>
    [
      'welcome-to-lionheart',
      'submitting-a-ticket',
      'creating-an-event',
      'setting-up-your-campus',
    ].includes(a.slug)
  )

  return (
    <main>
      {/* Hero */}
      <section className="relative px-6 py-20 sm:py-28 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4">
            Help Center
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 mb-5">
            How can we help?
          </h1>
          <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Guides and walkthroughs for everyone using Lionheart — from first-time
            sign-in to advanced admin workflows.
          </p>
          <HelpSearch articles={HELP_ARTICLES} />
        </div>
      </section>

      {/* Featured */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Start here
            </h2>
            <p className="text-sm text-slate-500">
              The articles most people read first.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featured.map((article) => (
              <Link
                key={article.slug}
                href={`/help/${article.slug}`}
                className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 mb-1 group-hover:text-slate-700 transition-colors duration-200">
                    {article.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3 line-clamp-2">
                    {article.description}
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" aria-hidden />
                    {article.readMinutes} min read
                  </p>
                </div>
                <ArrowRight
                  className="w-5 h-5 text-slate-300 group-hover:text-slate-900 transition-colors duration-200 mt-1 flex-shrink-0"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Categories grid */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-2">
              Browse by topic
            </h2>
            <p className="text-sm text-slate-500">
              Every article, organized by what you&rsquo;re trying to do.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {HELP_CATEGORIES.map((category) => {
              const articles = getArticlesByCategory(category.slug)
              return (
                <div
                  key={category.slug}
                  className="rounded-xl border border-slate-200 bg-white p-6 hover:shadow-sm transition-shadow duration-200"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <CategoryIcon
                        name={category.icon}
                        className="w-5 h-5 text-slate-700"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-900 mb-0.5">
                        {category.title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {articles.length}{' '}
                        {articles.length === 1 ? 'article' : 'articles'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    {category.description}
                  </p>
                  <ul className="space-y-1.5">
                    {articles.slice(0, 4).map((article) => (
                      <li key={article.slug}>
                        <Link
                          href={`/help/${article.slug}`}
                          className="group flex items-center justify-between gap-2 py-1 text-sm text-slate-700 hover:text-slate-900 transition-colors duration-200 cursor-pointer"
                        >
                          <span className="truncate">{article.title}</span>
                          <ArrowRight
                            className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 transition-colors duration-200 flex-shrink-0"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-3">
            Can&rsquo;t find what you need?
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            We answer email fast — usually within a few hours during the school day.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
          >
            Contact support
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}

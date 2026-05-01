import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Clock, Calendar } from 'lucide-react'
import {
  HELP_ARTICLES,
  getArticleBySlug,
  getCategoryBySlug,
  getRelatedArticles,
} from '@/lib/help/articles'
import type { HelpArticle, HelpBlock } from '@/lib/help/types'
import { ArticleBody, slugifyHeading } from '@/components/help/ArticleBody'

const SITE_URL = 'https://lionheartapp.com'

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * Pre-render every known article at build time. Adding a new entry to
 * HELP_ARTICLES is enough — no extra wiring required.
 */
export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) {
    return {
      title: 'Article not found',
      robots: { index: false, follow: false },
    }
  }
  const url = `${SITE_URL}/help/${article.slug}`
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    keywords: article.keywords,
    openGraph: {
      type: 'article',
      url,
      title: article.title,
      description: article.description,
      siteName: 'Lionheart',
      modifiedTime: article.updated,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
    },
  }
}

/* Build a Table of Contents from level-2 headings only. */
function buildToc(blocks: HelpBlock[]): { id: string; text: string }[] {
  return blocks
    .filter(
      (b): b is Extract<HelpBlock, { type: 'heading' }> =>
        b.type === 'heading' && b.level === 2
    )
    .map((b) => ({
      id: b.id ?? slugifyHeading(b.text),
      text: b.text,
    }))
}

function formatUpdated(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function buildJsonLd(article: HelpArticle): string {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: article.title,
    description: article.description,
    datePublished: article.updated,
    dateModified: article.updated,
    author: {
      '@type': 'Organization',
      name: 'Lionheart',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Lionheart',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/help/${article.slug}`,
    },
    keywords: article.keywords?.join(', '),
  }
  return JSON.stringify(ld)
}

export default async function HelpArticlePage({ params }: PageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const category = getCategoryBySlug(article.category)
  const toc = buildToc(article.body)
  const related = getRelatedArticles(article)

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(article) }}
      />

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="px-6 pt-10 max-w-5xl mx-auto"
      >
        <ol className="flex items-center gap-1.5 text-sm text-slate-500">
          <li>
            <Link
              href="/help"
              className="hover:text-slate-900 transition-colors duration-200"
            >
              Help
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden className="text-slate-300">/</li>
              <li className="truncate">{category.title}</li>
            </>
          )}
        </ol>
      </nav>

      {/* Title block */}
      <header className="px-6 pt-6 pb-10 max-w-5xl mx-auto border-b border-slate-200">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-4">
          {article.title}
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-6 max-w-3xl">
          {article.description}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4" aria-hidden />
            {article.readMinutes} min read
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" aria-hidden />
            Updated {formatUpdated(article.updated)}
          </span>
        </div>
      </header>

      {/* Body + ToC */}
      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-12">
        <article className="min-w-0">
          <ArticleBody blocks={article.body} />
        </article>

        {toc.length > 0 && (
          <aside className="hidden lg:block" aria-label="On this page">
            <div className="sticky top-24">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3">
                On this page
              </p>
              <ul className="space-y-2 border-l border-slate-200">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block pl-4 -ml-px py-1 text-sm text-slate-600 border-l border-transparent hover:text-slate-900 hover:border-slate-900 transition-colors duration-200"
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-6">
              Related articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {related.map((rel) => (
                <Link
                  key={rel.slug}
                  href={`/help/${rel.slug}`}
                  className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
                >
                  <h3 className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-slate-700 transition-colors duration-200">
                    {rel.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {rel.description}
                  </p>
                </Link>
              ))}
            </div>
            <div className="mt-10">
              <Link
                href="/help"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-slate-700 transition-colors duration-200"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden />
                Back to all articles
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-2">
            Was this article helpful?
          </h2>
          <p className="text-sm text-slate-600 mb-5">
            If something is missing or unclear, tell us — we update these guides every week.
          </p>
          <Link
            href="/contact?topic=docs"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
          >
            Send feedback
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}

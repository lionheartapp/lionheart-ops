'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const FormBuilder = dynamic(() => import('@/components/forms/builder/FormBuilder'), {
  loading: () => <FormBuilderPageLoading />,
})

function FormBuilderPageLoading() {
  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="h-4 w-52 animate-pulse rounded bg-slate-200" />
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-56 border-r border-slate-200 bg-white p-4 sm:block">
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-9 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        </div>
        <div className="hidden w-72 border-l border-slate-200 bg-white p-4 lg:block">
          <div className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <FormBuilder formId={id} />
}

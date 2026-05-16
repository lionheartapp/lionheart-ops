'use client'

import { use } from 'react'
import FormBuilder from '@/components/forms/builder/FormBuilder'

export default function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <FormBuilder formId={id} />
}

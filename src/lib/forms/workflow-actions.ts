import type { FormFieldWorkflowAction } from '@/lib/forms/schemas'

export type DynamicFieldValues = Record<string, unknown>

export type WorkflowActionField = {
  key: string
  label: string
  workflowActions?: FormFieldWorkflowAction[] | null
}

export type SmartActionMatch = FormFieldWorkflowAction & {
  fieldKey: string
  fieldLabel: string
  value: unknown
}

export function hasMeaningfulValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().length > 0
  return value != null
}

export function actionMatches(action: FormFieldWorkflowAction, value: unknown): boolean {
  if (action.when === 'equals') {
    if (Array.isArray(value)) return value.map(String).includes(String(action.equals ?? ''))
    return String(value ?? '') === String(action.equals ?? '')
  }

  return hasMeaningfulValue(value)
}

export function resolveSmartActionMatches(
  fields: WorkflowActionField[],
  values: DynamicFieldValues,
): SmartActionMatch[] {
  return fields.flatMap((field) => {
    const actions = field.workflowActions ?? []
    const value = values[field.key]

    return actions
      .filter((action) => actionMatches(action, value))
      .map((action) => ({
        ...action,
        fieldKey: field.key,
        fieldLabel: field.label,
        value,
      }))
  })
}

import { describe, expect, it } from 'vitest'
import {
  actionMatches,
  hasMeaningfulValue,
  resolveSmartActionMatches,
} from '@/lib/forms/workflow-actions'
import type { FormFieldWorkflowAction } from '@/lib/forms/schemas'

const notifyAv: FormFieldWorkflowAction = {
  action: 'NOTIFY_TEAM',
  when: 'truthy',
  teamSlug: 'av-production',
}

describe('form workflow actions', () => {
  it('treats only useful values as truthy triggers', () => {
    expect(hasMeaningfulValue(true)).toBe(true)
    expect(hasMeaningfulValue(false)).toBe(false)
    expect(hasMeaningfulValue(' projector ')).toBe(true)
    expect(hasMeaningfulValue('   ')).toBe(false)
    expect(hasMeaningfulValue(['A/V'])).toBe(true)
    expect(hasMeaningfulValue([])).toBe(false)
    expect(hasMeaningfulValue(null)).toBe(false)
  })

  it('matches exact values for strings and multi-select values', () => {
    const action: FormFieldWorkflowAction = {
      action: 'MARK_RESOURCE_NEEDED',
      when: 'equals',
      equals: 'A/V Support',
      resourceType: 'av',
    }

    expect(actionMatches(action, 'A/V Support')).toBe(true)
    expect(actionMatches(action, 'Facilities')).toBe(false)
    expect(actionMatches(action, ['Facilities', 'A/V Support'])).toBe(true)
  })

  it('returns matched actions with field context', () => {
    const matches = resolveSmartActionMatches(
      [
        {
          key: 'needsAv',
          label: 'Do you need A/V?',
          workflowActions: [notifyAv],
        },
        {
          key: 'marketingNeeds',
          label: 'Marketing support',
          workflowActions: [
            {
              action: 'CREATE_EVENT_TASK',
              when: 'equals',
              equals: 'Flyer',
              teamSlug: 'marketing',
              taskTitle: 'Prepare event flyer',
            },
          ],
        },
      ],
      {
        needsAv: true,
        marketingNeeds: ['Social Post', 'Flyer'],
      },
    )

    expect(matches).toHaveLength(2)
    expect(matches[0]).toMatchObject({
      action: 'NOTIFY_TEAM',
      fieldKey: 'needsAv',
      fieldLabel: 'Do you need A/V?',
      value: true,
    })
    expect(matches[1]).toMatchObject({
      action: 'CREATE_EVENT_TASK',
      fieldKey: 'marketingNeeds',
      taskTitle: 'Prepare event flyer',
    })
  })

  it('ignores empty values and fields without actions', () => {
    const matches = resolveSmartActionMatches(
      [
        { key: 'emptyText', label: 'Empty text', workflowActions: [notifyAv] },
        { key: 'plainField', label: 'Plain field' },
      ],
      { emptyText: ' ', plainField: 'filled' },
    )

    expect(matches).toEqual([])
  })
})

import { test, expect } from '../../fixtures'
import { assertOk } from '../../helpers/api'

type CreatedForm = {
  id: string
}

type CreatedField = {
  id: string
}

type FormDetail = {
  fields: Array<{
    id: string
    key: string
    label: string
    workflowActions?: Array<{
      action: string
      when?: string
      teamSlug?: string | null
      taskTitle?: string | null
      note?: string | null
    }> | null
  }>
}

test.describe('Form builder · smart actions', () => {
  let createdFormId: string | null = null

  test.afterEach(async ({ adminApi }) => {
    if (!createdFormId) return
    await adminApi.delete(`/api/forms/${createdFormId}/detail`).catch(() => {})
    createdFormId = null
  })

  test('admin can add a smart action to a form field and see it persist', async ({ adminApi, adminPage }) => {
    const stamp = Date.now()
    const formRes = await adminApi.post<CreatedForm>('/api/forms/hub', {
      name: `E2E APF Smart Actions ${stamp}`,
      description: 'Temporary E2E form for smart action builder coverage',
    })
    expect(formRes.status).toBe(201)
    assertOk(formRes.body)
    createdFormId = formRes.body.data.id

    const fieldRes = await adminApi.post<CreatedField>(`/api/forms/${createdFormId}/fields`, {
      key: `needs_marketing_${stamp}`,
      label: 'Needs marketing support?',
      type: 'CHECKBOX',
      required: false,
      sortOrder: 0,
      pageId: null,
    })
    expect(fieldRes.status).toBe(201)
    assertOk(fieldRes.body)

    await adminPage.goto(`/forms/${createdFormId}/builder`)
    await adminPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

    await adminPage.getByText('Needs marketing support?', { exact: true }).click()
    const propertiesPanel = adminPage.locator('aside').last()
    await propertiesPanel.getByRole('button', { name: /^Smart Actions$/i }).click()
    await propertiesPanel.getByRole('button', { name: /add smart action/i }).click()

    await expect(propertiesPanel.getByText('Create event task').first()).toBeVisible()

    await propertiesPanel.getByRole('button', { name: /^Choose team$/i }).click()
    await adminPage.getByRole('button', { name: /^Marketing$/i }).click()

    await propertiesPanel.getByPlaceholder('Task title').fill('Prepare event flyer')
    await propertiesPanel.getByPlaceholder('Optional note for this action').fill('Created from APF smart action')

    await adminPage.getByRole('button', { name: /^Save$/i }).click()
    await expect
      .poll(async () => {
        const detailRes = await adminApi.get<FormDetail>(`/api/forms/${createdFormId}/detail`)
        assertOk(detailRes.body)
        const field = detailRes.body.data.fields.find((item) => item.id === fieldRes.body.data.id)
        return field?.workflowActions?.[0]?.taskTitle ?? null
      }, { timeout: 15_000 })
      .toBe('Prepare event flyer')

    await adminPage.reload()
    await adminPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await adminPage.getByText('Needs marketing support?', { exact: true }).click()
    await propertiesPanel.getByRole('button', { name: /^Smart Actions$/i }).click()
    await expect(propertiesPanel.getByPlaceholder('Task title')).toHaveValue('Prepare event flyer', { timeout: 10_000 })

    const detailRes = await adminApi.get<FormDetail>(`/api/forms/${createdFormId}/detail`)
    expect(detailRes.status).toBe(200)
    assertOk(detailRes.body)

    const field = detailRes.body.data.fields.find((item) => item.id === fieldRes.body.data.id)
    expect(field?.workflowActions).toEqual([
      expect.objectContaining({
        action: 'CREATE_EVENT_TASK',
        when: 'truthy',
        teamSlug: 'marketing',
        taskTitle: 'Prepare event flyer',
        note: 'Created from APF smart action',
      }),
    ])
  })
})

import { test, expect } from '../../fixtures'
import { assertOk } from '../../helpers/api'
import { ticketTitle } from '../../helpers/data'
import { rawPrisma } from '../../../src/lib/db'

type MaintenanceTicket = {
  id: string
  ticketNumber: string
  title: string
}

function splitResponseUrl(sourceId: string): RegExp {
  return new RegExp(`/api/maintenance/tickets/${sourceId}/split$`)
}

test.describe('Maintenance intelligence workflow', () => {
  const ticketIdsToClean = new Set<string>()

  test.afterEach(async () => {
    const ids = [...ticketIdsToClean]
    ticketIdsToClean.clear()
    if (ids.length === 0) return

    await rawPrisma.maintenanceTicket.deleteMany({
      where: { id: { in: ids } },
    })
  })

  test.afterAll(async () => {
    await rawPrisma.$disconnect()
  })

  test('manager can split a mixed work order into a separate ticket', async ({
    adminApi,
    adminPage,
  }) => {
    const sourceTitle = ticketTitle()
    const splitTitle = `${sourceTitle} split plumbing`

    const created = await adminApi.post<MaintenanceTicket>('/api/maintenance/tickets', {
      title: sourceTitle,
      description: 'E2E source ticket with multiple maintenance issues.',
      category: 'PLUMBING',
      priority: 'MEDIUM',
    })

    expect(created.status).toBe(201)
    assertOk(created.body, 'source maintenance ticket should be created')
    const sourceTicket = created.body.data
    ticketIdsToClean.add(sourceTicket.id)

    await adminPage.goto(`/maintenance/tickets/${sourceTicket.id}`)
    await adminPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await expect(adminPage.getByText(sourceTitle).first()).toBeVisible({ timeout: 15_000 })

    await adminPage.getByRole('button', { name: /^split$/i }).click()

    const drawer = adminPage.getByRole('dialog', { name: /split work order/i })
    await expect(drawer).toBeVisible({ timeout: 5_000 })
    await drawer.getByPlaceholder(/replace broken faucet handle/i).fill(splitTitle)
    await drawer
      .getByPlaceholder(/details that belong only to this work order/i)
      .fill('Separate issue from the mixed source ticket. Track labor and parts apart.')

    const [splitResponse] = await Promise.all([
      adminPage.waitForResponse((response) => {
        return (
          response.request().method() === 'POST' &&
          splitResponseUrl(sourceTicket.id).test(new URL(response.url()).pathname)
        )
      }),
      drawer.getByRole('button', { name: /^create ticket$/i }).click(),
    ])

    expect(splitResponse.status()).toBe(201)
    const splitBody = await splitResponse.json()
    expect(splitBody.ok).toBe(true)
    const splitTicket = splitBody.data as MaintenanceTicket
    ticketIdsToClean.add(splitTicket.id)

    await adminPage.waitForURL(new RegExp(`/maintenance/tickets/${splitTicket.id}$`), {
      timeout: 15_000,
    })
    await expect(adminPage.getByText(splitTitle).first()).toBeVisible({ timeout: 15_000 })

    const sourceDetail = await adminApi.get<MaintenanceTicket>(
      `/api/maintenance/tickets/${sourceTicket.id}`,
    )
    assertOk(sourceDetail.body, 'source ticket should remain readable after split')
    expect(sourceDetail.body.data.id).toBe(sourceTicket.id)
  })
})

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3004'
const preferredOrgSlug = process.env.SMOKE_ORG_SLUG || 'demo'

async function req(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options)
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { res, json }
}

async function resolveOrganizationId() {
  const preferred = await prisma.organization.findFirst({
    where: { slug: preferredOrgSlug },
    select: { id: true },
  })

  if (preferred) return preferred.id

  const fallback = await prisma.organization.findFirst({ select: { id: true } })
  if (!fallback) {
    throw new Error('No organization found in database for smoke test')
  }

  return fallback.id
}

async function ensurePermission(resource, action, createdPermissionIds) {
  let permission = await prisma.permission.findUnique({
    where: {
      resource_action_scope: {
        resource,
        action,
        scope: 'global',
      },
    },
  })

  if (!permission) {
    permission = await prisma.permission.create({
      data: {
        resource,
        action,
        scope: 'global',
        description: `Temporary smoke permission ${resource}:${action}:global`,
      },
    })
    createdPermissionIds.push(permission.id)
  }

  return permission
}

async function ensureSmokeUser(organizationId) {
  const ts = Date.now().toString().slice(-8)
  const email = `smoke+inv${ts}@example.com`
  const password = 'Smoke123!'
  const passwordHash = await bcrypt.hash(password, 10)

  const createdPermissionIds = []

  // Ensure all inventory permissions exist
  const readPerm = await ensurePermission('inventory', 'read', createdPermissionIds)
  const createPerm = await ensurePermission('inventory', 'create', createdPermissionIds)
  const updatePerm = await ensurePermission('inventory', 'update', createdPermissionIds)
  const deletePerm = await ensurePermission('inventory', 'delete', createdPermissionIds)
  const checkoutPerm = await ensurePermission('inventory', 'checkout', createdPermissionIds)
  const checkinPerm = await ensurePermission('inventory', 'checkin', createdPermissionIds)

  const role = await prisma.role.create({
    data: {
      organizationId,
      name: `Smoke Inventory Role ${ts}`,
      slug: `smoke-inv-${ts}`,
      description: 'Temporary role for inventory API smoke tests',
      isSystem: false,
      permissions: {
        create: [
          { permissionId: readPerm.id },
          { permissionId: createPerm.id },
          { permissionId: updatePerm.id },
          { permissionId: deletePerm.id },
          { permissionId: checkoutPerm.id },
          { permissionId: checkinPerm.id },
        ],
      },
    },
  })

  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      firstName: 'Smoke',
      lastName: 'Inventory',
      name: 'Smoke Inventory',
      passwordHash,
      status: 'ACTIVE',
      roleId: role.id,
      role: 'ADMIN',
      schoolScope: 'GLOBAL',
      teamIds: [],
    },
  })

  return {
    userId: user.id,
    email,
    password,
    roleId: role.id,
    roleName: role.name,
    createdPermissionIds,
  }
}

async function runInventorySmoke(email, password, organizationId) {
  // Login to get auth token
  const login = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organizationId }),
  })

  if (!login.res.ok || !login.json?.ok) {
    throw new Error(`Login failed: ${login.res.status} ${JSON.stringify(login.json)}`)
  }

  // Support both cookie-based and token-based auth
  const token = login.json.data?.token
  const setCookie = login.res.headers.get('set-cookie')

  let authHeaders
  if (setCookie) {
    // Extract cookie value for subsequent requests
    const cookieValue = setCookie.split(';')[0]
    authHeaders = {
      Cookie: cookieValue,
      'X-Organization-ID': organizationId,
      'Content-Type': 'application/json',
    }
  } else if (token) {
    authHeaders = {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
      'Content-Type': 'application/json',
    }
  } else {
    throw new Error(`Login succeeded but no auth credential returned: ${JSON.stringify(login.json)}`)
  }

  const ts = Date.now().toString().slice(-6)
  const results = {}

  // a. CREATE — POST /api/inventory
  const createItem = await req('/api/inventory', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `Smoke Test Item ${ts}`,
      category: 'Office Supplies',
      sku: `SMK-${ts}`,
      quantityOnHand: 10,
      reorderThreshold: 2,
    }),
  })
  results.create = createItem.res.status
  if (createItem.res.status !== 201 || !createItem.json?.ok) {
    throw new Error(`Create item failed: ${createItem.res.status} ${JSON.stringify(createItem.json)}`)
  }
  const itemId = createItem.json.data.id
  if (!itemId) throw new Error('Create item returned no id')
  if (createItem.json.data.name !== `Smoke Test Item ${ts}`) {
    throw new Error(`Create item returned wrong name: ${createItem.json.data.name}`)
  }
  if (createItem.json.data.quantityOnHand !== 10) {
    throw new Error(`Create item returned wrong quantityOnHand: ${createItem.json.data.quantityOnHand}`)
  }

  // b. LIST — GET /api/inventory
  const listItems = await req('/api/inventory', { headers: authHeaders })
  results.list = listItems.res.status
  if (!listItems.res.ok || !listItems.json?.ok) {
    throw new Error(`List items failed: ${listItems.res.status} ${JSON.stringify(listItems.json)}`)
  }
  const foundInList = (listItems.json.data || []).some((item) => item.id === itemId)
  if (!foundInList) {
    throw new Error(`Created item not found in list response`)
  }

  // c. LIST with search — GET /api/inventory?search=Smoke
  const searchItems = await req(`/api/inventory?search=Smoke+Test+Item+${ts}`, { headers: authHeaders })
  results.listSearch = searchItems.res.status
  if (!searchItems.res.ok || !searchItems.json?.ok) {
    throw new Error(`Search items failed: ${searchItems.res.status} ${JSON.stringify(searchItems.json)}`)
  }
  const foundInSearch = (searchItems.json.data || []).some((item) => item.id === itemId)
  if (!foundInSearch) {
    throw new Error(`Created item not found in search response`)
  }

  // d. GET by ID — GET /api/inventory/{itemId}
  const getItem = await req(`/api/inventory/${itemId}`, { headers: authHeaders })
  results.getById = getItem.res.status
  if (!getItem.res.ok || !getItem.json?.ok) {
    throw new Error(`Get item by ID failed: ${getItem.res.status} ${JSON.stringify(getItem.json)}`)
  }
  if (getItem.json.data.id !== itemId) {
    throw new Error(`Get item returned wrong id: ${getItem.json.data.id}`)
  }

  // e. UPDATE — PUT /api/inventory/{itemId}
  const updateItem = await req(`/api/inventory/${itemId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: `Updated Smoke Item ${ts}`, quantityOnHand: 20 }),
  })
  results.update = updateItem.res.status
  if (!updateItem.res.ok || !updateItem.json?.ok) {
    throw new Error(`Update item failed: ${updateItem.res.status} ${JSON.stringify(updateItem.json)}`)
  }
  if (updateItem.json.data.quantityOnHand !== 20) {
    throw new Error(`Update item returned wrong quantityOnHand: ${updateItem.json.data.quantityOnHand}`)
  }

  // f. CHECKOUT — POST /api/inventory/{itemId}/checkout
  const checkout = await req(`/api/inventory/${itemId}/checkout`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ quantity: 3 }),
  })
  results.checkout = checkout.res.status
  if (!checkout.res.ok || !checkout.json?.ok) {
    throw new Error(`Checkout failed: ${checkout.res.status} ${JSON.stringify(checkout.json)}`)
  }
  if (checkout.json.data.quantityOnHand !== 17) {
    throw new Error(`Checkout returned wrong quantityOnHand: ${checkout.json.data.quantityOnHand} (expected 17)`)
  }

  // g. TRANSACTIONS — GET /api/inventory/{itemId}/transactions
  const transactions = await req(`/api/inventory/${itemId}/transactions`, { headers: authHeaders })
  results.transactions = transactions.res.status
  if (!transactions.res.ok || !transactions.json?.ok) {
    throw new Error(`Get transactions failed: ${transactions.res.status} ${JSON.stringify(transactions.json)}`)
  }
  const txList = transactions.json.data || []
  if (txList.length !== 1) {
    throw new Error(`Expected 1 transaction, got ${txList.length}`)
  }
  if (txList[0].type !== 'CHECKOUT') {
    throw new Error(`Expected CHECKOUT transaction type, got ${txList[0].type}`)
  }
  const transactionId = txList[0].id

  // h. CHECKIN — POST /api/inventory/{itemId}/checkin
  const checkin = await req(`/api/inventory/${itemId}/checkin`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ transactionId }),
  })
  results.checkin = checkin.res.status
  if (!checkin.res.ok || !checkin.json?.ok) {
    throw new Error(`Checkin failed: ${checkin.res.status} ${JSON.stringify(checkin.json)}`)
  }
  if (checkin.json.data.quantityOnHand !== 20) {
    throw new Error(`Checkin returned wrong quantityOnHand: ${checkin.json.data.quantityOnHand} (expected 20)`)
  }

  // i. INSUFFICIENT STOCK — POST /api/inventory/{itemId}/checkout with quantity: 999
  const insufficientStock = await req(`/api/inventory/${itemId}/checkout`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ quantity: 999 }),
  })
  results.insufficientStock = insufficientStock.res.status
  if (insufficientStock.res.status !== 409) {
    throw new Error(`Expected 409 for insufficient stock, got ${insufficientStock.res.status}`)
  }
  if (insufficientStock.json?.error?.code !== 'INSUFFICIENT_STOCK') {
    throw new Error(`Expected INSUFFICIENT_STOCK error code, got ${insufficientStock.json?.error?.code}`)
  }

  // j. DELETE — DELETE /api/inventory/{itemId}
  const deleteItem = await req(`/api/inventory/${itemId}`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  results.delete = deleteItem.res.status
  if (!deleteItem.res.ok || !deleteItem.json?.ok) {
    throw new Error(`Delete item failed: ${deleteItem.res.status} ${JSON.stringify(deleteItem.json)}`)
  }
  if (!deleteItem.json.data.deleted) {
    throw new Error(`Delete item returned deleted: false`)
  }

  // Verify item is gone from list
  const listAfterDelete = await req('/api/inventory', { headers: authHeaders })
  const foundAfterDelete = (listAfterDelete.json?.data || []).some((item) => item.id === itemId)
  if (foundAfterDelete) {
    throw new Error('Deleted item still appears in list — soft delete not working')
  }
  results.deletedItemGone = true

  return { checks: results }
}

async function main() {
  let smokeUser = null

  try {
    const organizationId = await resolveOrganizationId()
    smokeUser = await ensureSmokeUser(organizationId)
    const result = await runInventorySmoke(smokeUser.email, smokeUser.password, organizationId)

    console.log('✅ Inventory smoke test passed')
    console.log(
      JSON.stringify(
        {
          organizationId,
          smokeUserRole: smokeUser.roleName,
          ...result,
        },
        null,
        2
      )
    )
  } catch (err) {
    console.error('❌ Inventory smoke test failed:', err.message)
    process.exitCode = 1
  } finally {
    if (smokeUser?.userId) {
      await prisma.user.delete({ where: { id: smokeUser.userId } }).catch(() => {})
    }

    if (smokeUser?.roleId) {
      await prisma.role.delete({ where: { id: smokeUser.roleId } }).catch(() => {})
    }

    if (Array.isArray(smokeUser?.createdPermissionIds) && smokeUser.createdPermissionIds.length > 0) {
      await prisma.permission.deleteMany({
        where: {
          id: {
            in: smokeUser.createdPermissionIds,
          },
        },
      }).catch(() => {})
    }

    await prisma.$disconnect()
  }
}

main()

#!/usr/bin/env node

/**
 * CRUD Service Generator
 *
 * Generates a service file with Zod schemas + CRUD functions from a Prisma model name.
 *
 * Usage:
 *   node scripts/generate-service.mjs ModelName
 *   node scripts/generate-service.mjs ModelName --route    # also generates API route files
 *
 * Examples:
 *   node scripts/generate-service.mjs ITDevice
 *   node scripts/generate-service.mjs Building --route
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCamelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function toSnakeScreamCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toUpperCase()
}

function pluralize(str) {
  if (str.endsWith('y') && !str.endsWith('ey') && !str.endsWith('ay') && !str.endsWith('oy')) {
    return str.slice(0, -1) + 'ies'
  }
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('z') || str.endsWith('ch') || str.endsWith('sh')) {
    return str + 'es'
  }
  return str + 's'
}

// ---------------------------------------------------------------------------
// Schema parser — extract fields from schema.prisma
// ---------------------------------------------------------------------------

function parseModelFields(modelName) {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
  const schema = fs.readFileSync(schemaPath, 'utf8')

  const modelRegex = new RegExp(`^model ${modelName}\\s*\\{([\\s\\S]*?)^\\}`, 'm')
  const match = schema.match(modelRegex)
  if (!match) {
    console.error(`Model "${modelName}" not found in schema.prisma`)
    process.exit(1)
  }

  const body = match[1]
  const fields = []

  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    // Skip blank lines, comments, @@attributes, relations (Model[] or Model?)
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue

    const fieldMatch = trimmed.match(/^(\w+)\s+(\w+(?:\[\])?)(\??)\s*(.*)$/)
    if (!fieldMatch) continue

    const [, name, type, optional, rest] = fieldMatch

    // Skip relation fields (arrays or @relation)
    if (type.endsWith('[]') || rest.includes('@relation')) continue
    // Skip foreign key references (other model types — starts with uppercase and isn't a primitive)
    const PRISMA_SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt', 'Decimal', 'Bytes'])
    if (/^[A-Z]/.test(type) && !PRISMA_SCALARS.has(type)) continue
    // Skip auto-managed fields
    if (['id', 'createdAt', 'updatedAt', 'deletedAt', 'organizationId'].includes(name)) continue
    // Skip @default(cuid()) or @default(now()) primary keys
    if (rest.includes('@id')) continue

    const isOptional = optional === '?' || rest.includes('@default')
    const isUnique = rest.includes('@unique')

    fields.push({
      name,
      type,
      isOptional,
      isUnique,
      raw: trimmed,
    })
  }

  return fields
}

function prismaTypeToZod(type, isOptional) {
  const base = {
    String: 'z.string().trim().min(1).max(500)',
    Int: 'z.number().int()',
    Float: 'z.number()',
    Boolean: 'z.boolean()',
    DateTime: 'z.string().datetime()',
    Json: 'z.unknown()',
    BigInt: 'z.bigint()',
  }[type]

  // If it's an enum, we can't know values — use z.string()
  const zodType = base || 'z.string()'
  return isOptional ? `${zodType}.optional().nullable()` : zodType
}

// ---------------------------------------------------------------------------
// Generate service file
// ---------------------------------------------------------------------------

function generateService(modelName, fields) {
  const camel = toCamelCase(modelName)
  const plural = pluralize(camel)
  const scream = toSnakeScreamCase(modelName)
  const pluralScream = toSnakeScreamCase(pluralize(modelName))

  const createFields = fields
    .map((f) => `  ${f.name}: ${prismaTypeToZod(f.type, f.isOptional)},`)
    .join('\n')

  const updateFields = fields
    .map((f) => `  ${f.name}: ${prismaTypeToZod(f.type, true)},`)
    .join('\n')

  return `import { z } from 'zod'
import { prisma } from '@/lib/db'

// ============= Validation Schemas =============

export const Create${modelName}Schema = z.object({
${createFields}
})

export const Update${modelName}Schema = z.object({
${updateFields}
})

export type Create${modelName}Input = z.infer<typeof Create${modelName}Schema>
export type Update${modelName}Input = z.infer<typeof Update${modelName}Schema>

// ============= Service Functions =============

const db = prisma as any

/**
 * List ${plural} with optional search
 */
export async function list${pluralize(modelName)}(opts: {
  limit?: number
  skip?: number
  search?: string
} = {}): Promise<unknown[]> {
  const { limit = 25, skip = 0, search } = opts

  const where: Record<string, unknown> = {}

  if (search?.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: 'insensitive' } },
    ]
  }

  return db.${camel}.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip,
  })
}

/**
 * Count ${plural} (for pagination)
 */
export async function count${pluralize(modelName)}(opts: {
  search?: string
} = {}): Promise<number> {
  const { search } = opts

  const where: Record<string, unknown> = {}

  if (search?.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: 'insensitive' } },
    ]
  }

  return db.${camel}.count({ where })
}

/**
 * Get a single ${camel} by ID
 */
export async function get${modelName}ById(id: string): Promise<unknown | null> {
  return db.${camel}.findUnique({ where: { id } })
}

/**
 * Create a new ${camel}
 */
export async function create${modelName}(
  input: Create${modelName}Input,
): Promise<unknown> {
  const validated = Create${modelName}Schema.parse(input)
  return db.${camel}.create({ data: validated })
}

/**
 * Update an existing ${camel}
 */
export async function update${modelName}(
  id: string,
  input: Update${modelName}Input,
): Promise<unknown> {
  const validated = Update${modelName}Schema.parse(input)
  return db.${camel}.update({
    where: { id },
    data: validated,
  })
}

/**
 * Delete a ${camel}
 */
export async function delete${modelName}(id: string): Promise<void> {
  await db.${camel}.delete({ where: { id } })
}
`
}

// ---------------------------------------------------------------------------
// Generate route files
// ---------------------------------------------------------------------------

function generateListRoute(modelName) {
  const camel = toCamelCase(modelName)
  const kebab = toKebabCase(modelName)
  const scream = toSnakeScreamCase(modelName)
  const pluralScream = toSnakeScreamCase(pluralize(modelName))

  return `import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import * as service from '@/lib/services/${camel}Service'
import { Create${modelName}Schema } from '@/lib/services/${camel}Service'

export const GET = withAuth(
  async ({ searchParams }) => {
    const { page, limit, skip } = parsePagination(searchParams)
    const search = searchParams.get('search') || undefined

    const [total, items] = await Promise.all([
      service.count${pluralize(modelName)}({ search }),
      service.list${pluralize(modelName)}({ limit, skip, search }),
    ])

    return NextResponse.json(ok(items, paginationMeta(total, { page, limit, skip })))
  },
  // TODO: Set correct permission
  // { permission: PERMISSIONS.${pluralScream}_READ }
)

export const POST = withAuth(
  async ({ body }) => {
    const item = await service.create${modelName}(body)
    return NextResponse.json(ok(item), { status: 201 })
  },
  // TODO: Set correct permission + schema
  { schema: Create${modelName}Schema }
  // { permission: PERMISSIONS.${pluralScream}_CREATE, schema: Create${modelName}Schema }
)
`
}

function generateDetailRoute(modelName) {
  const camel = toCamelCase(modelName)
  const scream = toSnakeScreamCase(modelName)
  const pluralScream = toSnakeScreamCase(pluralize(modelName))

  return `import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import * as service from '@/lib/services/${camel}Service'
import { Update${modelName}Schema } from '@/lib/services/${camel}Service'

export const GET = withAuth(
  async ({ params }) => {
    const item = await service.get${modelName}ById(params.id)
    if (!item) {
      return NextResponse.json(fail('NOT_FOUND', '${modelName} not found'), { status: 404 })
    }
    return NextResponse.json(ok(item))
  },
)

export const PATCH = withAuth(
  async ({ params, body }) => {
    const item = await service.update${modelName}(params.id, body)
    return NextResponse.json(ok(item))
  },
  // TODO: Set correct permission + schema
  { schema: Update${modelName}Schema }
  // { permission: PERMISSIONS.${pluralScream}_UPDATE, schema: Update${modelName}Schema }
)

export const DELETE = withAuth(
  async ({ params }) => {
    await service.delete${modelName}(params.id)
    return NextResponse.json(ok({ deleted: true }))
  },
  // TODO: Set correct permission
  // { permission: PERMISSIONS.${pluralScream}_DELETE }
)
`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const modelName = process.argv[2]
const generateRoute = process.argv.includes('--route')

if (!modelName) {
  console.error('Usage: node scripts/generate-service.mjs ModelName [--route]')
  console.error('Example: node scripts/generate-service.mjs ITDevice --route')
  process.exit(1)
}

// Validate model exists
const fields = parseModelFields(modelName)
console.log(`Found model ${modelName} with ${fields.length} fields`)

const camel = toCamelCase(modelName)
const kebab = toKebabCase(modelName)

// Generate service
const servicePath = path.join(process.cwd(), 'src', 'lib', 'services', `${camel}Service.ts`)
if (fs.existsSync(servicePath)) {
  console.log(`⚠ Service already exists: ${servicePath}`)
  console.log('  Skipping service generation (delete the file first to regenerate)')
} else {
  const serviceContent = generateService(modelName, fields)
  fs.mkdirSync(path.dirname(servicePath), { recursive: true })
  fs.writeFileSync(servicePath, serviceContent)
  console.log(`Created service: ${servicePath}`)
}

// Generate routes
if (generateRoute) {
  const routeDir = path.join(process.cwd(), 'src', 'app', 'api', kebab)
  const listRoutePath = path.join(routeDir, 'route.ts')
  const detailRoutePath = path.join(routeDir, '[id]', 'route.ts')

  if (fs.existsSync(listRoutePath)) {
    console.log(`⚠ List route already exists: ${listRoutePath}`)
  } else {
    fs.mkdirSync(path.dirname(listRoutePath), { recursive: true })
    fs.writeFileSync(listRoutePath, generateListRoute(modelName))
    console.log(`Created list route: ${listRoutePath}`)
  }

  if (fs.existsSync(detailRoutePath)) {
    console.log(`⚠ Detail route already exists: ${detailRoutePath}`)
  } else {
    fs.mkdirSync(path.dirname(detailRoutePath), { recursive: true })
    fs.writeFileSync(detailRoutePath, generateDetailRoute(modelName))
    console.log(`Created detail route: ${detailRoutePath}`)
  }
}

console.log('\nDone! Next steps:')
console.log('  1. Review generated Zod schemas — adjust field constraints')
console.log('  2. Add include/select clauses for relations you need')
console.log('  3. Uncomment and set correct PERMISSIONS constants')
console.log('  4. Add search fields beyond "name" if needed')

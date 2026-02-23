import { prisma } from '../src/lib/db'
import { runWithOrgContext } from '../src/lib/org-context'

async function main() {
  const email = 'mkerley@linfield.com'
  const orgId = 'cmly7nsqt0000cdtmpyswsrlj'

  console.log('🔍 Testing org-scoped prisma...\n')

  const result = await runWithOrgContext(orgId, async () => {
    console.log('Inside org context, looking for user...')
    const user = await prisma.user.findFirst({
      where: { email }
    })
    console.log('User found:', user ? { id: user.id, email: user.email, orgId: user.organizationId } : null)
    return user
  })

  console.log('\nFinal result:', result ? 'FOUND' : 'NOT FOUND')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
  })
  .finally(async () => {
    process.exit(0)
  })

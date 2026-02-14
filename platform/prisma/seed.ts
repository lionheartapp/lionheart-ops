import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.knowledgeBaseEntry.count()
  if (count > 0) return

  await prisma.knowledgeBaseEntry.createMany({
    data: [
      {
        partName: 'Projector lamp',
        keywords: ['projector bulb', 'projector lamp', 'lamp'],
        manualUrl: 'https://example.com/manuals/projector-lamp.pdf',
        repairSteps: [
          'Power off projector and allow to cool 30+ minutes.',
          'Locate lamp door, remove screws, extract old lamp assembly.',
          'Insert new lamp, secure door, reset lamp hours in menu.',
        ],
      },
      {
        partName: 'HVAC air filter',
        keywords: ['hvac filter', 'air filter', 'filter', 'furnace filter'],
        manualUrl: 'https://example.com/manuals/hvac-filter.pdf',
        repairSteps: [
          'Turn off HVAC unit at thermostat.',
          'Remove filter panel, slide out old filter.',
          'Insert new filter (check arrow for airflow direction), replace panel.',
        ],
      },
      {
        partName: 'Document camera',
        keywords: ['doc cam', 'document camera', 'elmo'],
        manualUrl: 'https://example.com/manuals/doc-camera.pdf',
        repairSteps: [
          'Unplug power and USB, inspect arm/lens for damage.',
          'Clean lens with microfiber; check mount screws.',
          'Reconnect and recalibrate via software if needed.',
        ],
      },
      {
        partName: 'Smartboard power supply',
        keywords: ['smartboard', 'power supply', 'interactive whiteboard'],
        manualUrl: 'https://example.com/manuals/smartboard-psu.pdf',
        repairSteps: [
          'Power off and disconnect Smartboard.',
          'Remove rear cover, disconnect and replace power supply module.',
          'Reconnect cables, replace cover, power on and test.',
        ],
      },
    ],
  })
  console.log('KnowledgeBase seeded')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

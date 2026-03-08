import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const tag = req.nextUrl.searchParams.get('tag')
    if (!tag) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Asset tag is required'), { status: 400 })
    }

    // Public lookup - find device by asset tag across all orgs
    // Returns minimal info suitable for QR scan
    const device = await rawPrisma.iTDevice.findFirst({
      where: { assetTag: tag, deletedAt: null },
      select: {
        id: true,
        assetTag: true,
        deviceType: true,
        make: true,
        model: true,
        status: true,
        serialNumber: true,
        school: { select: { name: true } },
        building: { select: { name: true } },
        room: { select: { roomNumber: true, displayName: true } },
      },
    })

    if (!device) {
      return NextResponse.json(fail('NOT_FOUND', 'Device not found'), { status: 404 })
    }

    return NextResponse.json(ok({
      assetTag: device.assetTag,
      deviceType: device.deviceType,
      make: device.make,
      model: device.model,
      status: device.status,
      serialNumber: device.serialNumber,
      location: [
        device.school?.name,
        device.building?.name,
        device.room?.displayName || device.room?.roomNumber,
      ].filter(Boolean).join(' > ') || null,
    }))
  } catch (error) {
    console.error('[GET /api/it/devices/lookup]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

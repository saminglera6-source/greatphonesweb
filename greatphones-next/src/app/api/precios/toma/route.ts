import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, clientIpKey } from '@/lib/rate-limit'

/**
 * Endpoint PÚBLICO de precios de toma.
 *
 * Expone los precios de toma (priceTradeIn) que la página /sell usa para
 * calcular la tasación. Solo incluye campos de precio/fallas, sin datos
 * sensibles de admin (updatedBy, etc.).
 */
export async function GET(request: Request) {
  try {
    const ip = clientIpKey(request)
    const rl = await rateLimit(`precios-toma:${ip}`, 120, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
    }

    const rows = await prisma.priceTradeIn.findMany({
      where: { active: true, deletedAt: null },
      orderBy: [{ orden: 'asc' }, { modelo: 'asc' }],
      select: {
        id: true,
        modelo: true,
        impecable: true,
        bateria: true,
        pantalla: true,
        camara: true,
        microfono: true,
        parlante: true,
        tapa: true,
        marco: true,
        pin: true,
      },
    })

    return NextResponse.json(rows, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Error al cargar precios de toma' }, { status: 500 })
  }
}
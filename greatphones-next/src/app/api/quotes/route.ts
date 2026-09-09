import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendNewQuoteEmail } from '@/lib/email'
import { requireSession, requireAdmin } from '@/lib/auth-guard'
import {
  arcaIsConfigured,
  arcaPtoVta,
  getArcaClient,
  buildFacturarOptsFromQuote,
  caeExpiryToDate,
} from '@/lib/arca'
import { logger } from '@/lib/logger'
import { registerEntry } from '@/lib/accounting'
import { productCache } from '@/lib/cache'

export async function GET(request: Request) {
  try {
    const user = await requireSession(request)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    
    const where: any = {}
    
    if (status) {
      where.status = status
    }
    
    if (user.role !== 'ADMIN') {
      where.userId = user.id
    } else if (searchParams.get('userId')) {
      where.userId = searchParams.get('userId')
    }

    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: 'insensitive' } },
        { clientPhone: { contains: search, mode: 'insensitive' } },
        { clientDni: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { device: { contains: search, mode: 'insensitive' } },
      ]
    }
    
    const total = await prisma.quote.count({ where })
    const totalPages = Math.ceil(total / limit)
    
    const quotes = await prisma.quote.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })
    
    return NextResponse.json({ data: quotes, page, limit, total, totalPages })
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const user = await requireSession(request)
    const {
      device,
      storage,
      condition,
      basePrice,
      finalPrice,
      bonus,
      envio,
      payment,
      clientName,
      clientDni,
      clientPhone,
      clientCity,
      clientCp,
      clientProvince,
      signature,
      photos,
      dniPhotos,
      extras,
      batteryHealth,
    } = body

    if (!device || !storage || !condition || !finalPrice) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const quoteUserId = user.role === 'ADMIN' && body.userId ? body.userId : user.id
    
    const code = `QT-${Date.now()}`
    
    const quote = await prisma.quote.create({
      data: {
        code,
        userId: quoteUserId,
        device,
        storage,
        condition,
        basePrice: parseInt(basePrice) || 0,
        finalPrice: parseInt(finalPrice),
        bonus: bonus ? parseInt(bonus) : null,
        status: 'PENDING',
        envio,
        payment,
        clientName,
        clientDni,
        clientPhone,
        clientCity,
        clientCp,
        clientProvince,
        signature,
        photos: photos || [],
        dniPhotos: dniPhotos || [],
        extras: extras || [],
        batteryHealth: batteryHealth != null ? parseInt(batteryHealth) : null,
      },
    })

    // Send notification email to admin (non-blocking)
    sendNewQuoteEmail({
      code: quote.code,
      device: quote.device,
      storage: quote.storage,
      condition: quote.condition,
      finalPrice: quote.finalPrice,
      clientName: quote.clientName || 'No especificado',
      clientPhone: quote.clientPhone || 'No especificado',
      clientEmail: quote.clientName ? '' : '',
      photos: quote.photos || [],
      extras: quote.extras || [],
    }).catch(err => console.error('[QUOTE] Error sending email:', err))
    
    return NextResponse.json({ success: true, quote }, { status: 201 })
  } catch (error) {
    console.error('Error creating quote:', error)
    const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null ? (error as any).message || JSON.stringify(error) : String(error)
    return NextResponse.json({ error: message }, { status: (error as any).status || 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { id, status, rejectReason } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Flujo especial: aprobación emite factura ARCA automáticamente
    if (status === 'APPROVED') {
      const adminUser = await requireAdmin(request)
      const quote = await prisma.quote.findUnique({
        where: { id },
        include: { purchasedDevice: true },
      })
      if (!quote) {
        return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
      }

      // Verificar si ya tiene factura
      const existingInvoice = await prisma.invoice.findUnique({ where: { quoteId: id } })
      if (existingInvoice) {
        return NextResponse.json(
          {
            error: `La cotización ya tiene factura ${existingInvoice.type} N° ${existingInvoice.number}`,
          },
          { status: 409 }
        )
      }

      let invoice = null
      let arcaError: string | null = null
      let createdById = adminUser.id

      if (arcaIsConfigured()) {
        try {
          const built = buildFacturarOptsFromQuote({
            device: quote.device,
            storage: quote.storage,
            finalPrice: quote.finalPrice,
            clientDni: quote.clientDni,
            clientName: quote.clientName,
          })
          const arca = getArcaClient()
          const result = await arca.facturar(built.opts)

          if (!result.aprobada) {
            arcaError = 'ARCA rechazó el comprobante'
            const details = result.observaciones.map(o => ({ code: o.code, msg: o.msg }))
            logger.error({ quoteId: id, observaciones: details }, 'ARCA rejected invoice')
            return NextResponse.json(
              {
                error: arcaError,
                observaciones: details,
              },
              { status: 400 }
            )
          }

          invoice = await prisma.invoice.create({
            data: {
              quoteId: id,
              type: 'C',
              pos: result.ptoVta || arcaPtoVta(),
              number: result.cbteNro,
              cae: result.cae,
              caeExpiry: result.caeVencimiento ? caeExpiryToDate(result.caeVencimiento) : null,
              total: Math.round(built.total),
              netAmount: Math.round(built.neto),
              ivaAmount: Math.round(built.iva),
              status: 'APPROVED',
            },
          })

          logger.info(
            { quoteId: id, invoiceId: invoice.id, cae: invoice.cae, total: invoice.total },
            'Invoice created from approved quote'
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error desconocido de ARCA'
          logger.error({ err, quoteId: id }, 'ARCA error while creating invoice')
          return NextResponse.json(
            { error: `Error al facturar con ARCA: ${message}` },
            { status: 502 }
          )
        }
      } else {
        arcaError = 'ARCA no está configurado. Aceptada sin factura.'
        logger.warn({ quoteId: id }, 'ARCA not configured, approving quote without invoice')
      }

      // Registrar la compra en "Dispositivos comprados" siempre que la
      // cotización se apruebe, haya factura ARCA o no. Así toda cotización
      // aprobada queda visible en el historial de comprados.
      if (!quote.purchasedDevice) {
        await prisma.purchasedDevice.create({
          data: {
            code: `PUR-${Date.now()}`,
            quoteId: id,
            brand: quote.device.split(' ')[0] || 'Genérico',
            device: quote.device,
            storage: quote.storage,
            condition: quote.condition,
            batteryHealth: quote.batteryHealth,
            clientName: quote.clientName || 'Sin nombre',
            clientDni: quote.clientDni,
            clientPhone: quote.clientPhone,
            clientCity: quote.clientCity,
            clientProvince: quote.clientProvince,
            purchasePrice: quote.finalPrice,
            invoiceId: invoice ? invoice.id : null,
            createdById,
          },
        })
        logger.info({ quoteId: id }, 'PurchasedDevice registered')
      }

      // Núcleo contable + inventario: aprobar la cotización es comprarle el
      // equipo al cliente → EGRESO por el precio acordado y alta del equipo en
      // el inventario (queda "En stock" listo para vender). Idempotente: si ya
      // existe el InventoryItem de esta cotización, no se repite.
      const invCode = `CMP-${quote.code}`
      const yaIngresado = await prisma.inventoryItem.findUnique({ where: { code: invCode } })
      if (!yaIngresado && quote.finalPrice > 0) {
        try {
          const brand = quote.device.split(' ')[0] || 'Apple'
          let producto = await prisma.product.findFirst({
            where: { brand, modelGroup: quote.device, storage: quote.storage || null },
          })
          if (producto) {
            producto = await prisma.product.update({
              where: { id: producto.id },
              data: { stock: { increment: 1 }, deletedAt: null },
            })
          } else {
            producto = await prisma.product.create({
              data: {
                name: quote.device,
                brand,
                modelGroup: quote.device,
                ico: '📱',
                condition: quote.condition || 'Bueno',
                price: Math.round(quote.finalPrice * 1.3),
                cost: quote.finalPrice,
                stock: 1,
                type: 'celular',
                storage: quote.storage || undefined,
                battery: quote.batteryHealth ?? undefined,
                description: `Comprado por cotización ${quote.code}`,
              },
            })
          }
          await prisma.inventoryItem.create({
            data: {
              code: invCode,
              imei: quote.code ? `NOIMEI-${quote.code}` : `NOIMEI-${Date.now().toString().slice(-9)}`,
              brand,
              modelName: quote.device,
              storage: quote.storage || null,
              deviceType: 'celular',
              purchasePrice: quote.finalPrice,
              cosmeticCondition: quote.condition || 'Bueno',
              functionalCondition: quote.condition || null,
              batteryHealth: quote.batteryHealth ?? null,
              purchasedFrom: quote.clientName || 'Cliente (cotización online)',
              status: 'IN_STOCK',
              targetPrice: Math.round(quote.finalPrice * 1.3),
              productId: producto.id,
              createdById: createdById,
              notes: `Alta automática al aprobar la cotización ${quote.code}`,
            },
          })
          productCache.clear()
          await registerEntry({
            source: 'COMPRA',
            operationId: invCode,
            description: `Compra de equipo usado (cotización ${quote.code}): ${quote.device}`,
            category: 'COMPRA_EQUIPO',
            type: 'EGRESO',
            means: quote.payment === 'transfer' || quote.payment === 'mp' ? 'TRANSFERENCIA' : 'EFECTIVO',
            amount: quote.finalPrice,
            operator: adminUser.email || null,
            createdById: adminUser.id,
          })
          logger.info({ quoteId: id, invCode }, 'InventoryItem + EGRESO created from approved quote')
        } catch (e) {
          logger.error({ err: e, quoteId: id }, 'Error creating inventory/EGRESO from quote')
        }
      }

      // Actualizar estado de la cotización (siempre, haya factura o no)
      const updated = await prisma.quote.update({
        where: { id },
        data: {
          status: 'APPROVED',
        },
        include: {
          invoice: true,
          user: { select: { id: true, name: true, email: true } },
        },
      })

      return NextResponse.json({
        success: true,
        quote: updated,
        invoice,
        warning: arcaError,
      })
    }

    // Otros status (REJECTED, REVIEWING, COMPLETED): update simple
    const quote = await prisma.quote.update({
      where: { id },
      data: {
        status,
        ...(rejectReason ? { rejectReason } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        invoice: true,
      },
    })

    return NextResponse.json({ success: true, quote })
  } catch (error) {
    console.error('Error updating quote:', error)
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID de cotización requerido' }, { status: 400 })
    }

    await prisma.quote.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting quote:', error)
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 })
  }
}

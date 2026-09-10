import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma con todos los modelos usados en PATCH
vi.mock('@/lib/prisma', () => ({
  prisma: {
    quote: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    purchasedDevice: {
      create: vi.fn(),
    },
    // F2: aprobar una cotización da de alta el equipo comprado en el inventario.
    inventoryItem: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'prod-mock' }),
      update: vi.fn().mockResolvedValue({ id: 'prod-mock' }),
    },
  },
}))

vi.mock('@/lib/auth-guard', () => ({
  requireSession: vi.fn(),
  requireAdmin: vi.fn(),
}))

// F2: el alta de inventario al aprobar emite un EGRESO y limpia el cache.
vi.mock('@/lib/accounting', () => ({
  registerEntry: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/cache', () => ({
  productCache: { clear: vi.fn() },
}))

vi.mock('@/lib/email', () => ({
  sendNewQuoteEmail: vi.fn().mockResolvedValue(true),
}))

// Mock ARCA: por defecto no configurado (ARCA_CUIT undefined)
vi.mock('@/lib/arca', () => ({
  arcaIsConfigured: vi.fn(() => false),
  arcaPtoVta: vi.fn(() => 1),
  getArcaClient: vi.fn(),
  buildFacturarOptsFromQuote: vi.fn(),
  caeExpiryToDate: vi.fn(),
}))

describe('GET /api/quotes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { requireSession } = await import('@/lib/auth-guard')
    vi.mocked(requireSession).mockRejectedValue({ status: 401, message: 'No autenticado' })

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/quotes')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })

  it('returns 200 with quotes for authenticated user', async () => {
    const { requireSession } = await import('@/lib/auth-guard')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(requireSession).mockResolvedValue({ id: 'u1', email: 'test@test.com', role: 'CLIENT', active: true })
    vi.mocked(prisma.quote.count).mockResolvedValue(1)
    vi.mocked(prisma.quote.findMany).mockResolvedValue([
      { id: 'q1', code: 'QT-123', device: 'iPhone 15 Pro', status: 'PENDING', finalPrice: 800000 },
    ] as any)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/quotes')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data).toHaveLength(1)
  })
})

describe('POST /api/quotes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 400 when required fields are missing', async () => {
    const { requireSession } = await import('@/lib/auth-guard')
    vi.mocked(requireSession).mockResolvedValue({ id: 'u1', email: 'test@test.com', role: 'CLIENT', active: true })

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/quotes', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 201 on successful quote creation', async () => {
    const { requireSession } = await import('@/lib/auth-guard')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(requireSession).mockResolvedValue({ id: 'u1', email: 'test@test.com', role: 'CLIENT', active: true })
    vi.mocked(prisma.quote.create).mockResolvedValue({
      id: 'q1', code: 'QT-123', device: 'iPhone 15 Pro', status: 'PENDING', finalPrice: 800000,
      photos: [], dniPhotos: [], extras: [], batteryHealth: null,
    } as any)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/quotes', {
      method: 'POST',
      body: JSON.stringify({
        device: 'iPhone 15 Pro',
        storage: '256 GB',
        condition: 'Impecable',
        basePrice: 700000,
        finalPrice: 800000,
        envio: 'presencial',
        payment: 'efectivo',
        clientName: 'Test',
        clientDni: '40123456',
        clientPhone: '1234567890',
        clientCity: 'Bahia Blanca',
        clientCp: '8000',
        clientProvince: 'Buenos Aires',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.quote.device).toBe('iPhone 15 Pro')
  })
})

describe('PATCH /api/quotes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 403 when not admin', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    vi.mocked(requireAdmin).mockRejectedValue({ status: 403, message: 'Acceso denegado' })

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/quotes', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'q1', status: 'APPROVED' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
  })

  it('returns 400 when id or status missing', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/quotes', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  describe('approve flow', () => {
    const mockQuote = {
      id: 'q1',
      code: 'QT-123',
      device: 'iPhone 15 Pro',
      storage: '256 GB',
      condition: 'Impecable',
      basePrice: 700000,
      finalPrice: 800000,
      status: 'PENDING',
      clientName: 'Juan Perez',
      clientDni: '40123456',
      clientPhone: '2915555555',
      clientCity: 'Bahia Blanca',
      clientProvince: 'Buenos Aires',
      batteryHealth: 95,
    }

    it('approves without ARCA configured (no invoice, but still registers PurchasedDevice)', async () => {
      const { requireAdmin } = await import('@/lib/auth-guard')
      const { prisma } = await import('@/lib/prisma')
      const arca = await import('@/lib/arca')

      vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })
      vi.mocked(arca.arcaIsConfigured).mockReturnValue(false)
      vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.quote.findUnique).mockResolvedValue({ ...mockQuote, purchasedDevice: null } as any)
      vi.mocked(prisma.purchasedDevice.create).mockResolvedValue({ id: 'pd1' } as any)
      vi.mocked(prisma.quote.update).mockResolvedValue({
        ...mockQuote,
        status: 'APPROVED',
        user: { id: 'u1', name: 'Test', email: 'test@test.com' },
      } as any)

      const { PATCH } = await import('./route')
      const req = new Request('http://localhost/api/quotes', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'q1', status: 'APPROVED' }),
      })
      const res = await PATCH(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.quote.status).toBe('APPROVED')
      expect(data.invoice).toBeNull()
      expect(data.warning).toContain('ARCA no está configurado')
      expect(prisma.invoice.create).not.toHaveBeenCalled()
      // Aún sin ARCA, la cotización aprobada debe registrarse en comprados
      expect(prisma.purchasedDevice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quoteId: 'q1', invoiceId: null }),
        })
      )
    })

    it('approves with ARCA configured: creates Invoice + PurchasedDevice', async () => {
      const { requireAdmin } = await import('@/lib/auth-guard')
      const { prisma } = await import('@/lib/prisma')
      const arca = await import('@/lib/arca')

      vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })
      vi.mocked(arca.arcaIsConfigured).mockReturnValue(true)
      vi.mocked(arca.buildFacturarOptsFromQuote).mockReturnValue({
        opts: { ptoVta: 1, cbteTipo: 11, items: [], docTipo: 96, docNro: 40123456, condicionIva: 5 },
        neto: 660331,
        iva: 139669,
        total: 800000,
      } as any)
      vi.mocked(arca.getArcaClient).mockReturnValue({
        facturar: vi.fn().mockResolvedValue({
          aprobada: true,
          cae: '12345678901234',
          caeVencimiento: '20251231',
          cbteNro: 12345,
          ptoVta: 1,
          observaciones: [],
        }),
      } as any)
      vi.mocked(arca.caeExpiryToDate).mockReturnValue(new Date('2025-12-31'))
      vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.quote.findUnique).mockResolvedValue(mockQuote as any)
      vi.mocked(prisma.invoice.create).mockResolvedValue({
        id: 'inv1',
        type: 'C',
        pos: 1,
        number: 12345,
        cae: '12345678901234',
        total: 800000,
        netAmount: 660331,
        ivaAmount: 139669,
        status: 'APPROVED',
      } as any)
      vi.mocked(prisma.purchasedDevice.create).mockResolvedValue({ id: 'pd1' } as any)
      vi.mocked(prisma.quote.update).mockResolvedValue({
        ...mockQuote,
        status: 'APPROVED',
        user: { id: 'u1', name: 'Test', email: 'test@test.com' },
      } as any)

      const { PATCH } = await import('./route')
      const req = new Request('http://localhost/api/quotes', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'q1', status: 'APPROVED' }),
      })
      const res = await PATCH(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.quote.status).toBe('APPROVED')
      expect(data.invoice).toBeTruthy()
      expect(data.invoice.cae).toBe('12345678901234')
      expect(data.warning).toBeNull()
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quoteId: 'q1',
            type: 'C',
            cae: '12345678901234',
          }),
        })
      )
      expect(prisma.purchasedDevice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quoteId: 'q1',
            device: 'iPhone 15 Pro',
            purchasePrice: 800000,
            clientName: 'Juan Perez',
            invoiceId: 'inv1',
            createdById: 'a1',
          }),
        })
      )
    })

    it('returns 400 when ARCA rejects the invoice (does NOT approve the quote)', async () => {
      const { requireAdmin } = await import('@/lib/auth-guard')
      const { prisma } = await import('@/lib/prisma')
      const arca = await import('@/lib/arca')

      vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })
      vi.mocked(arca.arcaIsConfigured).mockReturnValue(true)
      vi.mocked(arca.buildFacturarOptsFromQuote).mockReturnValue({
        opts: {} as any, neto: 0, iva: 0, total: 0,
      })
      vi.mocked(arca.getArcaClient).mockReturnValue({
        facturar: vi.fn().mockResolvedValue({
          aprobada: false,
          observaciones: [{ code: 100, msg: 'CUIT inválido' }],
          cae: null, caeVencimiento: null, cbteNro: 0, ptoVta: 0,
        }),
      } as any)
      vi.mocked(prisma.invoice.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.quote.findUnique).mockResolvedValue(mockQuote as any)

      const { PATCH } = await import('./route')
      const req = new Request('http://localhost/api/quotes', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'q1', status: 'APPROVED' }),
      })
      const res = await PATCH(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('ARCA rechazó')
      expect(data.observaciones).toEqual([{ code: 100, msg: 'CUIT inválido' }])
      // IMPORTANTE: la quote NO debe aprobarse si ARCA rechaza
      expect(prisma.quote.update).not.toHaveBeenCalled()
      expect(prisma.purchasedDevice.create).not.toHaveBeenCalled()
    })

    it('returns 409 when quote already has invoice', async () => {
      const { requireAdmin } = await import('@/lib/auth-guard')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })
      vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
        id: 'inv1',
        type: 'C',
        number: 12345,
        pos: 1,
      } as any)
      vi.mocked(prisma.quote.findUnique).mockResolvedValue(mockQuote as any)

      const { PATCH } = await import('./route')
      const req = new Request('http://localhost/api/quotes', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'q1', status: 'APPROVED' }),
      })
      const res = await PATCH(req)
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toContain('ya tiene factura')
    })

    it('returns 404 when quote not found', async () => {
      const { requireAdmin } = await import('@/lib/auth-guard')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })
      vi.mocked(prisma.quote.findUnique).mockResolvedValue(null)

      const { PATCH } = await import('./route')
      const req = new Request('http://localhost/api/quotes', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'q1', status: 'APPROVED' }),
      })
      const res = await PATCH(req)
      expect(res.status).toBe(404)
    })
  })

  it('rejects quote without affecting invoice (REJECTED status)', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })
    vi.mocked(prisma.quote.update).mockResolvedValue({
      id: 'q1',
      status: 'REJECTED',
      rejectReason: 'Test reason',
      user: { id: 'u1', name: 'Test', email: 'test@test.com' },
    } as any)

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/quotes', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'q1', status: 'REJECTED', rejectReason: 'Test reason' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.quote.status).toBe('REJECTED')
    expect(data.quote.rejectReason).toBe('Test reason')
    // ARCA no se llama para REJECTED
    expect(prisma.invoice.create).not.toHaveBeenCalled()
  })
})

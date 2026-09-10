import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    purchasedDevice: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-guard', () => ({
  requireAdmin: vi.fn(),
}))

describe('GET /api/admin/purchased', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 500 when not admin', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Acceso denegado'))

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/admin/purchased')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })

  it('returns paginated list with metrics when admin', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })

    const mockItems = [
      {
        id: 'pd1',
        code: 'PUR-1',
        quoteId: 'q1',
        brand: 'Apple',
        device: 'iPhone 13',
        storage: '128 GB',
        condition: 'Impecable',
        clientName: 'Juan',
        purchasePrice: 200000,
        invoiceId: 'inv1',
        receivedAt: new Date('2025-12-01'),
        createdAt: new Date('2025-12-01'),
        updatedAt: new Date('2025-12-01'),
        invoice: {
          id: 'inv1', type: 'C', number: 12345, pos: 1,
          cae: '12345678901234', total: 200000,
          createdAt: new Date('2025-12-01'),
        },
        createdBy: { id: 'a1', name: 'Admin', email: 'admin@test.com' },
      },
    ]

    vi.mocked(prisma.purchasedDevice.findMany).mockResolvedValue(mockItems as any)
    vi.mocked(prisma.purchasedDevice.count).mockResolvedValue(1)
    vi.mocked(prisma.purchasedDevice.aggregate).mockResolvedValue({
      _sum: { purchasePrice: 200000 },
      _avg: { purchasePrice: 200000 },
    } as any)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/admin/purchased')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data).toHaveLength(1)
    expect(data.total).toBe(1)
    expect(data.page).toBe(1)
    expect(data.metrics.totalSpent).toBe(200000)
    expect(data.metrics.avgSpent).toBe(200000)
  })

  it('respects pagination params', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })
    vi.mocked(prisma.purchasedDevice.findMany).mockResolvedValue([])
    vi.mocked(prisma.purchasedDevice.count).mockResolvedValue(100)
    vi.mocked(prisma.purchasedDevice.aggregate).mockResolvedValue({
      _sum: { purchasePrice: 10000000 },
      _avg: { purchasePrice: 200000 },
    } as any)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/admin/purchased?page=3&limit=10')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.page).toBe(3)
    expect(data.limit).toBe(10)
    expect(data.totalPages).toBe(10) // 100 items / 10 per page
    expect(prisma.purchasedDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20, // (page 3 - 1) * 10
        take: 10,
      })
    )
  })

  it('filters by search term', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })
    vi.mocked(prisma.purchasedDevice.findMany).mockResolvedValue([])
    vi.mocked(prisma.purchasedDevice.count).mockResolvedValue(0)
    vi.mocked(prisma.purchasedDevice.aggregate).mockResolvedValue({
      _sum: { purchasePrice: 0 },
      _avg: { purchasePrice: 0 },
    } as any)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/admin/purchased?search=juan')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(prisma.purchasedDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ clientName: expect.objectContaining({ contains: 'juan', mode: 'insensitive' }) }),
          ]),
        }),
      })
    )
  })

  it('caps limit at 100 to prevent DoS', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })
    vi.mocked(prisma.purchasedDevice.findMany).mockResolvedValue([])
    vi.mocked(prisma.purchasedDevice.count).mockResolvedValue(0)
    vi.mocked(prisma.purchasedDevice.aggregate).mockResolvedValue({
      _sum: { purchasePrice: 0 },
      _avg: { purchasePrice: 0 },
    } as any)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/admin/purchased?limit=999999')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(prisma.purchasedDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })
})

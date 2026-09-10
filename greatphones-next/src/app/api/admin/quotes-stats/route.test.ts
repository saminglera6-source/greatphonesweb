import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quote: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/auth-guard', () => ({
  requireAdmin: vi.fn(),
  handleRouteError: (e: any) => new Response(JSON.stringify({ error: e.message }), { status: 500 }),
}))

describe('GET /api/admin/quotes-stats', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 403 when not admin', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Acceso denegado'))

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/admin/quotes-stats')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })

  it('returns full stats structure when admin', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })

    // Mock counts: total, pending, approved, rejected, reviewing, completed
    vi.mocked(prisma.quote.count)
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(20)  // pending
      .mockResolvedValueOnce(50)  // approved
      .mockResolvedValueOnce(20)  // rejected
      .mockResolvedValueOnce(5)   // reviewing
      .mockResolvedValueOnce(5)   // completed

    vi.mocked(prisma.quote.aggregate)
      .mockResolvedValueOnce({ _sum: { finalPrice: 5000000 }, _count: 0 } as any) // monthlyApproved
      .mockResolvedValueOnce({ _sum: { finalPrice: 10000000 }, _avg: { finalPrice: 200000 } } as any) // approved agg
      .mockResolvedValueOnce({ _sum: { finalPrice: 8000000 }, _count: 0 } as any) // totalApprovedRevenue

    vi.mocked(prisma.quote.groupBy)
      .mockResolvedValueOnce([{ device: 'iPhone 13', _count: { device: 15 } }] as any) // mostQuoted
      .mockResolvedValueOnce([ // topDevices
        { device: 'iPhone 13', _count: { device: 15 }, _avg: { finalPrice: 200000 } },
        { device: 'iPhone 12', _count: { device: 10 }, _avg: { finalPrice: 150000 } },
      ] as any)
      .mockResolvedValueOnce([ // byCondition
        { condition: 'Impecable', _count: { condition: 60 } },
        { condition: 'Buena', _count: { condition: 30 } },
      ] as any)

    vi.mocked(prisma.quote.findMany).mockResolvedValueOnce([
      { id: 'q1', code: 'QT-1', device: 'iPhone 13', clientName: 'Juan', finalPrice: 200000, status: 'PENDING', createdAt: new Date('2025-12-01') },
    ] as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([] as any) // monthlyBreakdown

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/admin/quotes-stats')
    const res = await GET(req)
    if (res.status !== 200) {
      const body = await res.text()
      console.error('DEBUG response:', res.status, body)
    }
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.totals).toBeDefined()
    expect(data.totals.total).toBe(100)
    expect(data.totals.approvalRate).toBe(50) // 50/100
    expect(data.totals.avgFinalPrice).toBe(200000)
    expect(data.totals.totalApprovedValue).toBe(8000000)
    expect(data.funnel).toBeDefined()
    expect(data.funnel.received).toBe(100)
    expect(data.funnel.approved).toBe(50)
    expect(data.funnel.completed).toBe(5)
    expect(data.topDevices).toHaveLength(2)
    expect(data.byCondition).toHaveLength(2)
    expect(data.recent).toHaveLength(1)
    expect(data.monthlyBreakdown).toBeDefined()
  })

  it('handles zero quotes gracefully', async () => {
    const { requireAdmin } = await import('@/lib/auth-guard')
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'a1', email: 'admin@test.com', role: 'ADMIN', active: true })

    vi.mocked(prisma.quote.count).mockResolvedValue(0)
    vi.mocked(prisma.quote.aggregate).mockResolvedValue({ _sum: { finalPrice: 0 }, _count: 0, _avg: { finalPrice: 0 } } as any)
    vi.mocked(prisma.quote.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.quote.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as any)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/admin/quotes-stats')
    const res = await GET(req)
    if (res.status !== 200) {
      const body = await res.text()
      console.error('DEBUG zero test:', res.status, body)
    }
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.totals.total).toBe(0)
    expect(data.totals.approvalRate).toBe(0)
    expect(data.totals.avgFinalPrice).toBe(0)
    expect(data.funnel.conversionRate).toBe(0)
    expect(data.topDevices).toHaveLength(0)
  })
})

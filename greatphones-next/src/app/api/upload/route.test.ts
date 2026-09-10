import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth-guard', () => ({
  requireSession: vi.fn(),
}))

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn(),
    },
  },
}))

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.CLOUDINARY_CLOUD_NAME = 'test'
    process.env.CLOUDINARY_API_KEY = 'test'
    process.env.CLOUDINARY_API_SECRET = 'test'
  })

  it('returns 401 when not authenticated', async () => {
    const { requireSession } = await import('@/lib/auth-guard')
    vi.mocked(requireSession).mockRejectedValue({ status: 401, message: 'No autenticado' })

    const { POST } = await import('./route')
    const formData = new FormData()
    formData.append('file', new Blob(['test'], { type: 'image/png' }), 'test.png')
    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('returns 400 when no file provided', async () => {
    const { requireSession } = await import('@/lib/auth-guard')
    vi.mocked(requireSession).mockResolvedValue({ id: 'u1', email: 'test@test.com', role: 'CLIENT', active: true })

    const { POST } = await import('./route')
    const formData = new FormData()
    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('archivo')
  })

  it('returns 200 with url on successful upload', async () => {
    const { requireSession } = await import('@/lib/auth-guard')
    vi.mocked(requireSession).mockResolvedValue({ id: 'u1', email: 'test@test.com', role: 'CLIENT', active: true })
    const cloudinary = await import('cloudinary')
    vi.mocked(cloudinary.v2.uploader.upload).mockImplementation(((_base64: string, _opts: any, cb: any) => {
      cb(null, { secure_url: 'https://cloudinary.com/test.png', public_id: 'greatphones/test' })
    }) as any)

    const { POST } = await import('./route')
    const formData = new FormData()
    formData.append('file', new Blob(['test'], { type: 'image/png' }), 'test.png')
    const req = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.url).toBe('https://cloudinary.com/test.png')
  })
})

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminTopbar from '@/components/AdminTopbar'

function fmt(n: number | null | undefined) {
  return '$' + (n || 0).toLocaleString('es-AR')
}
function fecha(s: string | null | undefined) {
  return s ? new Date(s).toLocaleDateString('es-AR') : '—'
}

interface Ficha {
  user: {
    id: string; name: string | null; email: string; phone: string | null; dni: string | null
    role: string; active: boolean; verified: boolean; createdAt: string
    direccion: string | null; piso: string | null; ciudad: string | null; provincia: string | null; cp: string | null
  }
  resumen: Record<string, number>
  orders: any[]
  sales: any[]
  repairs: any[]
  preventas: any[]
  quotes: any[]
  guarantees: any[]
  coupons: any[]
  wallet: { balance: number; transactions: any[] }
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E6E7F0', borderRadius: 12, padding: 16, marginBottom: 16,
}
const th: React.CSSProperties = { padding: '8px 10px', fontSize: 11, color: '#6B7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px' }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 12.5, borderTop: '1px solid #EFF1F6' }

const ESTADO_COLOR: Record<string, string> = {
  DELIVERED: '#0F9D58', ENTREGADO: '#0F9D58', COMPLETED: '#0F9D58', ACTIVE: '#0F9D58', PROCESADA: '#0F9D58',
  CANCELLED: '#DC2626', CANCELADO: '#DC2626', EXPIRED: '#DC2626', RECHAZADO: '#DC2626',
  PENDING: '#D97706', ESPERANDO_COMPRA: '#D97706', COMPRADO: '#2563EB', PROCESSING: '#2563EB',
}
function Pill({ v }: { v: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: (ESTADO_COLOR[v] || '#64748B') + '1A', color: ESTADO_COLOR[v] || '#64748B',
    }}>{v}</span>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) {
    return (
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#181B2E' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 6 }}>Sin registros</div>
      </div>
    )
  }
  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#181B2E', marginBottom: 10 }}>
        {title} <span style={{ color: '#94A3B8', fontWeight: 600 }}>({count})</span>
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  )
}

export default function FichaClienteClient({ id }: { id: string }) {
  const [f, setF] = useState<Ficha | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/clientes/${id}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Error')
        return r.json()
      })
      .then(setF)
      .catch(e => setError(e.message))
  }, [id])

  if (error) {
    return (
      <>
        <AdminTopbar titulo="Ficha de Cliente" />
        <div style={{ padding: 24 }}>
          <p style={{ color: '#DC2626' }}>{error}</p>
          <Link href="/admin/clientes" style={{ color: '#4F46E5' }}>← Volver</Link>
        </div>
      </>
    )
  }
  if (!f) {
    return (
      <>
        <AdminTopbar titulo="Ficha de Cliente" />
        <div style={{ padding: 24, color: '#94A3B8' }}>Cargando…</div>
      </>
    )
  }

  const r = f.resumen
  const dir = [f.user.direccion, f.user.piso, f.user.ciudad, f.user.provincia, f.user.cp].filter(Boolean).join(', ')

  const kpis: { label: string; value: string; hint?: string }[] = [
    { label: 'Gasto total', value: fmt(r.gastoTotal), hint: 'pedidos + ventas + reparaciones cobradas' },
    { label: 'Ganancia generada', value: fmt(r.gananciaGenerada), hint: 'ventas + reparaciones' },
    { label: 'Saldo de preventas', value: fmt(r.saldoPreventas), hint: `${r.preventasPendientes} pendiente(s) de entrega` },
    { label: 'Garantías vigentes', value: String(r.garantiasVigentes) },
    { label: 'Crédito en cupones', value: fmt(r.creditoCupones) },
    { label: 'Billetera', value: fmt(r.billetera) },
  ]

  return (
    <>
      <AdminTopbar titulo={`Ficha — ${f.user.name || f.user.email}`} />
      <div style={{ padding: 24, maxWidth: 1040, margin: '0 auto' }}>
        <Link href="/admin/clientes" style={{ fontSize: 12.5, color: '#4F46E5', textDecoration: 'none' }}>← Todos los clientes</Link>

        {/* Datos del cliente */}
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#181B2E' }}>{f.user.name || '(sin nombre)'}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{f.user.email}{f.user.phone ? ` · ${f.user.phone}` : ''}</div>
              {f.user.dni && <div style={{ fontSize: 12.5, color: '#6B7280' }}>DNI/CUIL: {f.user.dni}</div>}
              {dir && <div style={{ fontSize: 12.5, color: '#6B7280' }}>{dir}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#94A3B8' }}>
              <div>{f.user.role === 'ADMIN' ? 'Administrador' : 'Cliente'}{f.user.active ? '' : ' · inactivo'}</div>
              <div>{f.user.verified ? 'Email verificado' : 'Email sin verificar'}</div>
              <div>Alta: {fecha(f.user.createdAt)}</div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.3px' }}>{k.label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#181B2E', marginTop: 3 }}>{k.value}</div>
              {k.hint && <div style={{ fontSize: 10.5, color: '#B6BECC', marginTop: 2 }}>{k.hint}</div>}
            </div>
          ))}
        </div>

        <Section title="Pedidos online" count={f.orders.length}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>N°</th><th style={th}>Estado</th><th style={th}>Total</th><th style={th}>Garantía</th><th style={th}>Canal</th><th style={th}>Fecha</th></tr></thead>
            <tbody>
              {f.orders.map(o => (
                <tr key={o.id}>
                  <td style={td}><strong>{o.code}</strong></td>
                  <td style={td}><Pill v={o.status} /></td>
                  <td style={td}>{fmt(o.total)}</td>
                  <td style={td}>{o.warranty || '—'}</td>
                  <td style={td}>{o.saleChannel || 'online'}</td>
                  <td style={td}>{fecha(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Ventas de mostrador" count={f.sales.length}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>N°</th><th style={th}>Equipo</th><th style={th}>Precio</th><th style={th}>Ganancia</th><th style={th}>Pago</th><th style={th}>Fecha</th></tr></thead>
            <tbody>
              {f.sales.map(s => (
                <tr key={s.id}>
                  <td style={td}><strong>{s.code}</strong></td>
                  <td style={td}>{s.device}</td>
                  <td style={td}>{fmt(s.price)}</td>
                  <td style={td}>{fmt(s.profitReal)}</td>
                  <td style={td}>{s.payment || '—'}</td>
                  <td style={td}>{fecha(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Reparaciones" count={f.repairs.length}>
          <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>N°</th><th style={th}>Equipo</th><th style={th}>Falla</th><th style={th}>Estado</th><th style={th}>Tipo</th><th style={th}>Cobrado</th><th style={th}>Fecha</th></tr></thead>
            <tbody>
              {f.repairs.map(rp => (
                <tr key={rp.id}>
                  <td style={td}><strong>{rp.code}</strong></td>
                  <td style={td}>{rp.device}</td>
                  <td style={td}>{rp.issue}</td>
                  <td style={td}><Pill v={rp.status} /></td>
                  <td style={td}>{rp.type || '—'}</td>
                  <td style={td}>{fmt(rp.pricePaid)}</td>
                  <td style={td}>{fecha(rp.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Preventas" count={f.preventas.length}>
          <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>N°</th><th style={th}>Modelo</th><th style={th}>Estado</th><th style={th}>Precio</th><th style={th}>Cobrado</th><th style={th}>Saldo</th><th style={th}>Entrega</th></tr></thead>
            <tbody>
              {f.preventas.map(p => (
                <tr key={p.id}>
                  <td style={td}><strong>{p.code}</strong></td>
                  <td style={td}>{p.modelo}</td>
                  <td style={td}><Pill v={p.estado} /></td>
                  <td style={td}>{fmt(p.precio)}</td>
                  <td style={td}>{fmt(p.cobrado)}</td>
                  <td style={{ ...td, color: p.saldo > 0 ? '#DC2626' : '#0F9D58', fontWeight: 600 }}>{fmt(p.saldo)}</td>
                  <td style={td}>{p.entregaDesde ? `${fecha(p.entregaDesde)}–${fecha(p.entregaHasta)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Cotizaciones de usados" count={f.quotes.length}>
          <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>N°</th><th style={th}>Equipo</th><th style={th}>Estado</th><th style={th}>Fecha</th></tr></thead>
            <tbody>
              {f.quotes.map(q => (
                <tr key={q.id}>
                  <td style={td}><strong>{q.code}</strong></td>
                  <td style={td}>{q.device}</td>
                  <td style={td}><Pill v={q.status} /></td>
                  <td style={td}>{fecha(q.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Garantías" count={f.guarantees.length}>
          <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Producto</th><th style={th}>Tipo</th><th style={th}>Desde</th><th style={th}>Vence</th><th style={th}>Estado</th></tr></thead>
            <tbody>
              {f.guarantees.map(g => (
                <tr key={g.id}>
                  <td style={td}>{g.product}</td>
                  <td style={td}>{g.type}</td>
                  <td style={td}>{fecha(g.startsAt)}</td>
                  <td style={td}>{fecha(g.expiresAt)}</td>
                  <td style={td}><Pill v={g.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Cupones" count={f.coupons.length}>
          <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Código</th><th style={th}>Estado</th><th style={th}>Original</th><th style={th}>Disponible</th><th style={th}>Vence</th></tr></thead>
            <tbody>
              {f.coupons.map(c => (
                <tr key={c.id}>
                  <td style={td}><strong>{c.code}</strong></td>
                  <td style={td}><Pill v={c.status} /></td>
                  <td style={td}>{fmt(c.originalAmount)}</td>
                  <td style={td}>{fmt(c.remainingAmount)}</td>
                  <td style={td}>{fecha(c.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Billetera" count={f.wallet.transactions.length}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>Saldo actual: <strong>{fmt(f.wallet.balance)}</strong></div>
          <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Tipo</th><th style={th}>Monto</th><th style={th}>Detalle</th><th style={th}>Fecha</th></tr></thead>
            <tbody>
              {f.wallet.transactions.map(t => (
                <tr key={t.id}>
                  <td style={td}>{t.type}</td>
                  <td style={{ ...td, color: t.amount < 0 ? '#DC2626' : '#0F9D58' }}>{fmt(t.amount)}</td>
                  <td style={td}>{t.description || '—'}</td>
                  <td style={td}>{fecha(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </>
  )
}

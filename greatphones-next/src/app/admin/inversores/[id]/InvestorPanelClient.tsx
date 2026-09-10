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

const TYPE_LABEL: Record<string, string> = {
  INGRESO_CAPITAL: 'Ingreso de capital',
  RETIRO_CAPITAL: 'Retiro de capital',
  PAGO_RENDIMIENTO: 'Pago de rendimiento',
  AJUSTE: 'Ajuste',
}
const TYPE_COLOR: Record<string, string> = {
  INGRESO_CAPITAL: '#0F9D58',
  RETIRO_CAPITAL: '#DC2626',
  PAGO_RENDIMIENTO: '#7C3AED',
  AJUSTE: '#D97706',
}

interface Panel {
  id: string
  name: string
  capital: number
  paidTotal: number
  pending: number
  yieldRate: number
  createdAt: string
  movements: { id: string; type: string; amount: number; detail: string | null; capitalAfter: number; operator: string | null; createdAt: string }[]
  yields: { id: string; period: string; capitalBase: number; amount: number; status: string; paidAt: string | null; operator: string | null }[]
  resumen: { aportado: number; retirado: number; rendimientoDevengado: number; rendimientoPagado: number; rendimientoPendiente: number }
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E6E7F0', borderRadius: 12, padding: 16, marginBottom: 16 }
const th: React.CSSProperties = { padding: '8px 10px', fontSize: 11, color: '#6B7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px' }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 12.5, borderTop: '1px solid #EFF1F6' }

export default function InvestorPanelClient({ id }: { id: string }) {
  const [p, setP] = useState<Panel | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/investors?id=${id}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Error')
        return r.json()
      })
      .then(setP)
      .catch(e => setError(e.message))
  }, [id])

  if (error) {
    return (
      <>
        <AdminTopbar titulo="Inversor" />
        <div style={{ padding: 24 }}>
          <p style={{ color: '#DC2626' }}>{error}</p>
          <Link href="/admin/inversores" style={{ color: '#4F46E5' }}>← Volver</Link>
        </div>
      </>
    )
  }
  if (!p) {
    return (
      <>
        <AdminTopbar titulo="Inversor" />
        <div style={{ padding: 24, color: '#94A3B8' }}>Cargando…</div>
      </>
    )
  }

  const kpis = [
    { label: 'Capital invertido', value: fmt(p.capital) },
    { label: 'Aportado / Retirado', value: `${fmt(p.resumen.aportado)} / ${fmt(p.resumen.retirado)}` },
    { label: 'Rendimiento mensual', value: `${p.yieldRate}%` },
    { label: 'Devengado total', value: fmt(p.resumen.rendimientoDevengado) },
    { label: 'Pagado', value: fmt(p.paidTotal) },
    { label: 'Pendiente de pago', value: fmt(p.pending) },
  ]

  return (
    <>
      <AdminTopbar titulo={`Inversor — ${p.name}`} />
      <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
        <Link href="/admin/inversores" style={{ fontSize: 12.5, color: '#4F46E5', textDecoration: 'none' }}>← Todos los inversores</Link>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, margin: '12px 0 16px' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.3px' }}>{k.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#181B2E', marginTop: 3 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Rendimientos mensuales (ERP §3.17) */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#181B2E', marginBottom: 10 }}>
            Rendimientos mensuales <span style={{ color: '#94A3B8', fontWeight: 600 }}>({p.yields.length})</span>
          </div>
          {p.yields.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Todavía no se generó ningún rendimiento.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Período</th><th style={th}>Capital base</th><th style={th}>Rendimiento</th><th style={th}>Estado</th><th style={th}>Pagado el</th></tr></thead>
                <tbody>
                  {p.yields.map(y => (
                    <tr key={y.id}>
                      <td style={td}><strong>{y.period}</strong></td>
                      <td style={td}>{fmt(y.capitalBase)}</td>
                      <td style={td}>{fmt(y.amount)}</td>
                      <td style={td}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: y.status === 'PAGADO' ? '#0F9D5822' : '#D9770622',
                          color: y.status === 'PAGADO' ? '#0F9D58' : '#D97706',
                        }}>{y.status}</span>
                      </td>
                      <td style={td}>{fecha(y.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Movimientos de capital */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#181B2E', marginBottom: 10 }}>
            Movimientos de capital <span style={{ color: '#94A3B8', fontWeight: 600 }}>({p.movements.length})</span>
          </div>
          {p.movements.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Sin movimientos.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Fecha</th><th style={th}>Tipo</th><th style={th}>Monto</th><th style={th}>Capital resultante</th><th style={th}>Detalle</th><th style={th}>Operador</th></tr></thead>
                <tbody>
                  {p.movements.map(m => (
                    <tr key={m.id}>
                      <td style={td}>{fecha(m.createdAt)}</td>
                      <td style={{ ...td, color: TYPE_COLOR[m.type] || '#374151', fontWeight: 600 }}>{TYPE_LABEL[m.type] || m.type}</td>
                      <td style={td}>{fmt(m.amount)}</td>
                      <td style={td}>{fmt(m.capitalAfter)}</td>
                      <td style={td}>{m.detail || '—'}</td>
                      <td style={td}>{m.operator || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: '#94A3B8' }}>
          Para registrar movimientos o generar el rendimiento del mes, usá el botón «Gestionar» en la lista de inversores.
        </p>
      </div>
    </>
  )
}

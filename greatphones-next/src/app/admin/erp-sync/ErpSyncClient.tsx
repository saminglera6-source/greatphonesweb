'use client'

import { useEffect, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'

interface Fila {
  id: string
  tipo: string
  operationId: string
  status: 'PENDING' | 'SENT' | 'ERROR'
  attempts: number
  lastError: string | null
  createdAt: string
  sentAt: string | null
}
interface Estado {
  configurado: boolean
  resumen: { pending: number; error: number; sent24h: number }
  ultimas: Fila[]
}

function fecha(s: string) {
  return new Date(s).toLocaleString('es-AR')
}

const ESTADO_COLOR: Record<string, string> = { SENT: '#0F9D58', PENDING: '#D97706', ERROR: '#DC2626' }

export default function ErpSyncClient() {
  const [d, setD] = useState<Estado | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const cargar = () => {
    fetch('/api/admin/erp-sync', { credentials: 'include' })
      .then(r => r.json())
      .then(setD)
      .catch(() => {})
  }
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 15000)
    return () => clearInterval(t)
  }, [])

  const reintentarTodo = async () => {
    setBusy('all')
    setMsg(null)
    try {
      const r = await fetch('/api/admin/erp-sync', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retry: 'all' }),
      })
      const j = await r.json()
      setMsg(`Reintentadas ${j.total ?? 0}: ${j.enviadas ?? 0} enviadas, ${j.fallidas ?? 0} fallidas.`)
      cargar()
    } finally {
      setBusy(null)
    }
  }

  const reintentarUna = async (id: string) => {
    setBusy(id)
    try {
      await fetch('/api/admin/erp-sync', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      cargar()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <AdminTopbar titulo="Sincronización con el Sheet" />
      <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
          Cada venta, compra, preventa, reparación, gasto, movimiento de caja/inversor y anulación se replica como
          fila en el sheet "PRUEBA GP". Si el sheet no responde, la operación en el panel <strong>no se
          bloquea</strong>: queda acá pendiente y se reintenta.
        </p>

        {!d ? (
          <p style={{ color: '#94A3B8' }}>Cargando…</p>
        ) : (
          <>
            {!d.configurado && (
              <div style={{ background: '#FEF9E7', border: '1px solid #F5E6B8', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#7D6608' }}>
                No hay ninguna URL configurada (<code>ERP_SHEET_WEBHOOK_URL</code>). Las operaciones se están
                encolando igual, pero nada se manda hasta que se configure el webhook del Apps Script.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Pendientes', value: d.resumen.pending, color: '#D97706' },
                { label: 'Con error', value: d.resumen.error, color: '#DC2626' },
                { label: 'Enviadas (24h)', value: d.resumen.sent24h, color: '#0F9D58' },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.3px' }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: k.color, marginTop: 3 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {msg && <div style={{ fontSize: 12.5, color: '#374151', marginBottom: 10 }}>{msg}</div>}

            <button
              onClick={reintentarTodo}
              disabled={busy === 'all'}
              style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', marginBottom: 16 }}
            >
              {busy === 'all' ? 'Reintentando…' : 'Reintentar pendientes/errores'}
            </button>

            <div style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#6B7280', background: '#F8F9FC' }}>
                      <th style={{ padding: '8px 12px' }}>Tipo</th>
                      <th style={{ padding: '8px 12px' }}>N°</th>
                      <th style={{ padding: '8px 12px' }}>Estado</th>
                      <th style={{ padding: '8px 12px' }}>Intentos</th>
                      <th style={{ padding: '8px 12px' }}>Fecha</th>
                      <th style={{ padding: '8px 12px' }}>Error</th>
                      <th style={{ padding: '8px 12px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.ultimas.length === 0 ? (
                      <tr><td style={{ padding: 12, color: '#94A3B8' }} colSpan={7}>Sin operaciones todavía</td></tr>
                    ) : d.ultimas.map(f => (
                      <tr key={f.id} style={{ borderTop: '1px solid #EFF1F6' }}>
                        <td style={{ padding: '8px 12px' }}>{f.tipo}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{f.operationId}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ color: ESTADO_COLOR[f.status], fontWeight: 700 }}>{f.status}</span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>{f.attempts}</td>
                        <td style={{ padding: '8px 12px' }}>{fecha(f.createdAt)}</td>
                        <td style={{ padding: '8px 12px', color: '#DC2626', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.lastError || ''}>
                          {f.lastError || ''}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {f.status !== 'SENT' && (
                            <button
                              onClick={() => reintentarUna(f.id)}
                              disabled={busy === f.id}
                              style={{ background: 'none', border: '1px solid #C7D2FE', color: '#4F46E5', borderRadius: 7, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer' }}
                            >
                              {busy === f.id ? '…' : 'Reintentar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopbar from '@/components/AdminTopbar'

interface Row {
  id: string
  name: string | null
  email: string
  phone: string | null
  role: string
  active: boolean
  createdAt: string
  _count: { orders: number; sales: number; repairs: number; preOrders: number; quotes: number }
}

const cell: React.CSSProperties = { padding: '10px 12px', fontSize: 13, borderTop: '1px solid #EFF1F6' }

export default function ClientesClient() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setCargando(true)
      fetch(`/api/admin/clientes?q=${encodeURIComponent(q)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          setRows(d.rows || [])
          setTotal(d.total || 0)
        })
        .catch(() => setRows([]))
        .finally(() => setCargando(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const totalOps = useMemo(
    () => (r: Row) => r._count.orders + r._count.sales + r._count.repairs + r._count.preOrders + r._count.quotes,
    [],
  )

  return (
    <>
      <AdminTopbar titulo="Ficha de Cliente" />
      <div style={{ padding: 24, maxWidth: 1040, margin: '0 auto' }}>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
          Buscá un cliente por nombre, email o teléfono para ver su ficha completa: pedidos, ventas, reparaciones,
          preventas, cotizaciones, garantías, cupones y billetera.
        </p>

        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar cliente…"
          style={{
            width: '100%', padding: '11px 14px', border: '1.5px solid #E6E7F0', borderRadius: 10,
            fontSize: 14, background: '#FBFBFD', marginBottom: 16,
          }}
        />

        <div style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6B7280', background: '#F8F9FC' }}>
                  <th style={{ ...cell, borderTop: 'none' }}>Cliente</th>
                  <th style={{ ...cell, borderTop: 'none' }}>Contacto</th>
                  <th style={{ ...cell, borderTop: 'none', textAlign: 'center' }}>Pedidos</th>
                  <th style={{ ...cell, borderTop: 'none', textAlign: 'center' }}>Ventas</th>
                  <th style={{ ...cell, borderTop: 'none', textAlign: 'center' }}>Reparac.</th>
                  <th style={{ ...cell, borderTop: 'none', textAlign: 'center' }}>Preventas</th>
                  <th style={{ ...cell, borderTop: 'none' }}></th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr><td style={cell} colSpan={7}>Cargando…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td style={{ ...cell, color: '#94A3B8' }} colSpan={7}>Sin resultados</td></tr>
                ) : (
                  rows.map(r => (
                    <tr key={r.id} style={{ background: totalOps(r) === 0 ? '#fff' : '#FDFDFF' }}>
                      <td style={cell}>
                        <div style={{ fontWeight: 600, color: '#181B2E' }}>{r.name || '(sin nombre)'}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>
                          {r.role === 'ADMIN' ? 'Administrador · ' : ''}alta {new Date(r.createdAt).toLocaleDateString('es-AR')}
                          {!r.active && ' · inactivo'}
                        </div>
                      </td>
                      <td style={cell}>
                        <div>{r.email}</div>
                        {r.phone && <div style={{ fontSize: 12, color: '#6B7280' }}>{r.phone}</div>}
                      </td>
                      <td style={{ ...cell, textAlign: 'center' }}>{r._count.orders || '—'}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>{r._count.sales || '—'}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>{r._count.repairs || '—'}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>{r._count.preOrders || '—'}</td>
                      <td style={{ ...cell, textAlign: 'right' }}>
                        <Link
                          href={`/admin/clientes/${r.id}`}
                          style={{
                            fontSize: 12, fontWeight: 600, color: '#4F46E5', textDecoration: 'none',
                            border: '1px solid #C7D2FE', borderRadius: 8, padding: '5px 12px',
                          }}
                        >
                          Ver ficha
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {!cargando && (
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>
            {total} cliente{total === 1 ? '' : 's'}{q && ' coinciden con la búsqueda'}
          </div>
        )}
      </div>
    </>
  )
}

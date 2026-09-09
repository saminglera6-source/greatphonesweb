'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 9,
  border: '1.5px solid #E6E7F0',
  borderRadius: 9,
  fontSize: 13,
  background: '#FBFBFD',
  color: '#181B2E',
}

function fmtP(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}
function fmtUSD(n: number) {
  return 'US$' + (n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

interface Entry {
  id: string
  source: string
  operationId: string | null
  description: string
  category: string | null
  type: string
  means: string
  amount: number
  amountUsd?: number | null
  opDate: string
  operator: string | null
}
interface Balance {
  means: string
  balance: number
  balanceUsd?: number | null
}

const MEAN_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CUOTAS: 'Cuotas',
  USD: 'USD',
  PAGO_ONLINE: 'Online',
}
const CANAL: Record<string, 'online' | 'local' | 'otro'> = {
  ONLINE: 'online',
  PREORDER: 'online',
  SALE: 'local',
  REPAIR: 'local',
  PURCHASE: 'local',
}

export default function ReportesClient() {
  const [balances, setBalances] = useState<Balance[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [resumen, setResumen] = useState<
    Array<{ source: string; ingresos: number; egresos: number; cantidad: number }>
  >([])
  const [canales, setCanales] = useState<{
    online: { total: number; cantidad: number }
    local: { total: number; cantidad: number }
    egresos: { total: number; cantidad: number }
    otros: { total: number; cantidad: number }
  } | null>(null)
  const [pedidosOnline, setPedidosOnline] = useState<{ total: number; cantidad: number }>({
    total: 0,
    cantidad: 0,
  })
  const [dolar, setDolar] = useState(0)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [filtroCanal, setFiltroCanal] = useState<'todos' | 'online' | 'local'>('todos')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [buscar, setBuscar] = useState('')
  const [cargando, setCargando] = useState(true)
  const [monthlyStats, setMonthlyStats] = useState<Array<{
    month: string
    revenue: number
    orders: number
    profit: number
    avgTicket: number
  }>>([])
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [detalle, setDetalle] = useState<any>(null)
  const [salud, setSalud] = useState<any>(null)
  const [corriendoSalud, setCorriendoSalud] = useState(false)

  const qActual = () => {
    const p = new URLSearchParams()
    if (desde) p.set('desde', desde)
    if (hasta) p.set('hasta', hasta)
    return p.toString()
  }

  const load = async () => {
    setCargando(true)
    const q = qActual()
    try {
      const [r, rd, dashboardRes, saludRes] = await Promise.all([
        fetch('/api/admin/analisis/reportes' + (q ? '?' + q : ''), { credentials: 'include' }),
        fetch('/api/admin/precios/dolar?tipo=blue', { credentials: 'include' }),
        fetch('/api/admin/dashboard', { credentials: 'include' }),
        fetch('/api/admin/health', { credentials: 'include' }),
      ])
      const d = await r.json()
      setBalances(d.balances || [])
      setEntries(d.entries || [])
      setResumen(d.resumen || [])
      setCanales(d.canales)
      setDetalle(d.detalle || null)
      setPedidosOnline(d.pedidosOnline || { total: 0, cantidad: 0 })
      const dt = await rd.json()
      if (dt && dt.venta) setDolar(dt.venta)
      const dashData = await dashboardRes.json()
      if (dashData && dashData.monthlyStats) setMonthlyStats(dashData.monthlyStats)
      const sd = await saludRes.json()
      setSalud(sd.last || null)
    } catch {}
    setCargando(false)
  }

  const correrSalud = async () => {
    setCorriendoSalud(true)
    try {
      const r = await fetch('/api/admin/health?run=1', { credentials: 'include' })
      const d = await r.json()
      setSalud(d)
    } catch {}
    setCorriendoSalud(false)
  }

  const descargarCsv = () => {
    const q = qActual()
    window.open('/api/admin/analisis/reportes?format=csv' + (q ? '&' + q : ''), '_blank')
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = useMemo(() => {
    return entries.filter(e => {
      if (filtroCanal === 'online' && CANAL[e.source] !== 'online') return false
      if (filtroCanal === 'local' && CANAL[e.source] !== 'local') return false
      if (filtroCanal === 'todos' && filtroTipo === 'EGRESO' && e.type !== 'EGRESO') return false
      if (filtroCanal === 'todos' && filtroTipo === 'INGRESO' && e.type !== 'INGRESO') return false
      if (
        buscar &&
        !(e.operationId || '').toLowerCase().includes(buscar.toLowerCase()) &&
        !e.description.toLowerCase().includes(buscar.toLowerCase())
      )
        return false
      return true
    })
  }, [entries, filtroCanal, filtroTipo, buscar])

  const totalIngresos = filtrados
    .filter(e => e.type === 'INGRESO')
    .reduce((s, e) => s + e.amount, 0)
  const totalEgresos = filtrados.filter(e => e.type === 'EGRESO').reduce((s, e) => s + e.amount, 0)

  const bal: Record<string, Balance> = balances.reduce((acc: Record<string, Balance>, b) => {
    acc[b.means] = b
    return acc
  }, {})
  const usdPesos = Math.round((bal.USD?.balanceUsd || 0) * dolar)

  const canalCard = (
    icon: string,
    label: string,
    value: number,
    cantidad: number,
    accent: string,
  ) => (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E6E7F0',
        borderRadius: 12,
        padding: 14,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          color: '#6B7280',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 14, color: accent }}
          aria-hidden="true"
        >
          {icon}
        </span>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#181B2E', marginTop: 4 }}>
        {fmtP(value)}
      </div>
      <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>{cantidad} movimientos</div>
    </div>
  )

  return (
    <>
      <AdminTopbar titulo="Reportes" />
      <div style={{ padding: 'clamp(16px,4vw,24px)', maxWidth: 1100, margin: '0 auto' }}>
        <style>{`
           .pe-input:focus{ border-color:#FF6B2C!important; outline:none}
           .pe-btn:focus-visible{ outline:2px solid #FF6B2C; outline-offset:2px}
           .r-chip{ transition: background .15s}
           .r-chip:hover{ filter:brightness(.96)}
           .r-sum-grid{ grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); }
           @media (max-width: 380px){ .r-sum-grid{ grid-template-columns: 1fr 1fr; } }
         `}</style>

        <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>
          Todos los ingresos del sistema — online y local
        </p>

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'end',
            flexWrap: 'wrap',
            marginTop: 16,
            background: '#fff',
            border: '1px solid #E6E7F0',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ flex: '1 1 140px' }}>
            <label
              htmlFor="r-desde"
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: '#3D4356',
                marginBottom: 5,
              }}
            >
              Desde
            </label>
            <input
              id="r-desde"
              type="date"
              className="pe-input"
              style={inputStyle}
              value={desde}
              onChange={e => setDesde(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label
              htmlFor="r-hasta"
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: '#3D4356',
                marginBottom: 5,
              }}
            >
              Hasta
            </label>
            <input
              id="r-hasta"
              type="date"
              className="pe-input"
              style={inputStyle}
              value={hasta}
              onChange={e => setHasta(e.target.value)}
            />
          </div>
          <button
            onClick={load}
            className="pe-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 18px',
              background: 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden="true">
              filter_alt
            </span>
            Filtrar
          </button>
          <button
            onClick={descargarCsv}
            className="pe-btn"
            style={{ padding: '10px 16px', background: '#fff', color: '#3D4356', border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Exportar CSV
          </button>
        </div>

        {salud && (
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid ' + (salud.status === 'OK' ? '#A6F4C5' : salud.status === 'WARNING' ? '#FDE68A' : '#FECACA'),
              background: salud.status === 'OK' ? '#ECFDF3' : salud.status === 'WARNING' ? '#FFFBEB' : '#FEF2F2',
              fontSize: 12.5,
            }}
          >
            <strong style={{ color: salud.status === 'OK' ? '#0F9D58' : salud.status === 'WARNING' ? '#B45309' : '#B91C1C' }}>
              Salud del sistema: {salud.status}
            </strong>
            <span style={{ color: '#64748B' }}>
              {salud.critical || 0} críticos · {salud.error || 0} errores · {salud.warning || 0} avisos
              {salud.runAt ? ` · ${new Date(salud.runAt).toLocaleString('es-AR')}` : ''}
            </span>
            <button
              onClick={correrSalud}
              disabled={corriendoSalud}
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid #E6E7F0', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              {corriendoSalud ? 'Verificando…' : 'Verificar ahora'}
            </button>
          </div>
        )}
        {salud?.findings?.length > 0 && (
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
            {salud.findings.map((f: any, i: number) => (
              <li key={i} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #EFF1F6', color: f.severity === 'CRITICAL' || f.severity === 'ERROR' ? '#B91C1C' : f.severity === 'WARNING' ? '#B45309' : '#64748B' }}>
                <strong>[{f.severity}]</strong> {f.message}
                {f.refs?.length ? <span style={{ color: '#94A3B8' }}> — {f.refs.slice(0, 6).join(', ')}{f.refs.length > 6 ? '…' : ''}</span> : null}
              </li>
            ))}
          </ul>
        )}

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#8892A6', padding: 32, fontSize: 13 }}>
            Cargando reportes…
          </p>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                gap: 12,
                marginTop: 16,
              }}
            >
              {canales &&
                canalCard(
                  'laptop',
                  'Ingresos Online',
                  canales.online.total,
                  canales.online.cantidad,
                  '#7C3AED',
                  
                )}
              {canales &&
                canalCard(
                  'storefront',
                  'Ingresos Local',
                  canales.local.total,
                  canales.local.cantidad,
                  '#0F766E',
                  
                )}
              {canales &&
                canalCard(
                  'trending_down',
                  'Egresos',
                  canales.egresos.total,
                  canales.egresos.cantidad,
                  '#DC2626',
                  
                )}
              {canales &&
                canalCard(
                  'swap_horiz',
                  'Otros ingresos',
                  canales.otros.total,
                  canales.otros.cantidad,
                  '#B7950B',

                )}
            </div>

            {detalle && (
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 12, padding: 16 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#181B2E' }}>Ventas del período</h3>
                  {[
                    ['Cantidad', String(detalle.ventas.cantidad)],
                    ['Facturado', fmtP(detalle.ventas.facturado)],
                    ['Costo', fmtP(detalle.ventas.costo)],
                    ['Ganancia teórica', fmtP(detalle.ventas.gananciaTeorica)],
                    ['Ganancia cobrada', fmtP(detalle.ventas.gananciaCobrada)],
                    ['Propias / Consignación', `${detalle.ventas.propias} / ${detalle.ventas.consignacion}`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid #F1F3F7' }}>
                      <span style={{ color: '#64748B' }}>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 12, padding: 16 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#181B2E' }}>Por vendedor</h3>
                  {detalle.porVendedor.length === 0 && <p style={{ fontSize: 12, color: '#94A3B8' }}>Sin ventas</p>}
                  {detalle.porVendedor.map((v: any) => (
                    <div key={v.operador} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid #F1F3F7' }}>
                      <span>{v.operador} <span style={{ color: '#94A3B8' }}>({v.cantidad})</span></span>
                      <span>{fmtP(v.facturado)} · <strong style={{ color: '#0F9D58' }}>{fmtP(v.ganancia)}</strong></span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 12, padding: 16 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#181B2E' }}>Preventas por estado</h3>
                  {detalle.preventasPorEstado.map((p: any) => (
                    <div key={p.estado} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid #F1F3F7' }}>
                      <span>{p.estado}</span>
                      <span>{p.cantidad} · {fmtP(p.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                gap: 12,
                marginTop: 12,
              }}
            >
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E6E7F0',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#6B7280',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 14, color: '#0F9D58' }}
                    aria-hidden="true"
                  >
                    payments
                  </span>
                  Efectivo
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#181B2E', marginTop: 4 }}>
                  {fmtP(bal.EFECTIVO?.balance || 0)}
                </div>
              </div>
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E6E7F0',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#6B7280',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 14, color: '#2563EB' }}
                    aria-hidden="true"
                  >
                    account_balance
                  </span>
                  Transferencia
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#181B2E', marginTop: 4 }}>
                  {fmtP(bal.TRANSFERENCIA?.balance || 0)}
                </div>
              </div>
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E6E7F0',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#6B7280',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 14, color: '#0F766E' }}
                    aria-hidden="true"
                  >
                    attach_money
                  </span>
                  USD
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#181B2E', marginTop: 4 }}>
                  {fmtUSD(bal.USD?.balanceUsd || 0)}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                  ≈ {fmtP(usdPesos)} {dolar ? `a ${fmtP(dolar)}` : ''}
                </div>
              </div>
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E6E7F0',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#6B7280',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 14, color: '#7C3AED' }}
                    aria-hidden="true"
                  >
                    credit_card
                  </span>
                  Cuotas
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#181B2E', marginTop: 4 }}>
                  {fmtP(bal.CUOTAS?.balance || 0)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                gap: 10,
                marginTop: 18,
              }}
            >
              {resumen.map(r => (
                <div
                  key={r.source || 'OTRO'}
                  style={{
                    background: '#FAFBFD',
                    border: '1px solid #EDF0F6',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#6B7280',
                      letterSpacing: '.04em',
                    }}
                  >
                    {r.source || 'OTRO'}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#0F766E', fontWeight: 700, marginTop: 4 }}>
                    Ingresos: {fmtP(r.ingresos)}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#DC2626' }}>Egresos: {fmtP(r.egresos)}</div>
                  <div style={{ fontSize: 11, color: '#8892A6', marginTop: 2 }}>
                    {r.cantidad} movs
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: '#fff',
                border: '1px solid #E6E7F0',
                borderRadius: 14,
                padding: 20,
                marginTop: 20,
                boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#181B2E',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: '#FF6B2C' }}
                  aria-hidden="true"
                >
                  menu_book
                </span>
                Libro Diario
              </h3>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                <select
                  className="pe-input"
                  style={{ ...inputStyle, flex: '0 1 160px' }}
                  value={filtroCanal}
                  onChange={e => setFiltroCanal(e.target.value as 'todos' | 'online' | 'local')}
                >
                  <option value="todos">Todos los canales</option>
                  <option value="online">Solo online</option>
                  <option value="local">Solo local</option>
                </select>
                <select
                  className="pe-input"
                  style={{ ...inputStyle, flex: '0 1 150px' }}
                  value={filtroTipo}
                  onChange={e => setFiltroTipo(e.target.value)}
                >
                  <option value="">Todos los tipos</option>
                  <option value="INGRESO">Ingresos</option>
                  <option value="EGRESO">Egresos</option>
                </select>
                <div
                  style={{
                    flex: '1 1 220px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 10px',
                    border: '1.5px solid #E6E7F0',
                    borderRadius: 9,
                    background: '#FBFBFD',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: '#94A3B8' }}
                    aria-hidden="true"
                  >
                    search
                  </span>
                  <input
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      padding: '9px 0',
                      fontSize: 13,
                    }}
                    placeholder="Buscar N° operación o descripción..."
                    value={buscar}
                    onChange={e => setBuscar(e.target.value)}
                    aria-label="Buscar operación"
                  />
                  {buscar && (
                    <button
                      onClick={() => setBuscar('')}
                      aria-label="Limpiar"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94A3B8',
                        display: 'flex',
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16 }}
                        aria-hidden="true"
                      >
                        close
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div
                className="r-sum-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <div
                  style={{
                    background: '#EAFAF1',
                    border: '1px solid #ABEBC6',
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>Ingresos</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#166534' }}>
                    {fmtP(totalIngresos)}
                  </div>
                </div>
                <div
                  style={{
                    background: '#F9EBEA',
                    border: '1px solid #F5B7B1',
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#943126' }}>Egresos</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#943126' }}>
                    {fmtP(totalEgresos)}
                  </div>
                </div>
                <div
                  style={{
                    background: '#FAFBFD',
                    border: '1px solid #EDF0F6',
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Saldo neto</div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: totalIngresos - totalEgresos >= 0 ? '#0F9D58' : '#DC2626',
                    }}
                  >
                    {fmtP(totalIngresos - totalEgresos)}
                  </div>
                </div>
                <div
                  style={{
                    background: '#FAFBFD',
                    border: '1px solid #EDF0F6',
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Movimientos</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#181B2E' }}>
                    {filtrados.length}
                  </div>
                </div>
              </div>

              {pedidosOnline.cantidad > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    background: '#FAF5FF',
                    border: '1px solid #EDE9FE',
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: '#7C3AED' }}
                    aria-hidden="true"
                  >
                    shopping_cart
                  </span>
                  <span>
                    <b>Pedidos online pagados:</b> {pedidosOnline.cantidad} · Total{' '}
                    {fmtP(pedidosOnline.total)}
                  </span>
                </div>
              )}

              <div
                style={{
                  overflowX: 'auto',
                  marginTop: 14,
                  border: '1px solid #E6E7F0',
                  borderRadius: 8,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#F4F6F9', textAlign: 'left' }}>
                      <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Fecha</th>
                      <th style={{ padding: 8 }}>Canal</th>
                      <th style={{ padding: 8 }}>N° Operación</th>
                      <th style={{ padding: 8 }}>Tipo</th>
                      <th style={{ padding: 8 }}>Medio</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Monto</th>
                      <th style={{ padding: 8 }}>Descripción</th>
                      <th style={{ padding: 8 }}>Operador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{ padding: 24, textAlign: 'center', color: '#8892A6' }}
                        >
                          Sin movimientos para este filtro.
                        </td>
                      </tr>
                    )}
                    {filtrados.map(e => (
                      <tr key={e.id} style={{ borderTop: '1px solid #E6E7F0' }}>
                        <td
                          style={{
                            padding: 8,
                            whiteSpace: 'nowrap',
                            color: '#6B7280',
                            fontSize: 12,
                          }}
                        >
                          {new Date(e.opDate).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td style={{ padding: 8 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 100,
                              background:
                                CANAL[e.source] === 'online'
                                  ? '#F1E9FE'
                                  : CANAL[e.source] === 'local'
                                    ? '#F0FDFA'
                                    : '#FAFBFD',
                              color:
                                CANAL[e.source] === 'online'
                                  ? '#7C3AED'
                                  : CANAL[e.source] === 'local'
                                    ? '#0F766E'
                                    : '#6B7280',
                              border: '1px solid #E6E7F0',
                            }}
                          >
                            {CANAL[e.source] === 'online'
                              ? 'Online'
                              : CANAL[e.source] === 'local'
                                ? 'Local'
                                : e.source}
                          </span>
                        </td>
                        <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 11.5 }}>
                          {e.operationId || '—'}
                        </td>
                        <td style={{ padding: 8 }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 100,
                              background: e.type === 'INGRESO' ? '#D5F5E3' : '#FDEDEC',
                              color: e.type === 'INGRESO' ? '#166534' : '#943126',
                              border: `1px solid ${e.type === 'INGRESO' ? '#ABEBC6' : '#F5B7B1'}`,
                            }}
                          >
                            {e.type}
                          </span>
                        </td>
                        <td style={{ padding: 8 }}>{MEAN_LABEL[e.means] || e.means}</td>
                        <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>
                          {fmtP(e.amount)}
                          {e.amountUsd ? ` (${fmtUSD(e.amountUsd)})` : ''}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            maxWidth: 220,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={e.description}
                        >
                          {e.description}
                        </td>
                        <td style={{ padding: 8, color: '#6B7280' }}>{e.operator || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                background: '#fff',
                border: '1px solid #E6E7F0',
                borderRadius: 14,
                padding: 20,
                marginTop: 20,
                boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#181B2E',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 20,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: '#FF6B2C' }}
                  aria-hidden="true"
                >
                  trending_up
                </span>
                Ingresos Mensuales
              </h3>

              {monthlyStats.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#8892A6', padding: 32, fontSize: 13, margin: 0 }}>
                  Cargando datos mensuales…
                </p>
              ) : (
                <>
                  <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                    <svg
                      viewBox="0 0 1200 350"
                      style={{ width: '100%', minWidth: 600, height: 'auto', minHeight: 300 }}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {(() => {
                        const maxRevenue = Math.max(...monthlyStats.map(s => s.revenue), 1)
                        const chartHeight = 250
                        const chartWidth = 1100
                        const barWidth = chartWidth / monthlyStats.length
                        const padding = 50

                        return (
                          <g>
                            {/* Grid lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const y = padding + (1 - ratio) * chartHeight
                              const value = Math.round(maxRevenue * ratio)
                              return (
                                <g key={`grid-${ratio}`}>
                                  <line
                                    x1={padding}
                                    y1={y}
                                    x2={padding + chartWidth}
                                    y2={y}
                                    stroke="#E6E7F0"
                                    strokeDasharray="4,4"
                                    strokeWidth="1"
                                  />
                                  <text
                                    x={padding - 10}
                                    y={y + 4}
                                    fontSize="12"
                                    fill="#8892A6"
                                    textAnchor="end"
                                  >
                                    {value > 0 ? `$${(value / 1000).toFixed(0)}k` : '0'}
                                  </text>
                                </g>
                              )
                            })}

                            {/* Bars */}
                            {monthlyStats.map((stat, idx) => {
                              const barHeight = (stat.revenue / maxRevenue) * chartHeight
                              const x = padding + idx * barWidth + barWidth * 0.15
                              const y = padding + chartHeight - barHeight

                              return (
                                <g key={stat.month}>
                                  {/* Bar */}
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barWidth * 0.7}
                                    height={barHeight}
                                    fill="#FF6B2C"
                                    rx="6"
                                    ry="6"
                                    style={{ transition: 'all 0.3s ease' }}
                                  />
                                  {/* Label */}
                                  <text
                                    x={x + barWidth * 0.35}
                                    y={padding + chartHeight + 20}
                                    fontSize="13"
                                    fontWeight="600"
                                    fill="#181B2E"
                                    textAnchor="middle"
                                  >
                                    {stat.month}
                                  </text>
                                  {/* Value on top of bar */}
                                  {barHeight > 30 && (
                                    <text
                                      x={x + barWidth * 0.35}
                                      y={y - 8}
                                      fontSize="11"
                                      fontWeight="700"
                                      fill="#181B2E"
                                      textAnchor="middle"
                                    >
                                      {(stat.revenue / 1000).toFixed(0)}k
                                    </text>
                                  )}
                                </g>
                              )
                            })}

                            {/* Axes */}
                            <line
                              x1={padding}
                              y1={padding + chartHeight}
                              x2={padding + chartWidth}
                              y2={padding + chartHeight}
                              stroke="#181B2E"
                              strokeWidth="2"
                            />
                            <line
                              x1={padding}
                              y1={padding}
                              x2={padding}
                              y2={padding + chartHeight}
                              stroke="#181B2E"
                              strokeWidth="2"
                            />
                          </g>
                        )
                      })()}
                    </svg>
                  </div>

                  {/* Stats below chart */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        background: '#FAFBFD',
                        border: '1px solid #E6E7F0',
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>
                        Ingresos Totales
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#FF6B2C', marginTop: 4 }}>
                        {fmtP(monthlyStats.reduce((sum, s) => sum + s.revenue, 0))}
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#FAFBFD',
                        border: '1px solid #E6E7F0',
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>
                        Órdenes Totales
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#7C3AED', marginTop: 4 }}>
                        {monthlyStats.reduce((sum, s) => sum + s.orders, 0)}
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#FAFBFD',
                        border: '1px solid #E6E7F0',
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>
                        Ganancia Total
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: monthlyStats.reduce((sum, s) => sum + s.profit, 0) >= 0
                            ? '#0F9D58'
                            : '#DC2626',
                          marginTop: 4,
                        }}
                      >
                        {fmtP(monthlyStats.reduce((sum, s) => sum + s.profit, 0))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

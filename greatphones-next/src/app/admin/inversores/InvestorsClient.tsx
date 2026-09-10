'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import AdminTopbar from '@/components/AdminTopbar'

interface Move {
  id: string
  type: string
  amount: number
  detail: string | null
  capitalAfter: number
  operator: string | null
  createdAt: string
}
interface Investor {
  id: string
  name: string
  capital: number
  paidTotal: number
  pending: number
  yieldRate: number
  movements: Move[]
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
function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 9,
  border: '1.5px solid #E6E7F0',
  borderRadius: 9,
  fontSize: 13,
  background: '#FBFBFD',
  color: '#181B2E',
  transition: 'border-color .15s',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#3D4356',
  marginBottom: 5,
}

export default function InvestorsClient() {
  const [list, setList] = useState<Investor[]>([])
  const [cargando, setCargando] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [ncName, setNcName] = useState('')
  const [ncCapital, setNcCapital] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mType, setMType] = useState('INGRESO_CAPITAL')
  const [mAmount, setMAmount] = useState('')
  const [mDetail, setMDetail] = useState('')
  const [yieldMonth, setYieldMonth] = useState('')
  const [msg, setMsg] = useState<{ t: string; s: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const disparadorRef = useRef<HTMLElement | null>(null)

  const load = async () => {
    try {
      const r = await fetch('/api/admin/investors', { credentials: 'include' })
      const d = await r.json()
      setList(Array.isArray(d) ? d : [])
    } catch {}
    setCargando(false)
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  const toast = (t: string, s: string) => {
    setMsg({ t, s })
    setTimeout(() => setMsg(null), 4000)
  }

  const abrirCrear = () => {
    disparadorRef.current = document.activeElement as HTMLElement
    setShowCreate(true)
  }
  const cerrarCrear = () => {
    setShowCreate(false)
    setNcName('')
    setNcCapital('')
    requestAnimationFrame(() => disparadorRef.current?.focus())
  }

  useEffect(() => {
    if (!showCreate) return
    document.body.style.overflow = 'hidden'
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cerrarCrear()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showCreate])

  const create = async () => {
    if (!ncName.trim()) return toast('error', 'Ingresá el nombre del inversor')
    if (ncCapital && (parseInt(ncCapital, 10) || 0) < 0)
      return toast('error', 'El capital no puede ser negativo')
    setGuardando(true)
    try {
      const r = await fetch('/api/admin/investors', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: ncName.trim(),
          capital: parseInt(ncCapital || '0') || 0,
        }),
      })
      const d = await r.json()
      if (!r.ok) return toast('error', d.error || 'Error')
      toast('success', 'Inversor creado')
      cerrarCrear()
      load()
    } catch {
      toast('error', 'Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const move = async () => {
    if (!activeId) return
    const amt = parseInt(mAmount || '0', 10)
    if (!amt || amt <= 0) return toast('error', 'Ingresá un monto mayor a 0')
    setGuardando(true)
    try {
      const r = await fetch('/api/admin/investors', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          investorId: activeId,
          type: mType,
          amount: amt,
          detail: mDetail,
        }),
      })
      const d = await r.json()
      if (!r.ok) return toast('error', d.error || 'Error')
      toast('success', 'Movimiento registrado')
      setMAmount('')
      setMDetail('')
      load()
    } catch {
      toast('error', 'Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const genYield = async () => {
    if (!activeId || !yieldMonth) return toast('error', 'Indicá el mes (YYYY-MM)')
    setGuardando(true)
    try {
      const r = await fetch('/api/admin/investors', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'yield', investorId: activeId, month: yieldMonth }),
      })
      const d = await r.json()
      if (!r.ok) return toast('error', d.error || 'Error')
      toast('success', 'Rendimiento generado')
      setYieldMonth('')
      load()
    } catch {
      toast('error', 'Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <AdminTopbar titulo="Inversores" />
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <style>{`
          .inv-card{ transition: box-shadow .15s}
          .inv-card:hover{ box-shadow:0 4px 16px rgba(23,23,45,.06)}
          .pe-input:focus{ border-color:#FF6B2C!important; outline:none}
          .pe-btn:focus-visible{ outline:2px solid #FF6B2C; outline-offset:2px}
          .pm-card{ animation:pmin .16s ease-out}
          @keyframes pmin{from{opacity:0;transform:translateY(8px) scale(.985)} to{opacity:1;transform:none}}
          @media(prefers-reduced-motion:reduce){.pm-card{animation:none!important}}
        `}</style>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 4,
          }}
        >
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Cuenta corriente de financistas externos — capital, retiros y rendimiento mensual.
          </p>
          <button
            onClick={abrirCrear}
            className="pe-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }} aria-hidden="true">
              person_add
            </span>
            Nuevo inversor
          </button>
        </div>

        {msg && (
          <div
            role={msg.t === 'success' ? 'status' : 'alert'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderRadius: 10,
              margin: '16px 0',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              background: msg.t === 'success' ? '#0F9D58' : '#DC2626',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden="true">
              {msg.t === 'success' ? 'check_circle' : 'error'}
            </span>
            {msg.s}
          </div>
        )}

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#8892A6', padding: 32, fontSize: 13 }}>
            Cargando inversores…
          </p>
        ) : list.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 48,
              background: '#fff',
              border: '1px dashed #E6E7F0',
              borderRadius: 12,
              marginTop: 16,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 36, color: '#C3C9D6' }}
              aria-hidden="true"
            >
              group
            </span>
            <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: '#181B2E' }}>
              Aún no hay inversores
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
              Creá el primero para llevar la cuenta corriente.
            </p>
          </div>
        ) : (
          list.map(inv => (
            <div
              key={inv.id}
              className="inv-card"
              style={{
                background: '#fff',
                border: '1px solid #E6E7F0',
                borderRadius: 14,
                padding: 20,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: '#FFF1E8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FF6B2C',
                      fontWeight: 800,
                      fontSize: 16,
                    }}
                  >
                    {inv.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#181B2E' }}>
                      {inv.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 12 }}
                        aria-hidden="true"
                      >
                        trending_up
                      </span>
                      Rendimiento {inv.yieldRate}% mensual
                    </div>
                  </div>
                </div>
                <div style={{ display: 'inline-flex', gap: 8 }}>
                  <Link
                    href={`/admin/inversores/${inv.id}`}
                    style={{
                      padding: '8px 14px',
                      border: '1.5px solid #E6E7F0',
                      borderRadius: 9,
                      background: '#fff',
                      color: '#374151',
                      textDecoration: 'none',
                      fontSize: 12.5,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">
                      analytics
                    </span>
                    Ver panel
                  </Link>
                  <button
                    onClick={() => setActiveId(activeId === inv.id ? null : inv.id)}
                    className="pe-btn"
                    aria-expanded={activeId === inv.id}
                    style={{
                      padding: '8px 14px',
                      border: '1.5px solid #E6E7F0',
                      borderRadius: 9,
                      background: activeId === inv.id ? '#181B2E' : '#fff',
                      color: activeId === inv.id ? '#fff' : '#374151',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14 }}
                      aria-hidden="true"
                    >
                      {activeId === inv.id ? 'close' : 'tune'}
                    </span>
                    {activeId === inv.id ? 'Cerrar' : 'Gestionar'}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
                  gap: 12,
                }}
              >
                <div
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
                      fontWeight: 600,
                      color: '#6B7280',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, color: '#64748B' }}
                      aria-hidden="true"
                    >
                      account_balance
                    </span>
                    Capital invertido
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#181B2E' }}>
                    {fmt(inv.capital)}
                  </div>
                </div>
                <div
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
                      fontWeight: 600,
                      color: '#6B7280',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, color: '#2563EB' }}
                      aria-hidden="true"
                    >
                      payments
                    </span>
                    Rendimiento pagado
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#2563EB' }}>
                    {fmt(inv.paidTotal)}
                  </div>
                </div>
                <div
                  style={{
                    background: inv.pending > 0 ? '#FEF9E7' : '#F0FDF4',
                    border: `1px solid ${inv.pending > 0 ? '#F5E6B8' : '#ABEBC6'}`,
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: inv.pending > 0 ? '#9C6500' : '#166534',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14 }}
                      aria-hidden="true"
                    >
                      schedule
                    </span>
                    Pendiente de pago
                  </div>
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 800,
                      color: inv.pending > 0 ? '#9C6500' : '#0F9D58',
                    }}
                  >
                    {fmt(inv.pending)}
                  </div>
                </div>
              </div>

              {activeId === inv.id && (
                <div style={{ marginTop: 16, borderTop: '1px solid #EEF0F5', paddingTop: 16 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label htmlFor={`mType-${inv.id}`} style={labelStyle}>
                        Tipo
                      </label>
                      <select
                        id={`mType-${inv.id}`}
                        value={mType}
                        onChange={e => setMType(e.target.value)}
                        className="pe-input"
                        style={inputStyle}
                      >
                        {Object.entries(TYPE_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`mAmount-${inv.id}`} style={labelStyle}>
                        Monto ($)
                      </label>
                      <input
                        id={`mAmount-${inv.id}`}
                        value={mAmount}
                        onChange={e => setMAmount(e.target.value)}
                        type="number"
                        min={0}
                        className="pe-input"
                        style={inputStyle}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor={`mDetail-${inv.id}`} style={labelStyle}>
                        Detalle
                      </label>
                      <input
                        id={`mDetail-${inv.id}`}
                        value={mDetail}
                        onChange={e => setMDetail(e.target.value)}
                        placeholder="Opcional"
                        className="pe-input"
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                      <button
                        onClick={move}
                        disabled={guardando}
                        className="pe-btn"
                        style={{
                          flex: 1,
                          background: guardando ? '#C4B5FD' : '#FF6B2C',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 16px',
                          borderRadius: 9,
                          fontWeight: 700,
                          cursor: guardando ? 'wait' : 'pointer',
                        }}
                      >
                        Registrar
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <input
                      value={yieldMonth}
                      onChange={e => setYieldMonth(e.target.value)}
                      placeholder="Rend. YYYY-MM"
                      className="pe-input"
                      style={{ ...inputStyle, flex: 1, maxWidth: 160 }}
                    />
                    <button
                      onClick={genYield}
                      disabled={guardando}
                      className="pe-btn"
                      style={{
                        background: guardando ? '#93C5FD' : '#2563EB',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: 9,
                        fontWeight: 700,
                        cursor: guardando ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 14 }}
                        aria-hidden="true"
                      >
                        autorenew
                      </span>
                      Generar rendimiento
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: 260,
                      overflow: 'auto',
                      border: '1px solid #EDF0F6',
                      borderRadius: 10,
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr
                          style={{
                            background: '#F4F5FA',
                            textAlign: 'left',
                            position: 'sticky',
                            top: 0,
                          }}
                        >
                          <th style={{ padding: '8px 12px' }}>Fecha</th>
                          <th style={{ padding: '8px 12px' }}>Tipo</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Monto</th>
                          <th style={{ padding: '8px 12px' }}>Detalle</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Capital post</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.movements.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid #EEF0F5' }}>
                            <td
                              style={{
                                padding: '7px 12px',
                                color: '#6B7280',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {new Date(m.createdAt).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </td>
                            <td style={{ padding: '7px 12px' }}>
                              <span
                                style={{
                                  color: '#fff',
                                  background: TYPE_COLOR[m.type] || '#6B7280',
                                  padding: '3px 8px',
                                  borderRadius: 100,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                }}
                              >
                                {TYPE_LABEL[m.type] || m.type}
                              </span>
                            </td>
                            <td
                              style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}
                            >
                              {fmt(m.amount)}
                            </td>
                            <td style={{ padding: '7px 12px', color: '#3D4356' }}>
                              {m.detail || '—'}
                            </td>
                            <td
                              style={{ padding: '7px 12px', textAlign: 'right', color: '#6B7280' }}
                            >
                              {fmt(m.capitalAfter)}
                            </td>
                          </tr>
                        ))}
                        {inv.movements.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              style={{ padding: 20, textAlign: 'center', color: '#9AA1B2' }}
                            >
                              Sin movimientos
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {showCreate && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              onClick={cerrarCrear}
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)' }}
            />
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="inv-titulo"
              tabIndex={-1}
              className="pm-card"
              style={{
                position: 'relative',
                zIndex: 1,
                width: 'min(92vw, 480px)',
                background: '#fff',
                border: '1px solid #E6E7F0',
                borderRadius: 14,
                padding: 22,
                boxShadow: '0 12px 48px rgba(23,23,45,.22)',
                outline: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 4,
                }}
              >
                <h2
                  id="inv-titulo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#181B2E',
                    margin: 0,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 19, color: '#FF6B2C' }}
                    aria-hidden="true"
                  >
                    person_add
                  </span>
                  Nuevo inversor
                </h2>
                <button
                  onClick={cerrarCrear}
                  className="pe-btn"
                  aria-label="Cerrar"
                  style={{
                    background: '#EEF0F6',
                    color: '#64748B',
                    border: 'none',
                    borderRadius: 8,
                    padding: 6,
                    cursor: 'pointer',
                    display: 'inline-flex',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 17 }}
                    aria-hidden="true"
                  >
                    close
                  </span>
                </button>
              </div>
              <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
                Se crea la cuenta corriente con el capital inicial indicado.
              </p>
              <label htmlFor="ncName" style={labelStyle}>
                Nombre
              </label>
              <input
                id="ncName"
                value={ncName}
                onChange={e => setNcName(e.target.value)}
                placeholder="Ej: Juan Inversor"
                className="pe-input"
                style={inputStyle}
                autoFocus
              />
              <label htmlFor="ncCapital" style={{ ...labelStyle, marginTop: 12 }}>
                Capital inicial ($)
              </label>
              <input
                id="ncCapital"
                value={ncCapital}
                onChange={e => setNcCapital(e.target.value)}
                type="number"
                min={0}
                className="pe-input"
                style={inputStyle}
                placeholder="0"
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                <button
                  onClick={cerrarCrear}
                  className="pe-btn"
                  style={{
                    background: '#EEF0F6',
                    color: '#374151',
                    padding: '9px 18px',
                    border: 'none',
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={create}
                  disabled={guardando}
                  className="pe-btn"
                  style={{
                    background: guardando ? '#FFB48C' : 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 20px',
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: guardando ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {guardando ? (
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 15, animation: 'spin 1s linear infinite' }}
                      aria-hidden="true"
                    >
                      progress_activity
                    </span>
                  ) : (
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 15 }}
                      aria-hidden="true"
                    >
                      check
                    </span>
                  )}
                  Crear inversor
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

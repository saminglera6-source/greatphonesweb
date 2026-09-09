'use client'

import { useEffect, useRef, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'
import { fetchDolar } from '@/app/admin/precios/dolar'

interface PreEntrega {
  id: string
  code: string
  clientName: string
  clientDni?: string
  clientPhone?: string
  productModelName: string | null
  productStorage?: string | null
  productColor?: string | null
  price: number
  saldo?: number
  status: string
  tieneEquipo?: boolean
  expectedDeliveryStart?: string
  expectedDeliveryEnd?: string
  notes?: string
}

const OPERADORES = ['Martin', 'Maca', 'Sam', 'Eva', 'Buda']
const TOTAL = 3
const STEPS = ['Preventa', 'Cobro del saldo', 'Confirmar']

function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  border: '1.5px solid #E6E7F0',
  borderRadius: 9,
  fontSize: 13,
  background: '#FBFBFD',
  color: '#181B2E',
  transition: 'border-color .15s',
}
const inputErrorStyle: React.CSSProperties = { borderColor: '#DC2626', background: '#FEF6F6' }
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: '#3D4356',
  marginTop: 14,
  marginBottom: 5,
}

export default function EntregaClient() {
  const [tab, setTab] = useState<'entregar' | 'eliminar' | 'editar'>('entregar')

  // Tab: Entregar
  const [operador, setOperador] = useState('')
  const [preorders, setPreorders] = useState<PreEntrega[]>([])
  const [nPre, setNPre] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [efec, setEfec] = useState('')
  const [transf, setTransf] = useState('')
  const [cuotas, setCuotas] = useState('')
  const [usd, setUsd] = useState('')
  const [dolarCompra, setDolarCompra] = useState(1000)
  const [obs, setObs] = useState('')
  // Datos del equipo, si la preventa todavía no tiene compra vinculada
  const [eqImei, setEqImei] = useState('')
  const [eqCosto, setEqCosto] = useState('')
  const [eqProveedor, setEqProveedor] = useState('')
  // Confirmación explícita para entregar dejando saldo (regla 45)
  const [confirmarDeuda, setConfirmarDeuda] = useState(false)
  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<{ preventa: string } | null>(null)

  // Tab: Eliminar
  const [eliminarPreId, setEliminarPreId] = useState('')
  const [eliminarOperador, setEliminarOperador] = useState('')
  const [eliminarMotivo, setEliminarMotivo] = useState('')
  const [eliminarConfirm, setEliminarConfirm] = useState(false)
  const [eliminarSending, setEliminarSending] = useState(false)
  const [eliminarMsg, setEliminarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Tab: Editar
  const [editarPreId, setEditarPreId] = useState('')
  const [editarOpen, setEditarOpen] = useState(false)
  const [editarData, setEditarData] = useState<Partial<PreEntrega>>({})
  const [editarSending, setEditarSending] = useState(false)
  const [editarMsg, setEditarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const errRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activo = true
    fetch('/api/admin/ops/entregar-preventa', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('preventas')
        return r.json()
      })
      .then(d => {
        if (activo) setPreorders(Array.isArray(d) ? d : [])
      })
      .catch(() => {
        if (activo) setServerMsg('No se pudo cargar el listado de preventas. Recargá la página.')
      })
    fetchDolar().then(d => {
      if (activo && d?.compra) setDolarCompra(d.compra)
    })
    return () => {
      activo = false
    }
  }, [])

  const recargarPreorders = () => {
    fetch('/api/admin/ops/entregar-preventa', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('preventas')
        return r.json()
      })
      .then(d => setPreorders(Array.isArray(d) ? d : []))
      .catch(() => setServerMsg('No se pudo actualizar el listado de preventas.'))
  }

  const sel = preorders.find(p => p.id === nPre)
  const saldo = sel ? (sel.saldo ?? sel.price) : 0
  const faltaEquipo = !!sel && sel.tieneEquipo === false
  const usdPesos = Math.round((parseInt(usd) || 0) * dolarCompra)
  const totalIngresado =
    (parseInt(efec) || 0) + (parseInt(transf) || 0) + (parseInt(cuotas) || 0) + usdPesos
  const restante = saldo - totalIngresado

  const validarPaso = (p: number): Record<string, string> => {
    const e: Record<string, string> = {}
    if (p === 1 && !operador) e.operador = 'Seleccioná el operador'
    if (p === 1 && !nPre)
      e.nPre =
        preorders.length === 0
          ? 'No hay preventas pendientes de entrega'
          : 'Seleccioná la preventa a entregar'
    if (p === 1 && faltaEquipo && !(parseInt(eqCosto) >= 0))
      e.eqCosto = 'Ingresá el costo del equipo (esta preventa no tiene compra cargada)'
    if (p === 2 && totalIngresado > saldo + 1)
      e.cobros = `Lo que cobrás ahora (${fmt(totalIngresado)}) supera el saldo (${fmt(saldo)})`
    if (p === 2 && restante > 1 && !confirmarDeuda)
      e.cobros = `Queda un saldo de ${fmt(restante)}. Confirmá "entregar con deuda" para continuar.`
    return e
  }

  const limpiarError = (id: string) =>
    setErrors(prev => {
      if (!prev[id]) return prev
      const n = { ...prev }
      delete n[id]
      return n
    })

  const validarEnBlur = (id: string) =>
    setErrors(prev => {
      const nuevo = validarPaso(step)[id]
      if (nuevo && !prev[id]) return { ...prev, [id]: nuevo }
      if (!nuevo && prev[id]) {
        const n = { ...prev }
        delete n[id]
        return n
      }
      return prev
    })

  const irAPaso = (dest: number) => {
    if (dest > step) {
      const e = validarPaso(step)
      setErrors(e)
      if (Object.keys(e).length > 0) {
        requestAnimationFrame(() => {
          errRef.current?.focus({ preventScroll: true })
          errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
        return
      }
    }
    setServerMsg(null)
    setErrors({})
    setStep(dest)
    setMaxStep(m => Math.max(m, dest))
  }

  const resetear = () => {
    setNPre('')
    setEfec('')
    setTransf('')
    setCuotas('')
    setUsd('')
    setObs('')
    setEqImei('')
    setEqCosto('')
    setEqProveedor('')
    setConfirmarDeuda(false)
    setFecha(new Date().toISOString().split('T')[0])
    setStep(1)
    setMaxStep(1)
    setErrors({})
    setServerMsg(null)
    setDone(null)
  }

  const completarSaldoConEfectivo = () => {
    const yaOtros = (parseInt(transf) || 0) + (parseInt(cuotas) || 0) + usdPesos
    const falta = saldo - yaOtros - (parseInt(efec) || 0)
    if (falta > 0) setEfec(String((parseInt(efec) || 0) + falta))
    limpiarError('cobros')
  }

  const enviar = async () => {
    const todos = { ...validarPaso(1), ...validarPaso(2) }
    if (Object.keys(todos).length > 0) {
      setErrors(todos)
      const primero = Object.keys(todos)[0]
      setStep(primero === 'cobros' ? 2 : 1)
      requestAnimationFrame(() => {
        errRef.current?.focus({ preventScroll: true })
        errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return
    }
    setSending(true)
    setServerMsg(null)
    try {
      const r = await fetch('/api/admin/ops/entregar-preventa', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preOrderId: nPre,
          fecha,
          efectivo: parseInt(efec) || 0,
          transferencia: parseInt(transf) || 0,
          cuotas: parseInt(cuotas) || 0,
          usd: parseInt(usd) || 0,
          obs,
          operador,
          confirmarDeuda,
          equipo: faltaEquipo
            ? {
                imei: eqImei.trim() || null,
                costo: parseInt(eqCosto) || 0,
                proveedor: eqProveedor.trim() || null,
                color: sel?.productColor || null,
                storage: sel?.productStorage || null,
              }
            : null,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setServerMsg(d.error || 'Error al registrar la entrega')
        return
      }
      setDone({ preventa: d.preventa })
      recargarPreorders()
    } catch {
      setServerMsg('Error de conexión. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const eliminarPreventa = async () => {
    if (!eliminarPreId || !eliminarOperador) return
    setEliminarSending(true)
    setEliminarMsg(null)
    try {
      const r = await fetch('/api/admin/ops/entregar-preventa', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preOrderId: eliminarPreId,
          operador: eliminarOperador,
          motivo: eliminarMotivo,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setEliminarMsg({ type: 'error', text: d.error || 'Error al eliminar' })
        return
      }
      setEliminarMsg({ type: 'success', text: `Preventa ${d.code} eliminada correctamente` })
      setEliminarPreId('')
      setEliminarOperador('')
      setEliminarMotivo('')
      setEliminarConfirm(false)
      recargarPreorders()
    } catch {
      setEliminarMsg({ type: 'error', text: 'Error de conexión. Intentá de nuevo.' })
    } finally {
      setEliminarSending(false)
    }
  }

  const abrirEditar = (pre: PreEntrega) => {
    setEditarPreId(pre.id)
    setEditarData({
      clientName: pre.clientName,
      clientDni: pre.clientDni || '',
      clientPhone: pre.clientPhone || '',
      productModelName: pre.productModelName || '',
      price: pre.price,
      expectedDeliveryStart: pre.expectedDeliveryStart ? pre.expectedDeliveryStart.split('T')[0] : '',
      expectedDeliveryEnd: pre.expectedDeliveryEnd ? pre.expectedDeliveryEnd.split('T')[0] : '',
      notes: pre.notes || '',
    })
    setEditarOpen(true)
    setEditarMsg(null)
  }

  const guardarEdicion = async () => {
    if (!editarPreId) return
    setEditarSending(true)
    setEditarMsg(null)
    try {
      const r = await fetch(`/api/admin/preorders/${editarPreId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: editarData.clientName,
          clientDni: editarData.clientDni,
          clientPhone: editarData.clientPhone,
          productModelName: editarData.productModelName,
          price: editarData.price,
          expectedDeliveryStart: editarData.expectedDeliveryStart || null,
          expectedDeliveryEnd: editarData.expectedDeliveryEnd || null,
          notes: editarData.notes,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setEditarMsg({ type: 'error', text: d.error || 'Error al guardar' })
        return
      }
      setEditarMsg({ type: 'success', text: 'Preventa actualizada correctamente' })
      setEditarOpen(false)
      recargarPreorders()
    } catch {
      setEditarMsg({ type: 'error', text: 'Error de conexión. Intentá de nuevo.' })
    } finally {
      setEditarSending(false)
    }
  }

  const fieldProps = (id: string) => ({
    id,
    style: { ...inputStyle, ...(errors[id] ? inputErrorStyle : {}) },
    'aria-invalid': errors[id] ? true : undefined,
    'aria-describedby': errors[id] ? `${id}-error` : undefined,
  })

  if (done && tab === 'entregar') {
    return (
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <style>{`
          .cw-btn:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 2px; }
          .cw-primary:not(:disabled):hover { filter: brightness(.94); }
        `}</style>
        <div
          role="status"
          style={{
            background: '#fff',
            border: '1px solid #E6E7F0',
            borderRadius: 14,
            padding: '48px 24px',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 56, color: '#0F9D58' }}
            aria-hidden="true"
          >
            check_circle
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#181B2E', margin: '12px 0 4px' }}>
            Entrega registrada
          </h2>
          <p style={{ fontSize: 13.5, color: '#6B7280', margin: 0 }}>
            Preventa <strong style={{ color: '#181B2E' }}>{done.preventa}</strong> entregada
          </p>
          <button
            onClick={resetear}
            className="cw-btn cw-primary"
            style={{
              marginTop: 24,
              background: 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
              color: '#fff',
              padding: '11px 28px',
              border: 'none',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Registrar otra entrega
          </button>
        </div>
      </div>
    )
  }

  const resumen: [string, string][] = [
    ['Operador', operador || '—'],
    ['Fecha de entrega', fecha],
    ['Preventa', sel ? `${sel.code} — ${sel.productModelName || ''}` : '—'],
    ['Cliente', sel?.clientName || '—'],
    ['Precio pactado', sel ? fmt(sel.price) : '—'],
    [
      'Cobro ahora',
      [
        efec ? `Efectivo ${fmt(+efec)}` : '',
        transf ? `Transf. ${fmt(+transf)}` : '',
        cuotas ? `Cuotas ${fmt(+cuotas)}` : '',
        usd ? `${usd} USD` : '',
      ]
        .filter(Boolean)
        .join(' · ') || '—',
    ],
    ['Total ingresado', fmt(totalIngresado)],
    ['Saldo restante tras la entrega', fmt(Math.max(restante, 0))],
  ]

  return (
    <>
      <AdminTopbar titulo="Entregar Preventa" />
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <style>{`
        .cw-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
        @media (max-width: 640px) {
          .cw-grid-4 { grid-template-columns: repeat(2,1fr); }
          .cw-steplabel { display: none; }
        }
        .cw-input:focus { border-color: #FF6B2C !important; outline: none; }
        .cw-btn:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 2px; }
        .cw-primary:not(:disabled):hover { filter: brightness(.94); }
        .cw-back:not(:disabled):hover { background: #F4F6F9; }
        .cw-dot-btn:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 2px; }
        .cw-chip-btn:hover { background: #FFF1E8; }
        .cw-tab-btn { transition: all .15s; }
        .cw-tab-btn:hover { background: #F4F6F9; }
        .cw-tab-btn.active { background: #FF6B2C; color: #fff; }
        .cw-spin { animation: cws 1s linear infinite; }
        @keyframes cws { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .cw-spin { animation: none !important; }
          .cw-bar, .cw-dot-btn, .cw-btn { transition: none !important; }
        }
      `}</style>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['entregar', 'eliminar', 'editar'] as const).map(t => (
            <button
              key={t}
              type="button"
              className="cw-tab-btn"
              onClick={() => setTab(t)}
              style={{
                padding: '10px 16px',
                border: tab === t ? 'none' : '1.5px solid #E6E7F0',
                borderRadius: 8,
                background: tab === t ? '#FF6B2C' : '#fff',
                color: tab === t ? '#fff' : '#3D4356',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t === 'entregar' ? 'Entregar' : t === 'eliminar' ? 'Eliminar' : 'Editar'}
            </button>
          ))}
        </div>

        {tab === 'entregar' && (
          <>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 18px' }}>
              Cobro del saldo pendiente y entrega del equipo
            </p>

            <nav aria-label="Progreso del formulario">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <p
              style={{ fontSize: 12.5, fontWeight: 700, color: '#181B2E', margin: 0 }}
              aria-hidden="true"
            >
              Paso {step} de {TOTAL} · {STEPS[step - 1]}
            </p>
            <p style={{ fontSize: 11.5, color: '#94A3B8', margin: 0 }} aria-hidden="true">
              {Math.round((step / TOTAL) * 100)}%
            </p>
          </div>
          <div
            style={{ height: 5, background: '#EDF0F6', borderRadius: 99, overflow: 'hidden' }}
            aria-hidden="true"
          >
            <div
              className="cw-bar"
              style={{
                height: '100%',
                width: `${(step / TOTAL) * 100}%`,
                background: 'linear-gradient(90deg,#FF6B2C,#FF8A50)',
                borderRadius: 99,
                transition: 'width .25s ease',
              }}
            />
          </div>
          <ol
            style={{
              display: 'flex',
              alignItems: 'center',
              listStyle: 'none',
              margin: '14px 0 0',
              padding: 0,
            }}
          >
            {STEPS.map((label, i) => {
              const n = i + 1
              const completo = n < step
              const activo = n === step
              const alcanzable = n <= maxStep
              return (
                <li
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: n < TOTAL ? 1 : '0 0 auto',
                    minWidth: 0,
                  }}
                >
                  <button
                    type="button"
                    className="cw-dot-btn"
                    onClick={() => alcanzable && irAPaso(n)}
                    disabled={!alcanzable}
                    aria-label={`Paso ${n}: ${label}${activo ? ' (actual)' : completo ? ' (completado)' : ''}`}
                    aria-current={activo ? 'step' : undefined}
                    title={label}
                    style={{
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: activo
                        ? '2.5px solid #FF6B2C'
                        : '2px solid ' + (completo ? '#FFD3BC' : '#E6E7F0'),
                      background: activo ? '#FF6B2C' : completo ? '#FFF1E8' : '#FBFBFD',
                      color: activo ? '#fff' : completo ? '#FF6B2C' : '#B6BCCB',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: alcanzable ? 'pointer' : 'default',
                      transition: 'background .15s, border-color .15s',
                    }}
                  >
                    {completo ? (
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16 }}
                        aria-hidden="true"
                      >
                        check
                      </span>
                    ) : (
                      n
                    )}
                  </button>
                  {n < TOTAL && (
                    <>
                      <span
                        className="cw-steplabel"
                        style={{
                          fontSize: 11,
                          fontWeight: activo ? 700 : 500,
                          color: activo ? '#FF6B2C' : completo ? '#F08A4B' : '#B6BCCB',
                          marginLeft: 6,
                          marginRight: 8,
                          whiteSpace: 'nowrap',
                        }}
                        aria-hidden="true"
                      >
                        {label}
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          flex: 1,
                          minWidth: 8,
                          height: 2,
                          background: completo ? '#FFD3BC' : '#EDF0F6',
                          borderRadius: 2,
                          marginRight: 6,
                        }}
                      />
                    </>
                  )}
                </li>
              )
            })}
          </ol>
          <p
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
            }}
            role="status"
          >
            {`Paso ${step} de ${TOTAL}: ${STEPS[step - 1]}`}
          </p>
        </nav>

        <form
          onSubmit={ev => {
            ev.preventDefault()
            if (step < TOTAL) irAPaso(step + 1)
            else enviar()
          }}
          style={{
            background: '#fff',
            border: '1px solid #E6E7F0',
            borderRadius: 14,
            padding: 24,
            marginTop: 16,
            boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)',
          }}
        >
          {Object.keys(errors).length > 0 && (
            <div
              ref={errRef}
              tabIndex={-1}
              role="alert"
              aria-labelledby="cw-error-title"
              style={{
                background: '#FEF2F2',
                borderLeft: '4px solid #DC2626',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16,
                outline: 'none',
              }}
            >
              <p
                id="cw-error-title"
                style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', margin: '0 0 6px' }}
              >
                Revisá estos datos para continuar:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {Object.entries(errors).map(([id, txt]) => (
                  <li key={id}>
                    <a href={`#${id}`} style={{ fontSize: 12.5, color: '#DC2626' }}>
                      {txt}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {serverMsg && (
            <div
              role="alert"
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '11px 14px',
                marginBottom: 16,
                color: '#B91C1C',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {serverMsg}
            </div>
          )}

          {step === 1 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                ¿Quién entrega y qué preventa?
              </legend>
              <label htmlFor="operador" style={{ ...labelStyle, marginTop: 12 }}>
                Operador *
              </label>
              <select
                {...fieldProps('operador')}
                className="cw-input"
                value={operador}
                onChange={e => {
                  setOperador(e.target.value)
                  limpiarError('operador')
                }}
                onBlur={() => validarEnBlur('operador')}
              >
                <option value="" disabled>
                  Seleccionar...
                </option>
                {OPERADORES.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {errors.operador && (
                <p
                  id="operador-error"
                  style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                >
                  {errors.operador}
                </p>
              )}

              <label htmlFor="nPre" style={labelStyle}>
                Preventa a entregar *
              </label>
              <select
                {...fieldProps('nPre')}
                className="cw-input"
                value={nPre}
                onChange={e => {
                  setNPre(e.target.value)
                  limpiarError('nPre')
                }}
                onBlur={() => validarEnBlur('nPre')}
              >
                <option value="">Seleccionar preventa...</option>
                {preorders.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.productModelName || ''} → {p.clientName} [{p.status}]
                  </option>
                ))}
              </select>
              {errors.nPre && (
                <p id="nPre-error" style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}>
                  {errors.nPre}
                </p>
              )}
              {preorders.length === 0 && (
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#64748B',
                    background: '#F8FAFC',
                    border: '1px solid #EDF0F6',
                    borderRadius: 8,
                    padding: '9px 12px',
                    marginTop: 10,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                    aria-hidden="true"
                  >
                    info
                  </span>
                  No hay preventas pendientes. Todo al día.
                </p>
              )}

              {sel && (
                <dl
                  style={{
                    background: '#EEF3FE',
                    borderLeft: '4px solid #2563EB',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginTop: 12,
                    margin: '12px 0 0',
                    fontSize: 13,
                  }}
                >
                  {[
                    ['Cliente', sel.clientName],
                    ['Modelo', sel.productModelName || '—'],
                    ['Precio pactado', fmt(sel.price)],
                    ['Saldo pendiente', fmt(saldo)],
                  ].map(([k, v], i) => (
                    <div
                      key={k}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: i === 0 ? '0 0 6px' : '6px 0',
                        borderBottom: i < 3 ? '1px solid #DBEAFE' : 'none',
                      }}
                    >
                      <dt style={{ color: '#64748B', margin: 0 }}>{k}</dt>
                      <dd
                        style={{
                          fontWeight: k === 'Saldo pendiente' ? 800 : 600,
                          color: k === 'Saldo pendiente' ? '#1D4ED8' : '#181B2E',
                          margin: 0,
                          textAlign: 'right',
                        }}
                      >
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {faltaEquipo && (
                <div
                  style={{
                    marginTop: 12,
                    background: '#FEF9F3',
                    border: '1px solid #F6D9B8',
                    borderRadius: 9,
                    padding: '12px 14px',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#9A5B0C' }}>
                    Esta preventa no tiene compra cargada
                  </p>
                  <p style={{ margin: '3px 0 8px', fontSize: 12, color: '#8A6A45' }}>
                    Se creará la compra &laquo;Reservado Preventa&raquo; con estos datos y su asiento de
                    egreso.
                  </p>
                  <label htmlFor="eq-costo" style={{ ...labelStyle, marginTop: 6 }}>
                    Costo del equipo *
                  </label>
                  <input
                    id="eq-costo"
                    type="number"
                    min={0}
                    className="cw-input"
                    style={{ ...inputStyle, ...(errors.eqCosto ? inputErrorStyle : {}) }}
                    value={eqCosto}
                    onChange={e => {
                      setEqCosto(e.target.value)
                      limpiarError('eqCosto')
                    }}
                    onBlur={() => validarEnBlur('eqCosto')}
                  />
                  {errors.eqCosto && (
                    <p style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}>{errors.eqCosto}</p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label htmlFor="eq-imei" style={labelStyle}>
                        IMEI / N° serie
                      </label>
                      <input
                        id="eq-imei"
                        className="cw-input"
                        style={inputStyle}
                        value={eqImei}
                        onChange={e => setEqImei(e.target.value)}
                        placeholder="opcional"
                      />
                    </div>
                    <div>
                      <label htmlFor="eq-prov" style={labelStyle}>
                        Proveedor
                      </label>
                      <input
                        id="eq-prov"
                        className="cw-input"
                        style={inputStyle}
                        value={eqProveedor}
                        onChange={e => setEqProveedor(e.target.value)}
                        placeholder="opcional"
                      />
                    </div>
                  </div>
                </div>
              )}
            </fieldset>
          )}

          {step === 2 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Cobro del saldo
              </legend>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#FEF6E7',
                  borderLeft: '4px solid #D97706',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginTop: 12,
                }}
              >
                <div>
                  <p style={{ fontSize: 11.5, color: '#9C6500', margin: 0 }}>Saldo pendiente</p>
                  <p style={{ fontSize: 19, fontWeight: 800, color: '#7D6608', margin: 0 }}>
                    {sel ? fmt(saldo) : '—'}
                  </p>
                </div>
                {sel && saldo > 0 && (
                  <button
                    type="button"
                    className="cw-btn cw-chip-btn"
                    onClick={completarSaldoConEfectivo}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#fff',
                      border: '1.5px solid #F5E6B8',
                      borderRadius: 99,
                      padding: '7px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#9C6500',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 15 }}
                      aria-hidden="true"
                    >
                      bolt
                    </span>
                    Completar con efectivo
                  </button>
                )}
              </div>

              <label style={{ ...labelStyle, marginBottom: 2 }} id="lbl-cobros">
                Cobrar ahora en ($)
              </label>
              <div className="cw-grid-4" id="cobros" role="group" aria-labelledby="lbl-cobros">
                {(
                  [
                    ['Efectivo', efec, setEfec],
                    ['Transferencia', transf, setTransf],
                    ['Cuotas', cuotas, setCuotas],
                    ['USD', usd, setUsd],
                  ] as [string, string, (v: string) => void][]
                ).map(([lab, val, set]) => (
                  <div key={lab}>
                    <label
                      htmlFor={`cobro-${lab.toLowerCase()}`}
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#3D4356',
                        marginBottom: 4,
                      }}
                    >
                      {lab}
                    </label>
                    <input
                      type="number"
                      min={0}
                      id={`cobro-${lab.toLowerCase()}`}
                      className="cw-input"
                      style={{ ...inputStyle, padding: 8 }}
                      value={val}
                      onChange={e => {
                        set(e.target.value)
                        limpiarError('cobros')
                      }}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '5px 0 0' }}>
                Los USD se convierten a pesos al cotizar 1 USD = {fmt(dolarCompra)}.
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: totalIngresado > saldo + 1 ? '#FDEDEC' : '#D5F5E3',
                  border: `1px solid ${totalIngresado > saldo + 1 ? '#F5B7B1' : '#ABEBC6'}`,
                  padding: '12px 14px',
                  borderRadius: 10,
                  marginTop: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: totalIngresado > saldo + 1 ? '#943126' : '#186A3B',
                  }}
                >
                  Total a ingresar
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: totalIngresado > saldo + 1 ? '#943126' : '#186A3B',
                  }}
                >
                  {fmt(totalIngresado)}
                  {parseInt(usd) ? (
                    <span style={{ fontSize: 11, fontWeight: 600 }}> (incluye {usd} USD)</span>
                  ) : null}
                </span>
              </div>
              {totalIngresado > saldo + 1 ? (
                errors.cobros && (
                  <p
                    id="cobros-error"
                    style={{ fontSize: 12, color: '#DC2626', margin: '8px 0 0', fontWeight: 600 }}
                  >
                    {errors.cobros}
                  </p>
                )
              ) : restante > 1 ? (
                <div
                  style={{
                    marginTop: 10,
                    background: '#FEF9F3',
                    border: `1px solid ${errors.cobros ? '#F5B7B1' : '#F6D9B8'}`,
                    borderRadius: 9,
                    padding: '10px 12px',
                  }}
                >
                  <label
                    style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', fontSize: 12.5, color: '#8A5A18' }}
                  >
                    <input
                      type="checkbox"
                      checked={confirmarDeuda}
                      onChange={e => {
                        setConfirmarDeuda(e.target.checked)
                        limpiarError('cobros')
                      }}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      Entregar con deuda: el cliente queda debiendo <b>{fmt(restante)}</b>. La preventa
                      queda en &laquo;Entregado con saldo&raquo;.
                    </span>
                  </label>
                  {errors.cobros && (
                    <p style={{ fontSize: 12, color: '#DC2626', margin: '6px 0 0', fontWeight: 600 }}>
                      {errors.cobros}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#186A3B', margin: '8px 0 0' }}>
                  El saldo queda cubierto por completo con este cobro.
                </p>
              )}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Fecha y confirmación
              </legend>
              <label htmlFor="fecha" style={{ ...labelStyle, marginTop: 12 }}>
                Fecha de entrega
              </label>
              <input
                type="date"
                {...fieldProps('fecha')}
                className="cw-input"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
              />

              <label htmlFor="obs" style={labelStyle}>
                Observaciones
              </label>
              <textarea
                {...fieldProps('obs')}
                className="cw-input"
                style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Ej: entregado en local"
              />

              <dl
                style={{
                  margin: '18px 0 0',
                  background: '#FAFBFD',
                  border: '1px solid #EDF0F6',
                  borderRadius: 10,
                  padding: '6px 16px',
                }}
              >
                {resumen.map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: '7px 0',
                      borderBottom: '1px solid #EFF1F6',
                    }}
                  >
                    <dt style={{ fontSize: 12, color: '#6B7280', margin: 0, flexShrink: 0 }}>
                      {k}
                    </dt>
                    <dd
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#181B2E',
                        margin: 0,
                        textAlign: 'right',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </fieldset>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            {step > 1 && (
              <button
                type="button"
                className="cw-btn cw-back"
                onClick={() => irAPaso(step - 1)}
                disabled={sending}
                style={{
                  padding: '12px 20px',
                  border: '1.5px solid #E6E7F0',
                  borderRadius: 10,
                  background: '#fff',
                  color: '#3D4356',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 17 }}
                  aria-hidden="true"
                >
                  arrow_back
                </span>
                Volver
              </button>
            )}
            <button
              type="submit"
              className="cw-btn cw-primary"
              disabled={sending}
              style={{
                flex: 1,
                background: sending ? '#FFB48C' : 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
                color: '#fff',
                padding: 12,
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: sending ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'filter .15s, background .15s',
              }}
            >
              {sending ? (
                <>
                  <span
                    className="material-symbols-outlined cw-spin"
                    style={{ fontSize: 18 }}
                    aria-hidden="true"
                  >
                    progress_activity
                  </span>
                  Registrando…
                </>
              ) : step < TOTAL ? (
                <>
                  Continuar
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 17 }}
                    aria-hidden="true"
                  >
                    arrow_forward
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18 }}
                    aria-hidden="true"
                  >
                    check_circle
                  </span>
                  Confirmar entrega
                </>
              )}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', margin: '12px 0 0' }}>
            Podés volver a los pasos anteriores con el menú superior para corregir cualquier dato.
          </p>
            </form>
          </>
        )}

        {tab === 'eliminar' && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #E6E7F0',
              borderRadius: 14,
              padding: 24,
              marginTop: 0,
              boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)',
            }}
          >
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Eliminar Preventa
              </legend>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '8px 0 18px' }}>
                Elimina una preventa del sistema registrando el motivo
              </p>

              {eliminarMsg && (
                <div
                  role="alert"
                  style={{
                    background: eliminarMsg.type === 'error' ? '#FEF2F2' : '#F0FDF4',
                    border: `1px solid ${eliminarMsg.type === 'error' ? '#FECACA' : '#BBEF63'}`,
                    borderRadius: 8,
                    padding: '11px 14px',
                    marginBottom: 16,
                    color: eliminarMsg.type === 'error' ? '#B91C1C' : '#166534',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {eliminarMsg.text}
                </div>
              )}

              <label htmlFor="eliminar-pre-id" style={labelStyle}>
                Preventa a eliminar *
              </label>
              <select
                id="eliminar-pre-id"
                className="cw-input"
                style={inputStyle}
                value={eliminarPreId}
                onChange={e => {
                  setEliminarPreId(e.target.value)
                  setEliminarConfirm(false)
                }}
              >
                <option value="">Seleccionar preventa...</option>
                {preorders.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.productModelName || ''} → {p.clientName}
                  </option>
                ))}
              </select>

              <label htmlFor="eliminar-operador" style={labelStyle}>
                Operador *
              </label>
              <select
                id="eliminar-operador"
                className="cw-input"
                style={inputStyle}
                value={eliminarOperador}
                onChange={e => setEliminarOperador(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {OPERADORES.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>

              <label htmlFor="eliminar-motivo" style={labelStyle}>
                Motivo de eliminación
              </label>
              <textarea
                id="eliminar-motivo"
                className="cw-input"
                style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
                value={eliminarMotivo}
                onChange={e => setEliminarMotivo(e.target.value)}
                placeholder="Ej: cliente desistió, cambio de planes"
              />

              {eliminarPreId && eliminarOperador && !eliminarConfirm && (
                <button
                  type="button"
                  className="cw-btn cw-primary"
                  onClick={() => setEliminarConfirm(true)}
                  style={{
                    marginTop: 16,
                    background: 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
                    color: '#fff',
                    padding: '12px 20px',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Continuar
                </button>
              )}

              {eliminarConfirm && (
                <div
                  style={{
                    background: '#FEF6E7',
                    borderLeft: '4px solid #D97706',
                    borderRadius: 8,
                    padding: '14px',
                    marginTop: 16,
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: '0 0 10px' }}>
                    ¿Eliminar esta preventa?
                  </p>
                  <p style={{ fontSize: 12, color: '#9C6500', margin: 0 }}>
                    Se registrará la eliminación en el historial de la preventa con el motivo especificado.
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="cw-btn cw-back"
                      onClick={() => setEliminarConfirm(false)}
                      disabled={eliminarSending}
                      style={{
                        padding: '10px 16px',
                        border: '1.5px solid #E6E7F0',
                        borderRadius: 8,
                        background: '#fff',
                        color: '#3D4356',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="cw-btn cw-primary"
                      onClick={eliminarPreventa}
                      disabled={eliminarSending}
                      style={{
                        flex: 1,
                        background: eliminarSending ? '#FFB48C' : '#DC2626',
                        color: '#fff',
                        padding: '10px 16px',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: eliminarSending ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      {eliminarSending ? (
                        <>
                          <span
                            className="material-symbols-outlined cw-spin"
                            style={{ fontSize: 16 }}
                            aria-hidden="true"
                          >
                            progress_activity
                          </span>
                          Eliminando…
                        </>
                      ) : (
                        <>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 16 }}
                            aria-hidden="true"
                          >
                            delete
                          </span>
                          Eliminar preventa
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </fieldset>
          </div>
        )}

        {tab === 'editar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                background: '#fff',
                border: '1px solid #E6E7F0',
                borderRadius: 14,
                padding: 24,
                boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)',
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Editar Preventa
              </h3>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '8px 0 16px' }}>
                Selecciona una preventa para editar sus datos
              </p>

              <label htmlFor="editar-pre-id" style={labelStyle}>
                Preventa a editar *
              </label>
              <select
                id="editar-pre-id"
                className="cw-input"
                style={inputStyle}
                value={editarPreId}
                onChange={e => {
                  const id = e.target.value
                  setEditarPreId(id)
                  if (id) {
                    const pre = preorders.find(p => p.id === id)
                    if (pre) abrirEditar(pre)
                  } else {
                    setEditarOpen(false)
                  }
                }}
              >
                <option value="">Seleccionar preventa...</option>
                {preorders.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.productModelName || ''} → {p.clientName}
                  </option>
                ))}
              </select>
            </div>

            {editarOpen && (
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E6E7F0',
                  borderRadius: 14,
                  padding: 24,
                  boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)',
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#181B2E', marginBottom: 16 }}>
                  Datos de la preventa
                </h3>

                {editarMsg && (
                  <div
                    role="alert"
                    style={{
                      background: editarMsg.type === 'error' ? '#FEF2F2' : '#F0FDF4',
                      border: `1px solid ${editarMsg.type === 'error' ? '#FECACA' : '#BBEF63'}`,
                      borderRadius: 8,
                      padding: '11px 14px',
                      marginBottom: 16,
                      color: editarMsg.type === 'error' ? '#B91C1C' : '#166534',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {editarMsg.text}
                  </div>
                )}

                <label htmlFor="edit-clientName" style={labelStyle}>
                  Nombre del cliente
                </label>
                <input
                  id="edit-clientName"
                  type="text"
                  className="cw-input"
                  style={inputStyle}
                  value={editarData.clientName || ''}
                  onChange={e => setEditarData({ ...editarData, clientName: e.target.value })}
                />

                <label htmlFor="edit-clientDni" style={labelStyle}>
                  DNI del cliente
                </label>
                <input
                  id="edit-clientDni"
                  type="text"
                  className="cw-input"
                  style={inputStyle}
                  value={editarData.clientDni || ''}
                  onChange={e => setEditarData({ ...editarData, clientDni: e.target.value })}
                />

                <label htmlFor="edit-clientPhone" style={labelStyle}>
                  Teléfono
                </label>
                <input
                  id="edit-clientPhone"
                  type="tel"
                  className="cw-input"
                  style={inputStyle}
                  value={editarData.clientPhone || ''}
                  onChange={e => setEditarData({ ...editarData, clientPhone: e.target.value })}
                />

                <label htmlFor="edit-productModelName" style={labelStyle}>
                  Modelo del producto
                </label>
                <input
                  id="edit-productModelName"
                  type="text"
                  className="cw-input"
                  style={inputStyle}
                  value={editarData.productModelName || ''}
                  onChange={e => setEditarData({ ...editarData, productModelName: e.target.value })}
                />

                <label htmlFor="edit-price" style={labelStyle}>
                  Precio ($)
                </label>
                <input
                  id="edit-price"
                  type="number"
                  className="cw-input"
                  style={inputStyle}
                  value={editarData.price || ''}
                  onChange={e => setEditarData({ ...editarData, price: parseInt(e.target.value) || 0 })}
                />

                <label htmlFor="edit-expectedDeliveryStart" style={labelStyle}>
                  Entrega esperada desde
                </label>
                <input
                  id="edit-expectedDeliveryStart"
                  type="date"
                  className="cw-input"
                  style={inputStyle}
                  value={editarData.expectedDeliveryStart || ''}
                  onChange={e => setEditarData({ ...editarData, expectedDeliveryStart: e.target.value })}
                />

                <label htmlFor="edit-expectedDeliveryEnd" style={labelStyle}>
                  Entrega esperada hasta
                </label>
                <input
                  id="edit-expectedDeliveryEnd"
                  type="date"
                  className="cw-input"
                  style={inputStyle}
                  value={editarData.expectedDeliveryEnd || ''}
                  onChange={e => setEditarData({ ...editarData, expectedDeliveryEnd: e.target.value })}
                />

                <label htmlFor="edit-notes" style={labelStyle}>
                  Notas
                </label>
                <textarea
                  id="edit-notes"
                  className="cw-input"
                  style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
                  value={editarData.notes || ''}
                  onChange={e => setEditarData({ ...editarData, notes: e.target.value })}
                />

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    className="cw-btn cw-back"
                    onClick={() => setEditarOpen(false)}
                    disabled={editarSending}
                    style={{
                      padding: '12px 20px',
                      border: '1.5px solid #E6E7F0',
                      borderRadius: 10,
                      background: '#fff',
                      color: '#3D4356',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="cw-btn cw-primary"
                    onClick={guardarEdicion}
                    disabled={editarSending}
                    style={{
                      flex: 1,
                      background: editarSending ? '#FFB48C' : 'linear-gradient(135deg,#FF6B2C,#FF8A50)',
                      color: '#fff',
                      padding: 12,
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: editarSending ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    {editarSending ? (
                      <>
                        <span
                          className="material-symbols-outlined cw-spin"
                          style={{ fontSize: 18 }}
                          aria-hidden="true"
                        >
                          progress_activity
                        </span>
                        Guardando…
                      </>
                    ) : (
                      <>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 18 }}
                          aria-hidden="true"
                        >
                          save
                        </span>
                        Guardar cambios
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

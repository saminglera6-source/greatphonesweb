'use client'

import { useEffect, useRef, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'
import { fetchDolar } from '@/app/admin/precios/dolar'

const OPERADORES = ['Martin', 'Maca', 'Sam', 'Eva', 'Buda']
const TOTAL = 5
const STEPS = ['Operación', 'Pedido', 'Entrega', 'Precio y cobro', 'Confirmar']

const MODELOS_IPHONE = [
  'iPhone 8', 'iPhone 8 Plus',
  'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
  'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
  'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
  'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
  'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
  'iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max',
]

interface PrecioRow {
  id: string
  modelo: string
  almacenamiento: string
  preventaARS: number
  active: boolean
}

function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}

function enDias(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const HOY_ISO = new Date().toISOString().split('T')[0]

interface PlazoInfo {
  minDias: number
  maxDias: number
  fechaDesde: string
  fechaHasta: string
  feriados: { date: string; label: string | null }[]
}

function esNoHabil(iso: string, feriados: Set<string>) {
  if (!iso) return false
  const d = new Date(iso + 'T12:00:00')
  const g = d.getDay()
  return g === 0 || g === 6 || feriados.has(iso)
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

export default function PreventasClient() {
  const [operador, setOperador] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [modelo, setModelo] = useState('')
  const [cliente, setCliente] = useState('')
  const [cuil, setCuil] = useState('')
  const [tel, setTel] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [efec, setEfec] = useState('')
  const [transf, setTransf] = useState('')
  const [cuotas, setCuotas] = useState('')
  const [usd, setUsd] = useState('')
  const [dolarCompra, setDolarCompra] = useState(1000)
  const [fechaDesde, setFechaDesde] = useState(() => enDias(7))
  const [fechaHasta, setFechaHasta] = useState(() => enDias(10))
  const [plazo, setPlazo] = useState<PlazoInfo | null>(null)
  const feriadosSet = new Set((plazo?.feriados || []).map(f => f.date))
  // Config del plazo de entrega y feriados
  const [cfgMin, setCfgMin] = useState('7')
  const [cfgMax, setCfgMax] = useState('10')
  const [cfgFerFecha, setCfgFerFecha] = useState('')
  const [cfgFerLabel, setCfgFerLabel] = useState('')
  const [cfgMsg, setCfgMsg] = useState<string | null>(null)

  const aplicarConfig = (d: {
    plazo: { minDias: number; maxDias: number }
    rango: { fechaDesde: string; fechaHasta: string }
    feriados?: { date: string; label: string | null }[]
  }) => {
    setPlazo({
      minDias: d.plazo.minDias,
      maxDias: d.plazo.maxDias,
      fechaDesde: d.rango.fechaDesde,
      fechaHasta: d.rango.fechaHasta,
      feriados: d.feriados || [],
    })
    setCfgMin(String(d.plazo.minDias))
    setCfgMax(String(d.plazo.maxDias))
  }

  const recargarConfig = async () => {
    const r = await fetch('/api/admin/preventas-config', { credentials: 'include' })
    if (!r.ok) return
    aplicarConfig(await r.json())
  }
  const [obs, setObs] = useState('')
  const [modeloEsOtro, setModeloEsOtro] = useState(false)
  const [storageSel, setStorageSel] = useState('')
  const [precios, setPrecios] = useState<PrecioRow[]>([])
  const [precioAuto, setPrecioAuto] = useState(false)

  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<{ numero: string } | null>(null)
  const errRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activo = true
    fetch('/api/admin/precios', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('precios')
        return r.json()
      })
      .then(d => {
        if (!activo) return
        setPrecios(Array.isArray(d) ? d.filter((p: PrecioRow) => p.active) : [])
      })
      .catch(() => {
        if (activo) setServerMsg('No se pudo cargar la lista de precios. Recargá la página.')
      })
    fetchDolar().then(d => {
      if (activo && d?.compra) setDolarCompra(d.compra)
    })
    fetch('/api/admin/preventas-config', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!activo || !d?.rango) return
        aplicarConfig(d)
        setFechaDesde(d.rango.fechaDesde)
        setFechaHasta(d.rango.fechaHasta)
      })
      .catch(() => {})
    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Variantes de almacenamiento con precio configurado para el modelo elegido
  const variantesModelo = precios.filter(
    p => p.modelo.trim().toLowerCase() === modelo.trim().toLowerCase(),
  )

  // Al elegir modelo del select: si hay una sola variante, autocompletar precio
  // directo; si hay varias, esperar a que se elija el almacenamiento.
  useEffect(() => {
    if (modeloEsOtro || !modelo) return
    setStorageSel('')
    if (variantesModelo.length === 1) {
      setPrecioVenta(String(variantesModelo[0].preventaARS || ''))
      setPrecioAuto(true)
    } else if (variantesModelo.length === 0) {
      setPrecioAuto(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelo, modeloEsOtro])

  // Al elegir el almacenamiento (cuando hay varias variantes): tomar el precio de esa variante
  useEffect(() => {
    if (!storageSel) return
    const v = variantesModelo.find(
      p => p.almacenamiento.trim().toLowerCase() === storageSel.trim().toLowerCase(),
    )
    if (v) {
      setPrecioVenta(String(v.preventaARS || ''))
      setPrecioAuto(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageSel])

  const tot =
    (parseInt(efec) || 0) +
    (parseInt(transf) || 0) +
    (parseInt(cuotas) || 0) +
    Math.round((parseInt(usd) || 0) * dolarCompra)

  const validarPaso = (p: number): Record<string, string> => {
    const e: Record<string, string> = {}
    if (p === 1 && !operador) e.operador = 'Seleccioná el operador'
    if (p === 2 && !modelo.trim()) e.modelo = 'Ingresá el modelo solicitado'
    if (p === 2 && !cliente.trim()) e.cliente = 'Ingresá el nombre del cliente'
    if (p === 4) {
      if (!precioVenta || +precioVenta <= 0) e.precioVenta = 'El precio pactado debe ser mayor a 0'
      else if (tot <= 0) e.cobros = 'Debe registrarse al menos un cobro'
    }
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

  const modeloFinal = !modeloEsOtro && storageSel ? `${modelo} ${storageSel}` : modelo

  const resetear = () => {
    setModelo('')
    setModeloEsOtro(false)
    setStorageSel('')
    setPrecioAuto(false)
    setCliente('')
    setCuil('')
    setTel('')
    setPrecioVenta('')
    setEfec('')
    setTransf('')
    setCuotas('')
    setUsd('')
    setObs('')
    setFecha(new Date().toISOString().split('T')[0])
    setFechaDesde(plazo?.fechaDesde || enDias(7))
    setFechaHasta(plazo?.fechaHasta || enDias(10))
    setStep(1)
    setMaxStep(1)
    setErrors({})
    setServerMsg(null)
    setDone(null)
  }

  const guardarPlazo = async () => {
    setCfgMsg(null)
    const r = await fetch('/api/admin/preventas-config', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minDias: parseInt(cfgMin) || 0, maxDias: parseInt(cfgMax) || 0 }),
    })
    const d = await r.json()
    if (!r.ok) return setCfgMsg(d.error || 'No se pudo guardar')
    setCfgMsg('Ventana de plazo guardada')
    await recargarConfig()
  }

  const agregarFeriado = async () => {
    setCfgMsg(null)
    if (!cfgFerFecha) return setCfgMsg('Elegí una fecha')
    const r = await fetch('/api/admin/preventas-config', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: cfgFerFecha, label: cfgFerLabel.trim() || undefined }),
    })
    const d = await r.json()
    if (!r.ok) return setCfgMsg(d.error || 'No se pudo agregar')
    setCfgFerFecha('')
    setCfgFerLabel('')
    await recargarConfig()
  }

  const borrarFeriado = async (date: string) => {
    await fetch(`/api/admin/preventas-config?date=${date}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await recargarConfig()
  }

  const enviar = async () => {
    const todos = { ...validarPaso(1), ...validarPaso(2), ...validarPaso(4) }
    if (Object.keys(todos).length > 0) {
      setErrors(todos)
      const primero = Object.keys(todos)[0]
      const pasoDelError =
        primero === 'modelo' || primero === 'cliente'
          ? 2
          : primero.startsWith('precio') || primero === 'cobros'
            ? 4
            : 1
      setStep(pasoDelError)
      requestAnimationFrame(() => {
        errRef.current?.focus({ preventScroll: true })
        errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return
    }
    setSending(true)
    setServerMsg(null)
    try {
      const r = await fetch('/api/admin/ops/preventas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          modelo: modeloFinal,
          cliente,
          cuil,
          tel,
          precioVenta: +precioVenta,
          efectivo: parseInt(efec) || 0,
          transferencia: parseInt(transf) || 0,
          cuotas: parseInt(cuotas) || 0,
          usd: parseInt(usd) || 0,
          fechaDesde,
          fechaHasta,
          obs,
          operador,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setServerMsg(d.error || 'Error al registrar la preventa')
        return
      }
      setDone({ numero: d.numero })
    } catch {
      setServerMsg('Error de conexión. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const fieldProps = (id: string) => ({
    id,
    style: { ...inputStyle, ...(errors[id] ? inputErrorStyle : {}) },
    'aria-invalid': errors[id] ? true : undefined,
    'aria-describedby': errors[id] ? `${id}-error` : undefined,
  })

  if (done) {
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
            Preventa registrada
          </h2>
          <p style={{ fontSize: 13.5, color: '#6B7280', margin: 0 }}>
            Operación <strong style={{ color: '#181B2E' }}>{done.numero}</strong> · Entrega
            prometida:{' '}
            <strong style={{ color: '#181B2E' }}>
              {new Date(fechaDesde + 'T12:00:00').toLocaleDateString('es-AR')} –{' '}
              {new Date(fechaHasta + 'T12:00:00').toLocaleDateString('es-AR')}
            </strong>
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
            Registrar otra preventa
          </button>
        </div>
      </div>
    )
  }

  const resumen: [string, string][] = [
    ['Operador', operador || '—'],
    ['Fecha', fecha],
    ['Modelo solicitado', modeloFinal || '—'],
    ['Cliente', cliente || '—'],
    ['Contacto', [tel, cuil].filter(Boolean).join(' · ') || '—'],
    [
      'Entrega prometida',
      `${new Date(fechaDesde + 'T12:00:00').toLocaleDateString('es-AR')} – ${new Date(fechaHasta + 'T12:00:00').toLocaleDateString('es-AR')}`,
    ],
    ['Precio pactado', fmt(+precioVenta || 0)],
    [
      'Cobro',
      [
        efec ? `Efectivo ${fmt(+efec)}` : '',
        transf ? `Transf. ${fmt(+transf)}` : '',
        cuotas ? `Cuotas ${fmt(+cuotas)}` : '',
        usd ? `${usd} USD` : '',
      ]
        .filter(Boolean)
        .join(' · ') || '—',
    ],
  ]

  return (
    <>
      <AdminTopbar titulo="Registrar Preventa" />
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <style>{`
        .cw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cw-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
        @media (max-width: 640px) {
          .cw-grid { grid-template-columns: 1fr; }
          .cw-grid-4 { grid-template-columns: repeat(2,1fr); }
          .cw-steplabel { display: none; }
        }
        @media (max-width: 420px){ .cw-grid-4{ grid-template-columns: 1fr; } }
        .cw-input:focus { border-color: #FF6B2C !important; outline: none; }
        .cw-btn:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 2px; }
        .cw-primary:not(:disabled):hover { filter: brightness(.94); }
        .cw-back:not(:disabled):hover { background: #F4F6F9; }
        .cw-dot-btn:focus-visible { outline: 2px solid #FF6B2C; outline-offset: 2px; }
        .cw-spin { animation: cws 1s linear infinite; }
        @keyframes cws { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .cw-spin { animation: none !important; }
          .cw-bar, .cw-dot-btn, .cw-btn { transition: none !important; }
        }
      `}</style>

        <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 12px' }}>
          Reserva sin stock: cobro anticipado y entrega futura
        </p>

        <details
          style={{
            border: '1px solid #E6E7F0',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 18,
            background: '#FBFBFD',
          }}
        >
          <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#3D4356' }}>
            Configurar plazo de entrega y feriados
          </summary>
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 8px' }}>
              Ventana sugerida de entrega, en días hábiles desde la fecha de la preventa.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>Mín. días hábiles</label>
                <input
                  type="number"
                  min={0}
                  style={{ ...inputStyle, width: 90 }}
                  value={cfgMin}
                  onChange={e => setCfgMin(e.target.value)}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>Máx. días hábiles</label>
                <input
                  type="number"
                  min={0}
                  style={{ ...inputStyle, width: 90 }}
                  value={cfgMax}
                  onChange={e => setCfgMax(e.target.value)}
                />
              </div>
              <button type="button" className="cw-btn" onClick={guardarPlazo} style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid #E6E7F0', background: '#fff', fontSize: 12.5, cursor: 'pointer' }}>
                Guardar ventana
              </button>
            </div>

            <p style={{ fontSize: 12, color: '#6B7280', margin: '16px 0 8px' }}>Feriados</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>Fecha</label>
                <input type="date" style={{ ...inputStyle, width: 160 }} value={cfgFerFecha} onChange={e => setCfgFerFecha(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Descripción (opcional)</label>
                <input style={inputStyle} value={cfgFerLabel} onChange={e => setCfgFerLabel(e.target.value)} placeholder="Ej: Día de la Independencia" />
              </div>
              <button type="button" className="cw-btn" onClick={agregarFeriado} style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid #E6E7F0', background: '#fff', fontSize: 12.5, cursor: 'pointer' }}>
                Agregar
              </button>
            </div>
            {(plazo?.feriados || []).length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
                {plazo!.feriados.map(f => (
                  <li
                    key={f.date}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid #EFF1F6' }}
                  >
                    <span>
                      {new Date(f.date + 'T12:00:00').toLocaleDateString('es-AR')}
                      {f.label ? ` · ${f.label}` : ''}
                    </span>
                    <button type="button" onClick={() => borrarFeriado(f.date)} style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', fontSize: 12 }}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {cfgMsg && <p style={{ fontSize: 12, color: '#166534', margin: '8px 0 0' }}>{cfgMsg}</p>}
          </div>
        </details>

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
                ¿Quién toma el pedido?
              </legend>
              <div style={{ marginTop: 12 }}>
                <label htmlFor="operador" style={{ ...labelStyle, marginTop: 0 }}>
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
              </div>

              <label htmlFor="fecha" style={labelStyle}>
                Fecha preventa
              </label>
              <input
                type="date"
                {...fieldProps('fecha')}
                className="cw-input"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
              />
            </fieldset>
          )}

          {step === 2 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                ¿Qué pidió el cliente?
              </legend>
              {modeloEsOtro ? (
                <>
                  <label htmlFor="modelo" style={{ ...labelStyle, marginTop: 12 }}>
                    Modelo solicitado *
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <input
                      {...fieldProps('modelo')}
                      className="cw-input"
                      value={modelo}
                      onChange={e => {
                        setModelo(e.target.value)
                        limpiarError('modelo')
                      }}
                      onBlur={() => validarEnBlur('modelo')}
                      placeholder="Ej: Samsung Galaxy S24, Motorola Edge..."
                      autoComplete="off"
                      style={{ ...inputStyle, ...(errors.modelo ? inputErrorStyle : {}), flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setModeloEsOtro(false)
                        setModelo('')
                        setStorageSel('')
                        setPrecioAuto(false)
                        limpiarError('modelo')
                      }}
                      className="cw-btn"
                      style={{
                        flexShrink: 0,
                        padding: '10px 12px',
                        border: '1.5px solid #E6E7F0',
                        borderRadius: 9,
                        background: '#fff',
                        color: '#64748B',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Ver iPhones
                    </button>
                  </div>
                  {errors.modelo && (
                    <p
                      id="modelo-error"
                      style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                    >
                      {errors.modelo}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <label htmlFor="modelo" style={{ ...labelStyle, marginTop: 12 }}>
                    Modelo solicitado *
                  </label>
                  <select
                    {...fieldProps('modelo')}
                    className="cw-input"
                    value={modelo}
                    onChange={e => {
                      if (e.target.value === '__otro__') {
                        setModeloEsOtro(true)
                        setModelo('')
                        setStorageSel('')
                        limpiarError('modelo')
                      } else {
                        setModelo(e.target.value)
                        limpiarError('modelo')
                      }
                    }}
                    onBlur={() => validarEnBlur('modelo')}
                  >
                    <option value="" disabled>
                      Seleccionar iPhone...
                    </option>
                    {MODELOS_IPHONE.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__otro__">Otro / Escribir manualmente…</option>
                  </select>
                  {errors.modelo && (
                    <p
                      id="modelo-error"
                      style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                    >
                      {errors.modelo}
                    </p>
                  )}

                  {modelo && variantesModelo.length > 1 && (
                    <>
                      <label htmlFor="storageSel" style={{ ...labelStyle, marginTop: 10 }}>
                        Almacenamiento
                      </label>
                      <select
                        id="storageSel"
                        className="cw-input"
                        style={inputStyle}
                        value={storageSel}
                        onChange={e => setStorageSel(e.target.value)}
                      >
                        <option value="" disabled>
                          Seleccionar almacenamiento...
                        </option>
                        {variantesModelo.map(v => (
                          <option key={v.id} value={v.almacenamiento}>
                            {v.almacenamiento}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {modelo && variantesModelo.length === 0 && (
                    <p style={{ fontSize: 11, color: '#B7950B', margin: '5px 0 0' }}>
                      Sin precio configurado para este modelo en Lista de Precios. Ingresá el
                      precio manualmente en el paso siguiente.
                    </p>
                  )}
                </>
              )}

              <label htmlFor="cliente" style={labelStyle}>
                Cliente *
              </label>
              <input
                {...fieldProps('cliente')}
                className="cw-input"
                value={cliente}
                onChange={e => {
                  setCliente(e.target.value)
                  limpiarError('cliente')
                }}
                onBlur={() => validarEnBlur('cliente')}
                placeholder="Nombre y apellido"
                autoComplete="off"
              />
              {errors.cliente && (
                <p id="cliente-error" style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}>
                  {errors.cliente}
                </p>
              )}

              <div className="cw-grid" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="cuil" style={{ ...labelStyle, marginTop: 0 }}>
                    CUIL
                  </label>
                  <input
                    id="cuil"
                    className="cw-input"
                    style={inputStyle}
                    value={cuil}
                    onChange={e => setCuil(e.target.value)}
                    placeholder="20-12345678-9"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label htmlFor="tel" style={{ ...labelStyle, marginTop: 0 }}>
                    Teléfono
                  </label>
                  <input
                    id="tel"
                    className="cw-input"
                    style={inputStyle}
                    value={tel}
                    onChange={e => setTel(e.target.value)}
                    placeholder="11 2345 6789"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Plazo de entrega
              </legend>
              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  color: '#1D4ED8',
                  background: '#EEF3FE',
                  border: '1px solid #DBEAFE',
                  borderRadius: 8,
                  padding: '9px 12px',
                  marginTop: 12,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 16 }}
                  aria-hidden="true"
                >
                  schedule
                </span>
                {plazo
                  ? `Sugerido: ${plazo.minDias} a ${plazo.maxDias} días hábiles (saltea fines de semana y feriados). Ajustalo si el cliente pide otra fecha.`
                  : 'Por defecto 7 a 10 días hábiles desde hoy. Ajustalo si el cliente pide otra fecha.'}
              </p>
              <div className="cw-grid" style={{ marginTop: 4 }}>
                <div>
                  <label htmlFor="fechaDesde" style={{ ...labelStyle, marginTop: 0 }}>
                    Prometida desde
                  </label>
                  <input
                    type="date"
                    min={HOY_ISO}
                    {...fieldProps('fechaDesde')}
                    className="cw-input"
                    value={fechaDesde}
                    onChange={e => setFechaDesde(e.target.value)}
                  />
                  {esNoHabil(fechaDesde, feriadosSet) && (
                    <p style={{ fontSize: 11.5, color: '#B45309', margin: '4px 0 0' }}>
                      Cae en {feriadosSet.has(fechaDesde) ? 'un feriado' : 'fin de semana'} — no es día hábil.
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="fechaHasta" style={{ ...labelStyle, marginTop: 0 }}>
                    Prometida hasta
                  </label>
                  <input
                    type="date"
                    min={fechaDesde || HOY_ISO}
                    {...fieldProps('fechaHasta')}
                    className="cw-input"
                    value={fechaHasta}
                    onChange={e => setFechaHasta(e.target.value)}
                  />
                  {esNoHabil(fechaHasta, feriadosSet) && (
                    <p style={{ fontSize: 11.5, color: '#B45309', margin: '4px 0 0' }}>
                      Cae en {feriadosSet.has(fechaHasta) ? 'un feriado' : 'fin de semana'} — no es día hábil.
                    </p>
                  )}
                </div>
              </div>
              {plazo && plazo.feriados.length > 0 && (
                <p style={{ fontSize: 11.5, color: '#64748B', margin: '8px 0 0' }}>
                  Próximos feriados cargados:{' '}
                  {plazo.feriados
                    .filter(f => f.date >= HOY_ISO)
                    .slice(0, 4)
                    .map(f => new Date(f.date + 'T12:00:00').toLocaleDateString('es-AR'))
                    .join(' · ') || '—'}
                </p>
              )}
            </fieldset>
          )}

          {step === 4 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Precio y cobro anticipado
              </legend>
              <label
                htmlFor="precioVenta"
                style={{
                  ...labelStyle,
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Precio de venta pactado ($) *
                {precioAuto && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 99,
                      background: '#D5F5E3',
                      color: '#186A3B',
                    }}
                  >
                    desde Lista de Precios
                  </span>
                )}
              </label>
              <input
                type="number"
                min={0}
                {...fieldProps('precioVenta')}
                className="cw-input"
                value={precioVenta}
                onChange={e => {
                  setPrecioVenta(e.target.value)
                  setPrecioAuto(false)
                  limpiarError('precioVenta')
                }}
                onBlur={() => validarEnBlur('precioVenta')}
                placeholder="0"
              />
              {errors.precioVenta && (
                <p
                  id="precioVenta-error"
                  style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                >
                  {errors.precioVenta}
                </p>
              )}

              <label style={{ ...labelStyle, marginBottom: 2 }} id="lbl-cobros">
                Cobrado en ($)
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
                  background: tot > 0 ? '#D5F5E3' : '#FDEBD0',
                  border: `1px solid ${tot > 0 ? '#ABEBC6' : '#FAD7A0'}`,
                  padding: '12px 14px',
                  borderRadius: 10,
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#186A3B' }}>
                  Total cobrado
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#186A3B' }}>
                  {fmt(tot)}
                  {parseInt(usd) ? (
                    <span style={{ fontSize: 11, fontWeight: 600 }}> (incluye {usd} USD)</span>
                  ) : null}
                </span>
              </div>
              {errors.cobros && (
                <p
                  id="cobros-error"
                  style={{ fontSize: 12, color: '#DC2626', margin: '8px 0 0', fontWeight: 600 }}
                >
                  {errors.cobros}
                </p>
              )}
            </fieldset>
          )}

          {step === 5 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Observaciones y confirmación
              </legend>
              <label htmlFor="obs" style={{ ...labelStyle, marginTop: 12 }}>
                Observaciones
              </label>
              <textarea
                {...fieldProps('obs')}
                className="cw-input"
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Detalles del acuerdo con el cliente"
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
                  Registrar preventa
                </>
              )}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', margin: '12px 0 0' }}>
            Podés volver a los pasos anteriores con el menú superior para corregir cualquier dato.
          </p>
        </form>
      </div>
    </>
  )
}

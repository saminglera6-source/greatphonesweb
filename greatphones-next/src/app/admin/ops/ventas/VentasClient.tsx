'use client'

import { useEffect, useRef, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'
import { fetchDolar } from '@/app/admin/precios/dolar'

interface Producto {
  id: string
  name: string
  brand: string
  sub: string | null
  storage: string | null
  color: string | null
  condition: string
  price: number
  cost: number
  stock: number
  reserved: number
  battery?: number | null
  inventoryItems?: {
    id: string
    imei: string
    purchasePrice: number
    batteryHealth?: number | null
    cosmeticCondition?: string | null
  }[]
}

const OPERADORES = ['Martin', 'Maca', 'Sam', 'Eva', 'Buda']
const TOTAL = 5
const STEPS = ['Vendedor y equipo', 'Cliente', 'Accesorios', 'Precio y cobro', 'Confirmar']

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

export default function VentasClient() {
  const [equipos, setEquipos] = useState<Producto[]>([])
  const [opEquipo, setOpEquipo] = useState('')
  const [unidadSel, setUnidadSel] = useState('') // inventoryItemId concreto (opcional)
  const [catAcc, setCatAcc] = useState<
    { id: string; name: string; price: number; stock: number; reserved: number }[]
  >([])
  const [accSel, setAccSel] = useState('')
  const [operador, setOperador] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [cliente, setCliente] = useState('')
  const [cuil, setCuil] = useState('')
  const [tel, setTel] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [efec, setEfec] = useState('')
  const [transf, setTransf] = useState('')
  const [cuotas, setCuotas] = useState('')
  const [usd, setUsd] = useState('')
  const [dolarCompra, setDolarCompra] = useState(1000)
  const [accesorios, setAccesorios] = useState([{ nombre: '', precio: '' }])
  const [regalos, setRegalos] = useState(true)
  const [obs, setObs] = useState('')

  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<{ numero: string; gananciaTeorica: number } | null>(null)
  const errRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activo = true
    fetch('/api/admin/ops/ventas', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('equipos')
        return r.json()
      })
      .then(d => {
        if (activo) setEquipos(Array.isArray(d) ? d : [])
      })
      .catch(() => {
        if (activo) setServerMsg('No se pudo cargar el listado de equipos. Recargá la página.')
      })
    fetch('/api/accessories?limit=500', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('accesorios')
        return r.json()
      })
      .then(d => {
        if (!activo) return
        const data = Array.isArray(d?.data) ? d.data : []
        setCatAcc(
          data
            .filter(
              (a: { isActive?: boolean; stock?: number; reserved?: number }) =>
                a.isActive !== false && (a.stock || 0) - (a.reserved || 0) > 0,
            )
            .map(
              (a: {
                id: string
                name: string
                price: number
                stock: number
                reserved: number
              }) => ({
                id: a.id,
                name: a.name,
                price: a.price,
                stock: a.stock || 0,
                reserved: a.reserved || 0,
              }),
            ),
        )
      })
      .catch(() => {
        if (activo) setServerMsg('No se pudo cargar el listado de accesorios. Recargá la página.')
      })
    fetchDolar().then(d => {
      if (activo && d?.compra) setDolarCompra(d.compra)
    })
    return () => {
      activo = false
    }
  }, [])

  const recargarEquipos = () => {
    fetch('/api/admin/ops/ventas', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('equipos')
        return r.json()
      })
      .then(d => setEquipos(Array.isArray(d) ? d : []))
      .catch(() => setServerMsg('No se pudo actualizar el listado de equipos.'))
  }

  const totalAcc = accesorios.reduce((s, a) => s + (parseInt(a.precio) || 0), 0)
  const precio = parseInt(precioVenta) || 0
  const totalOperacion = precio + totalAcc
  const usdPesos = Math.round((parseInt(usd) || 0) * dolarCompra)
  const totalCobrado =
    (parseInt(efec) || 0) + (parseInt(transf) || 0) + (parseInt(cuotas) || 0) + usdPesos
  const diferencia = totalCobrado - totalOperacion
  const equipoSel = equipos.find(e => e.id === opEquipo)

  const seleccionarEquipo = (id: string) => {
    setOpEquipo(id)
    setUnidadSel('')
    limpiarError('opEquipo')
    const p = equipos.find(x => x.id === id)
    if (p?.price) setPrecioVenta(String(p.price))
  }
  const unidades = equipoSel?.inventoryItems || []

  const agregarAccesorioCatalogo = () => {
    const acc = catAcc.find(a => a.id === accSel)
    if (!acc) return
    setAccesorios(prev => [
      ...prev.filter(a => a.nombre || a.precio),
      { nombre: acc.name, precio: String(acc.price) },
    ])
    setAccSel('')
  }

  const validarPaso = (p: number): Record<string, string> => {
    const e: Record<string, string> = {}
    if (p === 1 && !operador) e.operador = 'Seleccioná el operador'
    if (p === 1 && !opEquipo)
      e.opEquipo =
        equipos.length === 0
          ? 'No hay equipos en stock disponibles'
          : 'Seleccioná el equipo a vender'
    if (p === 2 && !cliente.trim()) e.cliente = 'Ingresá el nombre del cliente'
    if (p === 4) {
      if (precio <= 0) e.precioVenta = 'El precio de venta debe ser mayor a 0'
      else if (Math.abs(diferencia) > 1)
        e.cobros =
          diferencia > 0
            ? `El total cobrado (${fmt(totalCobrado)}) supera el total operación (${fmt(totalOperacion)})`
            : `Faltan cubrir ${fmt(-diferencia)} para llegar al total operación (${fmt(totalOperacion)})`
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

  const resetear = () => {
    setOpEquipo('')
    setUnidadSel('')
    setPrecioVenta('')
    setCliente('')
    setCuil('')
    setTel('')
    setEfec('')
    setTransf('')
    setCuotas('')
    setUsd('')
    setObs('')
    setAccesorios([{ nombre: '', precio: '' }])
    setAccSel('')
    setRegalos(true)
    setVendedor('')
    setFecha(new Date().toISOString().split('T')[0])
    setStep(1)
    setMaxStep(1)
    setErrors({})
    setServerMsg(null)
    setDone(null)
  }

  const enviar = async () => {
    const todos = { ...validarPaso(1), ...validarPaso(2), ...validarPaso(4) }
    if (Object.keys(todos).length > 0) {
      setErrors(todos)
      const primero = Object.keys(todos)[0]
      const pasoDelError =
        primero === 'operador' || primero === 'opEquipo' ? 1 : primero === 'cliente' ? 2 : 4
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
      const r = await fetch('/api/admin/ops/ventas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: opEquipo,
          inventoryItemId: unidadSel || undefined,
          fecha,
          precioVenta: precio,
          cliente,
          cuil,
          tel,
          vendedor,
          efectivo: parseInt(efec) || 0,
          transferencia: parseInt(transf) || 0,
          cuotas: parseInt(cuotas) || 0,
          usd: parseInt(usd) || 0,
          accesorios: accesorios
            .filter(a => a.nombre)
            .map(a => ({ nombre: a.nombre, precio: parseInt(a.precio) || 0 })),
          entregarRegalos: regalos,
          obs,
          operador,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setServerMsg(d.error || 'Error al registrar la venta')
        return
      }
      setDone({ numero: d.numero, gananciaTeorica: d.gananciaTeorica })
      recargarEquipos()
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
            Venta registrada
          </h2>
          <p style={{ fontSize: 13.5, color: '#6B7280', margin: 0 }}>
            Operación <strong style={{ color: '#181B2E' }}>{done.numero}</strong>
          </p>
          <p style={{ fontSize: 13.5, color: '#6B7280', margin: '4px 0 0' }}>
            Ganancia teórica:{' '}
            <strong style={{ color: '#0F9D58' }}>{fmt(done.gananciaTeorica)}</strong>
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
            Registrar otra venta
          </button>
        </div>
      </div>
    )
  }

  const resumen: [string, string][] = [
    ['Operador', operador || '—'],
    ['Vendedor', vendedor || '—'],
    ['Fecha', fecha],
    [
      'Equipo',
      equipoSel
        ? `${equipoSel.brand} ${equipoSel.name}${equipoSel.sub ? ' ' + equipoSel.sub : ''}${equipoSel.storage ? ' · ' + equipoSel.storage : ''}`
        : '—',
    ],
    ['Cliente', cliente || '—'],
    ['Contacto', [tel, cuil].filter(Boolean).join(' · ') || '—'],
    ['Precio equipo', fmt(precio)],
    [
      'Accesorios',
      totalAcc > 0 ? `${accesorios.filter(a => a.nombre).length} (${fmt(totalAcc)})` : '—',
    ],
    ['TOTAL OPERACIÓN', fmt(totalOperacion)],
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
    ['Regalos', regalos ? 'Entregar' : 'No entregar'],
  ]

  return (
    <>
      <AdminTopbar titulo="Registrar Venta" />
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <style>{`
        .cw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cw-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
        .cw-acc-grid { display: grid; grid-template-columns: 2fr 1fr auto; gap: 8px; align-items: start; }
        @media (max-width: 640px) {
          .cw-grid { grid-template-columns: 1fr; }
          .cw-grid-4 { grid-template-columns: repeat(2,1fr); }
          .cw-steplabel { display: none; }
        }
        @media (max-width: 420px) {
          .cw-grid-4 { grid-template-columns: 1fr; }
          .cw-acc-grid { grid-template-columns: 1fr; }
          .cw-acc-grid button{ width: 100%; height: 41px; margin-top: 0 !important; }
          .cw-cat-grid{ grid-template-columns: 1fr !important; }
        }
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

        <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 18px' }}>
          Venta de equipo desde stock
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
                ¿Quién vende y qué equipo?
              </legend>
              <label htmlFor="operador" style={labelStyle}>
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

              <label htmlFor="vendedor" style={labelStyle}>
                Vendedor
              </label>
              <input
                {...fieldProps('vendedor')}
                className="cw-input"
                value={vendedor}
                onChange={e => setVendedor(e.target.value)}
                placeholder="Quién atendió (si no es el operador)"
                autoComplete="off"
              />

              <label htmlFor="opEquipo" style={labelStyle}>
                Equipo a vender (stock real) *
              </label>
              <select
                {...fieldProps('opEquipo')}
                className="cw-input"
                value={opEquipo}
                onChange={e => seleccionarEquipo(e.target.value)}
                onBlur={() => validarEnBlur('opEquipo')}
              >
                <option value="">Seleccionar producto...</option>
                {equipos.map(p => {
                  const disp = p.stock - p.reserved
                  return (
                    <option key={p.id} value={p.id} disabled={disp < 1}>
                      {p.brand} {p.name}
                      {p.sub ? ' ' + p.sub : ''}
                      {p.storage ? ' · ' + p.storage : ''}
                      {p.color ? ' · ' + p.color : ''} (
                      {disp === 1 ? '1 disponible' : `${disp} disponibles`})
                    </option>
                  )
                })}
              </select>
              {errors.opEquipo && (
                <p
                  id="opEquipo-error"
                  style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                >
                  {errors.opEquipo}
                </p>
              )}
              {equipoSel && (
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#0F766E',
                    background: '#F0FDFA',
                    border: '1px solid #CCFBF1',
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
                    smartphone
                  </span>
                  {equipoSel.condition}
                  {equipoSel.battery != null && equipoSel.battery > 0
                    ? ` · Batería ${equipoSel.battery}%`
                    : ''}{' '}
                  · Precio sugerido: {fmt(equipoSel.price)}
                </p>
              )}

              {unidades.length > 0 && (
                <>
                  <label htmlFor="unidadSel" style={labelStyle}>
                    Unidad (IMEI) — {unidades.length} en stock
                  </label>
                  <select
                    id="unidadSel"
                    className="cw-input"
                    value={unidadSel}
                    onChange={e => setUnidadSel(e.target.value)}
                  >
                    <option value="">Automática (la más antigua)</option>
                    {unidades.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.imei} · costo {fmt(u.purchasePrice)}
                        {u.batteryHealth ? ` · bat ${u.batteryHealth}%` : ''}
                        {u.cosmeticCondition ? ` · ${u.cosmeticCondition}` : ''}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label htmlFor="fecha" style={labelStyle}>
                Fecha venta
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
                Datos del cliente
              </legend>
              <label htmlFor="cliente" style={{ ...labelStyle, marginTop: 12 }}>
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
                    {...fieldProps('cuil')}
                    className="cw-input"
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
                    {...fieldProps('tel')}
                    className="cw-input"
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

          {step === 4 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Precio y cobro
              </legend>
              <label htmlFor="precioVenta" style={{ ...labelStyle, marginTop: 12 }}>
                Precio del celular ($) *
              </label>
              <input
                type="number"
                min={0}
                {...fieldProps('precioVenta')}
                className="cw-input"
                value={precioVenta}
                onChange={e => {
                  setPrecioVenta(e.target.value)
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

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#FEF9E7',
                  border: '1px solid #F5E6B8',
                  padding: '12px 14px',
                  borderRadius: 10,
                  marginTop: 12,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#7D6608' }}>
                  TOTAL OPERACIÓN
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#7D6608' }}>
                  {fmt(totalOperacion)}
                </span>
              </div>

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
                  background:
                    diferencia === 0
                      ? '#D5F5E3'
                      : Math.abs(diferencia) <= 1
                        ? '#D5F5E3'
                        : '#FDEBD0',
                  border: `1px solid ${Math.abs(diferencia) <= 1 ? '#ABEBC6' : '#FAD7A0'}`,
                  padding: '12px 14px',
                  borderRadius: 10,
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#186A3B' }}>
                  Total cobrado
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#186A3B' }}>
                  {fmt(totalCobrado)}
                  {parseInt(usd) ? (
                    <span style={{ fontSize: 11, fontWeight: 600 }}> (incluye {usd} USD)</span>
                  ) : null}
                </span>
              </div>
              {Math.abs(diferencia) > 1 && totalOperacion > 0 && (
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#9C6500',
                    background: '#FEF9E7',
                    border: '1px solid #F5E6B8',
                    borderRadius: 8,
                    padding: '9px 12px',
                    marginTop: 8,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                    aria-hidden="true"
                  >
                    error
                  </span>
                  {diferencia > 0
                    ? `Sobran ${fmt(diferencia)}.`
                    : `Falta cubrir ${fmt(-diferencia)}.`}{' '}
                  Debe coincidir con el total operación.
                </p>
              )}
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

          {step === 3 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Accesorios y regalo
              </legend>
              {catAcc.length > 0 && (
                <div
                  style={{
                    background: '#FAFBFD',
                    border: '1px solid #EDF0F6',
                    borderRadius: 10,
                    padding: 14,
                    marginTop: 12,
                  }}
                >
                  <label htmlFor="acc-catalogo" style={{ ...labelStyle, marginTop: 0 }}>
                    Agregar del catálogo (con stock)
                  </label>
                  <div className="cw-cat-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <select
                      id="acc-catalogo"
                      className="cw-input"
                      style={inputStyle}
                      value={accSel}
                      onChange={e => setAccSel(e.target.value)}
                    >
                      <option value="">Seleccionar accesorio...</option>
                      {catAcc.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} — {fmt(a.price)} ({a.stock - a.reserved} en stock)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={agregarAccesorioCatalogo}
                      disabled={!accSel}
                      className="cw-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: accSel ? '#FF6B2C' : '#F0D5C7',
                        color: '#fff',
                        padding: '0 16px',
                        border: 'none',
                        borderRadius: 9,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: accSel ? 'pointer' : 'default',
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16 }}
                        aria-hidden="true"
                      >
                        add
                      </span>
                      Agregar
                    </button>
                  </div>
                </div>
              )}
              <p
                style={{
                  fontSize: 11.5,
                  color: '#94A3B8',
                  margin: catAcc.length > 0 ? '14px 0 0' : '12px 0 0',
                }}
              >
                {catAcc.length > 0 ? 'Agregados a la venta:' : 'Cargá accesorios manualmente:'}
              </p>
              {accesorios.map((a, i) => (
                <div
                  key={i}
                  className="cw-acc-grid"
                  style={{
                    gridTemplateColumns: accesorios.length > 1 ? '2fr 1fr auto' : '2fr 1fr',
                    marginTop: i === 0 ? 12 : 8,
                  }}
                >
                  <div>
                    {i === 0 && (
                      <label htmlFor={`acc-nombre-${i}`} style={{ ...labelStyle, marginTop: 0 }}>
                        Accesorio
                      </label>
                    )}
                    <input
                      id={`acc-nombre-${i}`}
                      aria-label={i === 0 ? undefined : `Nombre accesorio ${i + 1}`}
                      className="cw-input"
                      style={inputStyle}
                      value={a.nombre}
                      onChange={e => {
                        const n = [...accesorios]
                        n[i] = { ...n[i], nombre: e.target.value }
                        setAccesorios(n)
                      }}
                      placeholder={`Accesorio ${i + 1}`}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    {i === 0 && (
                      <label htmlFor={`acc-precio-${i}`} style={{ ...labelStyle, marginTop: 0 }}>
                        Precio ($)
                      </label>
                    )}
                    <input
                      type="number"
                      min={0}
                      id={`acc-precio-${i}`}
                      aria-label={i === 0 ? undefined : `Precio accesorio ${i + 1}`}
                      className="cw-input"
                      style={{ ...inputStyle, padding: 8 }}
                      value={a.precio}
                      onChange={e => {
                        const n = [...accesorios]
                        n[i] = { ...n[i], precio: e.target.value }
                        setAccesorios(n)
                      }}
                      placeholder="0"
                    />
                  </div>
                  {accesorios.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAccesorios(accesorios.filter((_, j) => j !== i))}
                      aria-label={`Quitar accesorio ${i + 1}`}
                      className="cw-btn"
                      style={{
                        background: 'none',
                        border: '1.5px solid #E6E7F0',
                        borderRadius: 9,
                        height: 41,
                        width: 41,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        marginTop: i === 0 ? 27 : 0,
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 18 }}
                        aria-hidden="true"
                      >
                        delete
                      </span>
                    </button>
                  )}
                </div>
              ))}
              {accesorios.length < 5 && (
                <button
                  type="button"
                  onClick={() => setAccesorios([...accesorios, { nombre: '', precio: '' }])}
                  className="cw-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: '1.5px dashed #CBD5E1',
                    borderRadius: 9,
                    padding: '8px 14px',
                    marginTop: 10,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#64748B',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                    aria-hidden="true"
                  >
                    add
                  </span>
                  Agregar manual
                </button>
              )}

              <label
                htmlFor="regalos"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 18,
                  fontSize: 13,
                  color: '#3D4356',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  id="regalos"
                  checked={regalos}
                  onChange={e => setRegalos(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: '#FF6B2C', cursor: 'pointer' }}
                />
                Entregar regalos de bienvenida
              </label>
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
                placeholder="Detalles adicionales de la venta"
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
                        color: k === 'TOTAL OPERACIÓN' ? '#7D6608' : '#181B2E',
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
                  Confirmar venta
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

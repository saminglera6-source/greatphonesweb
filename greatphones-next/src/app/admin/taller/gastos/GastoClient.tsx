'use client'

import { useEffect, useRef, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'
import { fmtARS } from '@/lib/precios'
import { MoneyInput, UsdInput } from '@/components/campos'
import { parseMiles, parseUsd } from '@/lib/formato'

const OPERADORES = ['Martin', 'Maca', 'Sam', 'Eva', 'Buda']
const CATEGORIAS = [
  'Alquiler',
  'Sueldos',
  'Servicios',
  'Repuestos',
  'Publicidad',
  'Transporte',
  'Comida',
  'Impuestos',
  'Mantenimiento',
  'Otros',
]
const TOTAL = 4
const STEPS = ['Operación', 'Detalle', 'Pago', 'Confirmar']

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

export default function GastoClient() {
  const [operador, setOperador] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [cat, setCat] = useState('Otros')
  const [desc, setDesc] = useState('')
  const [montoGasto, setMontoGasto] = useState('')
  const [efec, setEfec] = useState('')
  const [transf, setTransf] = useState('')
  const [usd, setUsd] = useState('')
  const [resp, setResp] = useState('Martin')
  const [comp, setComp] = useState('')
  const [obs, setObs] = useState('')
  const [cotizacion, setCotizacion] = useState(0)

  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<{ operacion: string; montoTotal: number } | null>(null)
  const errRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activo = true
    fetch('/api/admin/precios/dolar?tipo=blue', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('dolar')
        return r.json()
      })
      .then(d => {
        if (activo && d && d.venta) setCotizacion(d.venta)
      })
      .catch(() => {
        if (activo) setServerMsg('No se pudo obtener la cotización del dólar, se usará $1.000 por defecto.')
      })
    return () => {
      activo = false
    }
  }, [])

  const usdEnPesos = Math.round(parseUsd(usd) * (cotizacion || 1000))
  const total = parseMiles(efec) + parseMiles(transf) + usdEnPesos
  const montoRef = parseMiles(montoGasto)
  const descuadre = montoRef > 0 ? Math.abs(total - montoRef) : 0

  const validarPaso = (p: number): Record<string, string> => {
    const e: Record<string, string> = {}
    if (p === 1 && !operador) e.operador = 'Seleccioná el operador'
    if (p === 2 && !desc.trim()) e.desc = 'Ingresá una descripción del gasto'
    if (p === 3) {
      if (total <= 0) e.pago = 'Ingresá al menos un medio de pago'
      else if (montoRef > 0 && descuadre > 1)
        e.pago = `El total pagado (${fmtARS(total)}) no coincide con el monto del gasto (${fmtARS(montoRef)})`
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
    setDesc('')
    setMontoGasto('')
    setEfec('')
    setTransf('')
    setUsd('')
    setObs('')
    setComp('')
    setCat('Otros')
    setResp('Martin')
    setFecha(new Date().toISOString().split('T')[0])
    setStep(1)
    setMaxStep(1)
    setErrors({})
    setServerMsg(null)
    setDone(null)
  }

  const enviar = async () => {
    const todos = { ...validarPaso(1), ...validarPaso(2), ...validarPaso(3) }
    if (Object.keys(todos).length > 0) {
      setErrors(todos)
      const primero = Object.keys(todos)[0]
      setStep(primero === 'operador' ? 1 : primero === 'desc' ? 2 : 3)
      requestAnimationFrame(() => {
        errRef.current?.focus({ preventScroll: true })
        errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return
    }
    setSending(true)
    setServerMsg(null)
    try {
      const now = new Date()
      const fechaConHora = `${fecha}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      const r = await fetch('/api/admin/taller/gastos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: fechaConHora,
          cat,
          desc: desc.trim(),
          efec: parseMiles(efec),
          transf: parseMiles(transf),
          usd: parseUsd(usd),
          resp,
          comp,
          obs: obs.trim(),
          operador,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setServerMsg(d.error || 'Error al registrar el gasto')
        return
      }
      setDone({ operacion: d.operacion, montoTotal: d.montoTotal })
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
      <>
        <AdminTopbar titulo="Registrar Gasto" />
        <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
          <style>{`.cw-btn:focus-visible{outline:2px solid #FF6B2C;outline-offset:2px}.cw-primary:not(:disabled):hover{filter:brightness(.94)}`}</style>
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
              Gasto registrado
            </h2>
            <p style={{ fontSize: 13.5, color: '#6B7280', margin: 0 }}>
              Operación <strong style={{ color: '#181B2E' }}>{done.operacion}</strong> ·{' '}
              {fmtARS(done.montoTotal)}
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
              Registrar otro gasto
            </button>
          </div>
        </div>
      </>
    )
  }

  const resumen: [string, string][] = [
    ['Operador', operador || '—'],
    ['Fecha', fecha],
    ['Categoría', cat],
    ['Descripción', desc || '—'],
    ['Monto referencia', montoRef > 0 ? fmtARS(montoRef) : '—'],
    ['Efectivo', efec ? fmtARS(parseMiles(efec)) : '—'],
    ['Transferencia', transf ? fmtARS(parseMiles(transf)) : '—'],
    ['USD', usd ? `US$ ${usd} ≈ ${fmtARS(usdEnPesos)}` : '—'],
    ['TOTAL PAGADO', fmtARS(total)],
    ['Responsable', resp || '—'],
    ['Comprobante', comp || '—'],
  ]

  return (
    <>
      <AdminTopbar titulo="Registrar Gasto" />
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <style>{`
          .cw-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px;}
          @media(max-width:640px){.cw-grid{grid-template-columns:1fr} .cw-steplabel{display:none}}
          .cw-input:focus{border-color:#FF6B2C!important;outline:none}
          .cw-btn:focus-visible{outline:2px solid #FF6B2C;outline-offset:2px}
          .cw-primary:not(:disabled):hover{filter:brightness(.94)}
          .cw-back:not(:disabled):hover{background:#F4F6F9}
          .cw-dot-btn:focus-visible{outline:2px solid #FF6B2C;outline-offset:2px}
          .cw-spin{animation:cws 1s linear infinite}
          @keyframes cws{to{transform:rotate(360deg)}}
          @media(prefers-reduced-motion:reduce){.cw-spin{animation:none!important} .cw-bar,.cw-dot-btn,.cw-btn{transition:none!important}}
        `}</style>

        <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 18px' }}>
          Egreso de caja del local — efectivo, transferencia o USD
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
          >{`Paso ${step} de ${TOTAL}: ${STEPS[step - 1]}`}</p>
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
                ¿Quién y cuándo?
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
              <label htmlFor="fecha" style={labelStyle}>
                Fecha
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
                ¿Qué gasto es?
              </legend>
              <label htmlFor="cat" style={{ ...labelStyle, marginTop: 12 }}>
                Categoría
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {CATEGORIAS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCat(c)}
                    aria-pressed={cat === c}
                    style={{
                      padding: '7px 13px',
                      fontSize: 12.5,
                      borderRadius: 99,
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: cat === c ? 700 : 500,
                      color: cat === c ? '#fff' : '#475569',
                      background: cat === c ? '#FF6B2C' : '#EEF0F6',
                      transition: 'background .15s',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <label htmlFor="desc" style={{ ...labelStyle, marginTop: 14 }}>
                Descripción *
              </label>
              <input
                {...fieldProps('desc')}
                className="cw-input"
                value={desc}
                onChange={e => {
                  setDesc(e.target.value)
                  limpiarError('desc')
                }}
                onBlur={() => validarEnBlur('desc')}
                placeholder="Ej: Alquiler de abril, repuestos pantalla"
                autoComplete="off"
              />
              {errors.desc && (
                <p id="desc-error" style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}>
                  {errors.desc}
                </p>
              )}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                ¿Cuánto y cómo se pagó?
              </legend>
              <label htmlFor="montoGasto" style={{ ...labelStyle, marginTop: 12 }}>
                Monto del gasto ($) — opcional, para verificar el cuadre
              </label>
              <MoneyInput
                id="montoGasto"
                className="cw-input"
                style={inputStyle}
                value={montoGasto}
                onChange={setMontoGasto}
                placeholder="0"
              />
              <div className="cw-grid" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="efec" style={{ ...labelStyle, marginTop: 0 }}>
                    Efectivo ($)
                  </label>
                  <MoneyInput
                    {...fieldProps('efec')}
                    className="cw-input"
                    value={efec}
                    onChange={v => {
                      setEfec(v)
                      limpiarError('pago')
                    }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label htmlFor="transf" style={{ ...labelStyle, marginTop: 0 }}>
                    Transferencia ($)
                  </label>
                  <MoneyInput
                    id="transf"
                    className="cw-input"
                    style={inputStyle}
                    value={transf}
                    onChange={v => {
                      setTransf(v)
                      limpiarError('pago')
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
              <label htmlFor="usd" style={labelStyle}>
                Monto USD
              </label>
              <UsdInput
                id="usd"
                className="cw-input"
                style={inputStyle}
                value={usd}
                onChange={v => {
                  setUsd(v)
                  limpiarError('pago')
                }}
                placeholder="0,00"
              />
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '5px 0 0' }}>
                {cotizacion
                  ? `Cotización blue: ${fmtARS(cotizacion)} · USD en pesos: ${fmtARS(usdEnPesos)}`
                  : 'Cargando cotización...'}
              </p>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: total > 0 ? '#D5F5E3' : '#FEF9E7',
                  border: `1px solid ${total > 0 ? '#ABEBC6' : '#FAD7A0'}`,
                  padding: '12px 14px',
                  borderRadius: 10,
                  marginTop: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: total > 0 ? '#186A3B' : '#9C6500',
                  }}
                >
                  Total pagado
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: total > 0 ? '#186A3B' : '#9C6500',
                  }}
                >
                  {fmtARS(total)}
                  {usd ? (
                    <span style={{ fontSize: 11, fontWeight: 600 }}> (incluye {usd} USD)</span>
                  ) : null}
                </span>
              </div>
              {montoRef > 0 && descuadre > 1 && (
                <p
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#B91C1C',
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
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
                  No coincide con el monto de referencia ({fmtARS(montoRef)}).
                </p>
              )}
              {errors.pago && (
                <p
                  id="pago-error"
                  style={{ fontSize: 12, color: '#DC2626', margin: '8px 0 0', fontWeight: 600 }}
                >
                  {errors.pago}
                </p>
              )}
            </fieldset>
          )}

          {step === 4 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Datos adicionales y confirmación
              </legend>
              <div className="cw-grid" style={{ marginTop: 12 }}>
                <div>
                  <label htmlFor="resp" style={{ ...labelStyle, marginTop: 0 }}>
                    Responsable
                  </label>
                  <input
                    id="resp"
                    className="cw-input"
                    style={inputStyle}
                    value={resp}
                    onChange={e => setResp(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="comp" style={{ ...labelStyle, marginTop: 0 }}>
                    N° Comprobante
                  </label>
                  <input
                    id="comp"
                    className="cw-input"
                    style={inputStyle}
                    value={comp}
                    onChange={e => setComp(e.target.value)}
                    placeholder="Ej: FC-0001"
                    autoComplete="off"
                  />
                </div>
              </div>
              <label htmlFor="obs" style={labelStyle}>
                Observaciones
              </label>
              <textarea
                id="obs"
                className="cw-input"
                style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Opcional"
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
                        fontWeight: k === 'TOTAL PAGADO' ? 800 : 600,
                        color: k === 'TOTAL PAGADO' ? '#B91C1C' : '#181B2E',
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
                  Registrar gasto
                </>
              )}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', margin: '12px 0 0' }}>
            Podés volver a los pasos anteriores para corregir cualquier dato.
          </p>
        </form>
      </div>
    </>
  )
}

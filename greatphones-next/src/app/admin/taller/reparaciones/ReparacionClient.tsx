'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminTopbar from '@/components/AdminTopbar'
import { fmtARS } from '@/lib/precios'
import { MoneyInput, ImeiInput, TelInput } from '@/components/campos'
import { parseMiles } from '@/lib/formato'

const OPERADORES = ['Martin', 'Maca', 'Sam', 'Eva', 'Buda']
const TOTAL = 6
const STEPS = ['Operación', 'Cliente', 'Equipo', 'Falla', 'Presupuesto', 'Cobro']

const TRABAJOS = [
  { key: 'bateria', label: 'Batería' },
  { key: 'pantalla', label: 'Pantalla' },
  { key: 'camara', label: 'Cámara' },
  { key: 'microfono', label: 'Micrófono' },
  { key: 'parlante', label: 'Parlante' },
  { key: 'tapa', label: 'Tapa trasera' },
  { key: 'marco', label: 'Marco' },
  { key: 'pin', label: 'Pin de carga' },
  { key: 'flex', label: 'Flex de carga' },
  { key: 'botones', label: 'Botones laterales' },
  { key: 'chasis', label: 'Chasis' },
]

interface Presu {
  trabajos: Array<{
    nombre: string
    precio: number | null
    sinConfigurar?: boolean
    motivo?: string
  }>
  precioTotal: number
  horasEstimadas: number
  estado: string
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

function repDias(horas: number) {
  const dias = Math.round((horas || 0) / 24) || 1
  return dias + (dias === 1 ? ' día hábil' : ' días hábiles')
}

export default function ReparacionClient() {
  const [operador, setOperador] = useState('')
  const [tipo, setTipo] = useState('Particular')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [cliente, setCliente] = useState('')
  const [tel, setTel] = useState('')
  const [equipo, setEquipo] = useState('')
  const [imei, setImei] = useState('')
  const [pin, setPin] = useState('')
  const [falla1, setFalla1] = useState('')
  const [falla2, setFalla2] = useState('')
  const [esDiagnostico, setEsDiagnostico] = useState(false)
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})
  const [modelos, setModelos] = useState<string[]>([])
  const [presu, setPresu] = useState<Presu | null>(null)
  const [precioCob, setPrecioCob] = useState('')
  const [efec, setEfec] = useState('')
  const [transf, setTransf] = useState('')
  const [obs, setObs] = useState('')
  const [thirdParty, setThirdParty] = useState(false)
  const [thirdPartyCost, setThirdPartyCost] = useState('')

  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<{ numero: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const errRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activo = true
    fetch('/api/admin/precios/toma', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('modelos')
        return r.json()
      })
      .then(d => {
        if (activo) setModelos(Array.isArray(d) ? d.map((x: { modelo: string }) => x.modelo) : [])
      })
      .catch(() => {
        if (activo) setServerMsg('No se pudo cargar el listado de modelos. Recargá la página.')
      })
    return () => {
      activo = false
    }
  }, [])

  const cualquierTrabajo = TRABAJOS.some(t => marcados[t.key])
  const puedeCalcular = !esDiagnostico && equipo && cualquierTrabajo

  const recalcular = useCallback(async () => {
    if (esDiagnostico) {
      setPresu({ trabajos: [], precioTotal: 0, horasEstimadas: 48, estado: 'DIAGNOSTICO' })
      return
    }
    if (!equipo || !cualquierTrabajo) {
      setPresu(null)
      return
    }
    try {
      const r = await fetch('/api/admin/taller', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelo: equipo, trabajos: marcados }),
      })
      const d = await r.json()
      if (!r.ok) {
        setServerMsg(d.error || 'Error al calcular presupuesto')
        return
      }
      setPresu(d)
      setPrecioCob(String(d.precioTotal || 0))
    } catch {
      setServerMsg('Error al calcular presupuesto')
    }
  }, [esDiagnostico, equipo, cualquierTrabajo, marcados])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recalcular()
  }, [recalcular])

  const textoPresupuesto = useMemo(() => {
    if (!presu) return ''
    const lineas = ['🔧 GreatPhones Service', '', 'Equipo:', equipo || '—', '', 'Trabajos:', '']
    if (presu.estado === 'DIAGNOSTICO') lineas.push('✓ Diagnóstico técnico')
    else presu.trabajos.forEach(t => lineas.push('✓ ' + t.nombre))
    lineas.push('', 'Precio estimado:', '')
    lineas.push(presu.estado === 'DIAGNOSTICO' ? 'A confirmar' : fmtARS(presu.precioTotal))
    lineas.push(
      '',
      'Tiempo estimado:',
      '',
      repDias(presu.horasEstimadas),
      '',
      'Garantía:',
      '90 días',
    )
    return lineas.join('\n')
  }, [presu, equipo])

  const validarPaso = (p: number): Record<string, string> => {
    const e: Record<string, string> = {}
    if (p === 1 && !operador) e.operador = 'Seleccioná el operador'
    if (p === 2 && !cliente.trim()) e.cliente = 'Ingresá el nombre del cliente'
    if (p === 3 && !equipo.trim()) e.equipo = 'Ingresá el modelo del equipo'
    if (p === 4 && !falla1.trim()) e.falla1 = 'Describí la falla principal'
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
    setCliente('')
    setTel('')
    setEquipo('')
    setImei('')
    setPin('')
    setFalla1('')
    setFalla2('')
    setPrecioCob('')
    setEfec('')
    setTransf('')
    setObs('')
    setThirdParty(false)
    setThirdPartyCost('')
    setMarcados({})
    setPresu(null)
    setEsDiagnostico(false)
    setFecha(new Date().toISOString().split('T')[0])
    setStep(1)
    setMaxStep(1)
    setErrors({})
    setServerMsg(null)
    setDone(null)
  }

  const enviar = async () => {
    const todos = { ...validarPaso(1), ...validarPaso(2), ...validarPaso(3), ...validarPaso(4) }
    if (Object.keys(todos).length > 0) {
      setErrors(todos)
      const primero = Object.keys(todos)[0]
      const pasoDelError =
        primero === 'operador' ? 1 : primero === 'cliente' ? 2 : primero === 'equipo' ? 3 : 4
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
      const trabajos = esDiagnostico
        ? ['Diagnóstico']
        : presu
          ? presu.trabajos.map(t => t.nombre)
          : []
      const payload = {
        tipo,
        fecha,
        cliente: cliente.trim(),
        tel: tel.trim(),
        equipo: equipo.trim(),
        imei: imei.trim(),
        pin: pin.trim(),
        falla1: falla1.trim(),
        falla2: falla2.trim(),
        esDiagnostico,
        trabajos,
        precioCalculado: presu ? presu.precioTotal : 0,
        detallePresupuesto: presu
          ? presu.trabajos
              .map(
                t =>
                  `${t.nombre}: ${t.precio != null ? fmtARS(t.precio) : t.motivo || 'sin configurar'}`,
              )
              .join(' | ')
          : '',
        tiempoEstimadoHoras: presu ? presu.horasEstimadas : 0,
        precioCob: parseMiles(precioCob),
        efec: parseMiles(efec),
        transf: parseMiles(transf),
        thirdParty,
        thirdPartyCost: thirdParty ? parseMiles(thirdPartyCost) : undefined,
        obs: obs.trim(),
        operador,
      }
      const r = await fetch('/api/admin/taller/reparaciones', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) {
        setServerMsg(d.error || 'Error al registrar la reparación')
        return
      }
      setDone({ numero: d.numero })
    } catch {
      setServerMsg('Error de conexión. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const copiarTexto = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
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
        <AdminTopbar titulo="Registrar Reparación" />
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
              Reparación registrada
            </h2>
            <p style={{ fontSize: 13.5, color: '#6B7280', margin: 0 }}>
              Operación <strong style={{ color: '#181B2E' }}>{done.numero}</strong>
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
              Registrar otra reparación
            </button>
          </div>
        </div>
      </>
    )
  }

  const resumen: [string, string][] = [
    ['Operador', operador || '—'],
    ['Tipo', tipo],
    ['Fecha', fecha],
    ['Cliente', cliente || '—'],
    ['Teléfono', tel || '—'],
    ['Equipo', equipo || '—'],
    ['IMEI', imei || '—'],
    ['Falla principal', falla1 || '—'],
    [
      'Modalidad',
      esDiagnostico
        ? 'Diagnóstico (a confirmar)'
        : presu?.trabajos.map(t => t.nombre).join(', ') || '—',
    ],
    [
      'Presupuesto',
      presu ? (presu.estado === 'DIAGNOSTICO' ? 'A confirmar' : fmtARS(presu.precioTotal)) : '—',
    ],
    ['Tiempo estimado', presu ? repDias(presu.horasEstimadas) : '—'],
    ['Precio cobrado', fmtARS(parseMiles(precioCob))],
  ]

  return (
    <>
      <AdminTopbar titulo="Registrar Reparación" />
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
          Ingreso de reparación o diagnóstico con presupuesto automático
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
                ¿Quién y qué tipo de ingreso?
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
              <div className="cw-grid" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="tipo" style={{ ...labelStyle, marginTop: 0 }}>
                    Tipo
                  </label>
                  <select
                    id="tipo"
                    className="cw-input"
                    style={inputStyle}
                    value={tipo}
                    onChange={e => setTipo(e.target.value)}
                  >
                    {['Particular', 'Garantía', 'Preventa', 'Interno'].map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="fecha" style={{ ...labelStyle, marginTop: 0 }}>
                    Fecha
                  </label>
                  <input
                    type="date"
                    {...fieldProps('fecha')}
                    className="cw-input"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Datos del cliente
              </legend>
              <div className="cw-grid" style={{ marginTop: 12 }}>
                <div>
                  <label htmlFor="cliente" style={{ ...labelStyle, marginTop: 0 }}>
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
                    <p
                      id="cliente-error"
                      style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}
                    >
                      {errors.cliente}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="tel" style={{ ...labelStyle, marginTop: 0 }}>
                    Teléfono
                  </label>
                  <TelInput
                    id="tel"
                    className="cw-input"
                    style={inputStyle}
                    value={tel}
                    onChange={setTel}
                  />
                </div>
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Equipo a reparar
              </legend>
              <label htmlFor="equipo" style={{ ...labelStyle, marginTop: 12 }}>
                Modelo para presupuesto *
              </label>
              <input
                list="modelos-toma"
                {...fieldProps('equipo')}
                className="cw-input"
                value={equipo}
                onChange={e => {
                  setEquipo(e.target.value)
                  limpiarError('equipo')
                }}
                onBlur={() => validarEnBlur('equipo')}
                placeholder="Buscar modelo..."
                autoComplete="off"
              />
              <datalist id="modelos-toma">
                {modelos.map(m => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {errors.equipo && (
                <p id="equipo-error" style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}>
                  {errors.equipo}
                </p>
              )}
              <div className="cw-grid" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="imei" style={{ ...labelStyle, marginTop: 0 }}>
                    IMEI
                  </label>
                  <ImeiInput
                    id="imei"
                    className="cw-input"
                    style={inputStyle}
                    value={imei}
                    onChange={setImei}
                  />
                </div>
                <div>
                  <label htmlFor="pin" style={{ ...labelStyle, marginTop: 0 }}>
                    PIN / Clave
                  </label>
                  <input
                    id="pin"
                    className="cw-input"
                    style={inputStyle}
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="Ej: 1234"
                  />
                </div>
              </div>
            </fieldset>
          )}

          {step === 4 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Falla reportada
              </legend>
              <label htmlFor="falla1" style={{ ...labelStyle, marginTop: 12 }}>
                Falla principal *
              </label>
              <input
                {...fieldProps('falla1')}
                className="cw-input"
                value={falla1}
                onChange={e => {
                  setFalla1(e.target.value)
                  limpiarError('falla1')
                }}
                onBlur={() => validarEnBlur('falla1')}
                placeholder="Ej: No carga, pantalla negra..."
                autoComplete="off"
              />
              {errors.falla1 && (
                <p id="falla1-error" style={{ fontSize: 12, color: '#DC2626', margin: '5px 0 0' }}>
                  {errors.falla1}
                </p>
              )}
              <label htmlFor="falla2" style={labelStyle}>
                Falla secundaria
              </label>
              <input
                id="falla2"
                className="cw-input"
                style={inputStyle}
                value={falla2}
                onChange={e => setFalla2(e.target.value)}
                placeholder="Otra falla detectada (opcional)"
                autoComplete="off"
              />
            </fieldset>
          )}

          {step === 5 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Presupuesto automático
              </legend>
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}
                role="radiogroup"
                aria-label="Tipo de ingreso"
              >
                {(['reparacion', 'diagnostico'] as const).map(v => {
                  const activo = (v === 'diagnostico') === esDiagnostico
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => setEsDiagnostico(v === 'diagnostico')}
                      style={{
                        padding: '13px 10px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 13.5,
                        fontWeight: 700,
                        border: activo ? '2px solid #FF6B2C' : '1.5px solid #E6E7F0',
                        background: activo ? '#FFF1E8' : '#FBFBFD',
                        color: activo ? '#E85A17' : '#64748B',
                        transition: 'border-color .15s, background .15s',
                      }}
                    >
                      {v === 'reparacion' ? 'Reparación' : 'Diagnóstico'}
                    </button>
                  )
                })}
              </div>

              <p style={{ fontSize: 12, fontWeight: 600, color: '#3D4356', margin: '14px 0 8px' }}>
                Trabajos a realizar:
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  opacity: esDiagnostico ? 0.45 : 1,
                }}
              >
                {TRABAJOS.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    disabled={esDiagnostico}
                    aria-pressed={!!marcados[t.key]}
                    onClick={() => setMarcados(m => ({ ...m, [t.key]: !m[t.key] }))}
                    style={{
                      padding: '7px 13px',
                      fontSize: 12.5,
                      borderRadius: 99,
                      cursor: esDiagnostico ? 'default' : 'pointer',
                      fontWeight: marcados[t.key] ? 700 : 500,
                      color: marcados[t.key] ? '#fff' : '#475569',
                      background: marcados[t.key] ? '#FF6B2C' : '#EEF0F6',
                      border: 'none',
                      opacity: esDiagnostico && marcados[t.key] ? 0.6 : 1,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {presu ? (
                <div style={{ marginTop: 16 }}>
                  {presu.estado === 'DIAGNOSTICO' ? (
                    <div
                      style={{
                        background: '#FEF9E7',
                        border: '1px solid #F5E6B8',
                        borderRadius: 10,
                        padding: 14,
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#7D6608', margin: 0 }}>
                        Diagnóstico técnico — precio a confirmar tras revisión
                      </p>
                      <p style={{ fontSize: 12, color: '#9C6500', margin: '6px 0 0' }}>
                        Tiempo estimado: {repDias(48)} · Garantía 90 días
                      </p>
                    </div>
                  ) : (
                    <dl
                      style={{
                        background: '#FAFBFD',
                        border: '1px solid #EDF0F6',
                        borderRadius: 10,
                        padding: '6px 16px',
                        margin: 0,
                      }}
                    >
                      {presu.trabajos.map((t, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 16,
                            padding: '8px 0',
                            borderBottom:
                              i < presu.trabajos.length - 1 ? '1px solid #EFF1F6' : 'none',
                          }}
                        >
                          <dt
                            style={{
                              fontSize: 13,
                              color: '#3D4356',
                              margin: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 14, color: '#0F9D58' }}
                              aria-hidden="true"
                            >
                              check
                            </span>
                            {t.nombre}
                          </dt>
                          <dd
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: t.precio != null ? '#181B2E' : '#B7950B',
                              margin: 0,
                            }}
                          >
                            {t.precio != null ? fmtARS(t.precio) : t.motivo || 'sin configurar'}
                          </dd>
                        </div>
                      ))}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0',
                          borderTop: '1px dashed #D1D5DB',
                          marginTop: 4,
                        }}
                      >
                        <dt style={{ fontSize: 14, fontWeight: 800, color: '#0F9D58', margin: 0 }}>
                          TOTAL
                        </dt>
                        <dd style={{ fontSize: 17, fontWeight: 800, color: '#0F9D58', margin: 0 }}>
                          {fmtARS(presu.precioTotal)}
                        </dd>
                      </div>
                      <p style={{ fontSize: 11.5, color: '#94A3B8', margin: '2px 0 4px' }}>
                        Tiempo estimado: {repDias(presu.horasEstimadas)} · Garantía 90 días
                      </p>
                    </dl>
                  )}
                  <div
                    style={{
                      background: '#0B5345',
                      color: '#fff',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 10,
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6,
                    }}
                  >
                    {textoPresupuesto}
                  </div>
                  <button
                    type="button"
                    onClick={() => copiarTexto(textoPresupuesto)}
                    className="cw-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 8,
                      padding: '7px 12px',
                      background: copiado ? '#0F9D58' : '#5D6D7E',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14 }}
                      aria-hidden="true"
                    >
                      {copiado ? 'check' : 'content_copy'}
                    </span>
                    {copiado ? 'Copiado' : 'Copiar presupuesto'}
                  </button>
                </div>
              ) : (
                <p
                  style={{
                    fontSize: 12.5,
                    color: '#94A3B8',
                    background: '#FAFBFD',
                    border: '1px dashed #E6E7F0',
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginTop: 14,
                    textAlign: 'center',
                  }}
                >
                  {esDiagnostico
                    ? 'Se generará un presupuesto a confirmar tras el diagnóstico.'
                    : puedeCalcular
                      ? 'Calculando presupuesto...'
                      : 'Seleccioná el modelo y marcá al menos un trabajo para ver el presupuesto.'}
                </p>
              )}
            </fieldset>
          )}

          {step === 6 && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 15, fontWeight: 800, color: '#181B2E', marginBottom: 2 }}>
                Cobro y confirmación
              </legend>
              <label htmlFor="precioCob" style={{ ...labelStyle, marginTop: 12 }}>
                Precio cobrado ($)
              </label>
              <MoneyInput
                {...fieldProps('precioCob')}
                className="cw-input"
                value={precioCob}
                onChange={setPrecioCob}
                placeholder="0"
              />
              <div className="cw-grid" style={{ marginTop: 10 }}>
                <div>
                  <label htmlFor="efec" style={{ ...labelStyle, marginTop: 0 }}>
                    Cobrado efectivo ($)
                  </label>
                  <MoneyInput
                    id="efec"
                    className="cw-input"
                    style={inputStyle}
                    value={efec}
                    onChange={setEfec}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label htmlFor="transf" style={{ ...labelStyle, marginTop: 0 }}>
                    Cobrado transferencia ($)
                  </label>
                  <MoneyInput
                    id="transf"
                    className="cw-input"
                    style={inputStyle}
                    value={transf}
                    onChange={setTransf}
                    placeholder="0"
                  />
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 14,
                  padding: 12,
                  background: '#FFF1E8',
                  borderRadius: 8,
                  border: '1px solid #FFD3BC',
                }}
              >
                <input
                  type="checkbox"
                  id="thirdParty"
                  checked={thirdParty}
                  onChange={e => setThirdParty(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="thirdParty" style={{ flex: 1, cursor: 'pointer', margin: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#181B2E', margin: 0 }}>
                    ¿Reparación a tercero?
                  </p>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '3px 0 0' }}>
                    Si está marcado, el costo del tercero se usará para calcular la ganancia
                  </p>
                </label>
              </div>

              {thirdParty && (
                <div style={{ marginTop: 10 }}>
                  <label htmlFor="thirdPartyCost" style={{ ...labelStyle, marginTop: 0 }}>
                    Costo del tercero ($)
                  </label>
                  <MoneyInput
                    id="thirdPartyCost"
                    className="cw-input"
                    style={inputStyle}
                    value={thirdPartyCost}
                    onChange={setThirdPartyCost}
                    placeholder="0"
                  />
                </div>
              )}

              <label htmlFor="obs" style={{ ...labelStyle, marginTop: 12 }}>
                Observaciones
              </label>
              <textarea
                id="obs"
                className="cw-input"
                style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Detalles adicionales"
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
                  Registrar reparación
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

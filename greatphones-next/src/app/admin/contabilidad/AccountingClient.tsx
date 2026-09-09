'use client'

import { useCallback, useEffect, useState } from 'react'

interface Balance { means: string; balance: number; balanceUsd: number | null }
interface Entry {
  id: string; source: string; operationId: string | null; description: string
  category: string | null; type: string; means: string; amount: number
  amountUsd: number | null; createdAt: string; operator: string | null
}
interface Resp { balances: Balance[]; data: Entry[]; total: number; page: number; totalPages: number }

const MEANS_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', CUOTAS: 'Cuotas', USD: 'Dólares', PAGO_ONLINE: 'Pago online',
}
const TYPE_LABEL: Record<string, string> = { INGRESO: 'Ingreso', EGRESO: 'Egreso', NEUTRO: 'Neutro' }

function fmt(n: number) { return '$' + (n || 0).toLocaleString('es-AR') }
function fmtUsd(n: number | null) { return 'USD ' + (n || 0).toLocaleString('en-US') }

function BalanceCard({ b }: { b: Balance }) {
  const colors: Record<string, string> = {
    EFECTIVO: '#0F9D58', TRANSFERENCIA: '#2563EB', CUOTAS: '#7C3AED', USD: '#D97706', PAGO_ONLINE: '#0891B2',
  }
  const c = colors[b.means] || '#4F46E5'
  return (
    <div style={{ background: '#fff', border: `1px solid #E6E7F0`, borderTop: `3px solid ${c}`, borderRadius: 14, padding: 19, boxShadow: '0 1px 2px rgba(23,23,45,.04),0 6px 20px rgba(23,23,45,.06)' }}>
      <div style={{ fontSize: 12.5, color: '#6B7280', fontWeight: 500 }}>{MEANS_LABEL[b.means] || b.means}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#181B2E', marginTop: 8, fontFamily: 'Manrope,Inter,sans-serif', letterSpacing: '-.5px' }}>
        {b.means === 'USD' ? fmtUsd(b.balanceUsd) : fmt(b.balance)}
      </div>
    </div>
  )
}

export default function AccountingClient() {
  const [balances, setBalances] = useState<Balance[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [means, setMeans] = useState('')
  const [search, setSearch] = useState('')
  const [operators, setOperators] = useState<{ name: string }[]>([])
  // formulario manual
  const [showForm, setShowForm] = useState(false)
  const [fSource, setFSource] = useState('GASTO')
  const [fDesc, setFDesc] = useState('')
  const [fType, setFType] = useState('EGRESO')
  const [fMeans, setFMeans] = useState('EFECTIVO')
  const [fAmount, setFAmount] = useState('')
  const [fUsd, setFUsd] = useState('')
  const [fOperator, setFOperator] = useState('')
  const [msg, setMsg] = useState<{ t: string; s: string } | null>(null)
  // cambio de moneda
  const [cxDir, setCxDir] = useState<'COMPRA_USD' | 'VENTA_USD'>('COMPRA_USD')
  const [cxUsd, setCxUsd] = useState('')
  const [cxCaja, setCxCaja] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO')
  const [cxCot, setCxCot] = useState('')
  // ajuste de caja
  const [ajTipo, setAjTipo] = useState<'SOBRANTE' | 'FALTANTE'>('FALTANTE')
  const [ajMotivo, setAjMotivo] = useState('')
  // arqueo
  const [showArqueo, setShowArqueo] = useState(false)
  const [arqEf, setArqEf] = useState('')
  const [arqTr, setArqTr] = useState('')
  const [arqUsd, setArqUsd] = useState('')
  const [arqRes, setArqRes] = useState<
    { means: string; sistema: number; fisico: number | null; diferencia: number | null; tipo: string | null }[]
  >([])

  const load = useCallback(async (p = page, m = means, s = search) => {
    const q = new URLSearchParams({ page: String(p), limit: '50' })
    if (m) q.set('means', m)
    if (s) q.set('search', s)
    try {
      const r = await fetch(`/api/admin/accounting?${q}`, { credentials: 'include' })
      const d: Resp = await r.json()
      setBalances(d.balances || [])
      setEntries(d.data || [])
      setTotal(d.total)
      setTotalPages(d.totalPages || 1)
      setPage(d.page || 1)
    } catch { setMsg({ t: 'error', s: 'Error al cargar la contabilidad' }) }
  }, [])

  useEffect(() => { load(1, '', '') }, [load])
  useEffect(() => {
    fetch('/api/admin/operators', { credentials: 'include' })
      .then(r => r.json()).then(d => setOperators(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const toast = (t: string, s: string) => { setMsg({ t, s }); setTimeout(() => setMsg(null), 4000) }

  const resetForm = () => {
    setShowForm(false); setFDesc(''); setFAmount(''); setFUsd(''); setFOperator('')
    setCxUsd(''); setCxCot(''); setAjMotivo('')
  }

  const submit = async () => {
    // Cambio de moneda → endpoint de tesorería (doble asiento)
    if (fSource === 'CAMBIO') {
      const usd = parseFloat(cxUsd || '0')
      if (!(usd > 0)) return toast('error', 'Indicá la cantidad de dólares')
      const r = await fetch('/api/admin/tesoreria', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'cambio', usd, cajaPesos: cxCaja, direccion: cxDir,
          cotizacion: cxCot ? parseFloat(cxCot) : undefined,
          obs: fDesc || undefined, operator: fOperator || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) return toast('error', d.error || 'Error')
      toast('success', `Cambio ${d.operacion}: USD ${d.usd} ↔ ${fmt(d.pesos)} @ $${d.cotizacion}`)
      resetForm(); load(1, means, search)
      return
    }
    // Ajuste de caja → endpoint de tesorería (motivo obligatorio)
    if (fSource === 'AJUSTE') {
      const amt = parseFloat((fMeans === 'USD' ? fUsd : fAmount) || '0')
      if (!(amt > 0)) return toast('error', 'Indicá el monto de la diferencia')
      if (!ajMotivo.trim()) return toast('error', 'El motivo del ajuste es obligatorio')
      const r = await fetch('/api/admin/tesoreria', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'ajuste', means: fMeans, tipo: ajTipo, monto: amt, motivo: ajMotivo,
          obs: fDesc || undefined, operator: fOperator || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) return toast('error', d.error || 'Error')
      toast('success', `Ajuste ${d.operacion} registrado`)
      resetForm(); load(1, means, search)
      return
    }
    // Gasto / Manual → endpoint contable genérico
    if (!fDesc) return toast('error', 'Descripción requerida')
    const amt = parseInt(fAmount || '0', 10)
    if (fType !== 'NEUTRO' && !amt) return toast('error', 'Monto requerido')
    if (fMeans === 'USD' && !fUsd) return toast('error', 'Indicá la cantidad de dólares')
    const body: any = { source: fSource, description: fDesc, type: fType, means: fMeans, amount: amt, operator: fOperator || undefined }
    if (fMeans === 'USD') body.amountUsd = parseFloat(fUsd || '0')
    const r = await fetch('/api/admin/accounting', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    if (!r.ok) return toast('error', d.error || 'Error')
    toast('success', `Movimiento registrado (${d.opNumber})`)
    resetForm()
    load(1, means, search)
  }

  const correrArqueo = async () => {
    const q = new URLSearchParams({ arqueo: '1' })
    if (arqEf !== '') q.set('efectivo', arqEf)
    if (arqTr !== '') q.set('transferencia', arqTr)
    if (arqUsd !== '') q.set('usd', arqUsd)
    const r = await fetch(`/api/admin/tesoreria?${q}`, { credentials: 'include' })
    const d = await r.json()
    if (!r.ok) return toast('error', d.error || 'Error')
    setArqRes(d)
  }

  const generarAjusteDesdeArqueo = (row: { means: string; diferencia: number | null; tipo: string | null }) => {
    if (!row.diferencia || row.tipo === 'OK') return
    setFSource('AJUSTE')
    setFMeans(row.means)
    setAjTipo(row.tipo as 'SOBRANTE' | 'FALTANTE')
    const abs = Math.abs(row.diferencia)
    if (row.means === 'USD') setFUsd(String(abs)); else setFAmount(String(Math.round(abs)))
    setAjMotivo('Diferencia detectada en arqueo')
    setFDesc('')
    setShowArqueo(false)
    setShowForm(true)
  }

  const svg = {
    ingreso: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F9D58" strokeWidth="2"><path d="M5 15l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 22V3" strokeLinecap="round"/></svg>,
    egreso: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><path d="M5 9l7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 2v19" strokeLinecap="round"/></svg>,
    neutro: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round"/></svg>,
  }

  return (
    <div style={{ padding: 'clamp(16px,4vw,24px) clamp(14px,3vw,28px)', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#181B2E', margin: 0, fontFamily: 'Manrope,Inter,sans-serif' }}>Caja / Contabilidad</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Libro diario y saldo de caja por medio de pago</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setShowArqueo(v => !v); setShowForm(false) }} style={{ background: '#fff', color: '#4F46E5', border: '1.5px solid #C7D2FE', padding: '11px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Arqueo de caja
          </button>
          <button onClick={() => { setShowForm(v => !v); setShowArqueo(false) }} style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#fff', border: 'none', padding: '11px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(79,70,229,.28)' }}>
            + Registrar movimiento
          </button>
        </div>
      </div>

      {showArqueo && (
        <div style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 14, padding: 20, marginBottom: 26, boxShadow: '0 1px 2px rgba(23,23,45,.04)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#181B2E' }}>Arqueo de caja</h3>
          <p style={{ fontSize: 12.5, color: '#6B7280', margin: '0 0 14px' }}>Contá la plata física y compará contra el saldo del sistema. Dejá en blanco los medios que no arquees.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3D4356', marginBottom: 5 }}>Efectivo contado ($)</label>
              <input type="number" value={arqEf} onChange={e => setArqEf(e.target.value)} style={{ width: '100%', padding: 9, border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 13, background: '#FBFBFD' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3D4356', marginBottom: 5 }}>Transferencia ($)</label>
              <input type="number" value={arqTr} onChange={e => setArqTr(e.target.value)} style={{ width: '100%', padding: 9, border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 13, background: '#FBFBFD' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3D4356', marginBottom: 5 }}>USD contados</label>
              <input type="number" value={arqUsd} onChange={e => setArqUsd(e.target.value)} style={{ width: '100%', padding: 9, border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 13, background: '#FBFBFD' }} />
            </div>
          </div>
          <button onClick={correrArqueo} style={{ marginTop: 14, background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Comparar</button>
          {arqRes.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E6E7F0', color: '#6B7280', textAlign: 'left' }}>
                  <th style={{ padding: '7px 6px' }}>Medio</th>
                  <th style={{ padding: '7px 6px', textAlign: 'right' }}>Sistema</th>
                  <th style={{ padding: '7px 6px', textAlign: 'right' }}>Contado</th>
                  <th style={{ padding: '7px 6px', textAlign: 'right' }}>Diferencia</th>
                  <th style={{ padding: '7px 6px' }}></th>
                </tr>
              </thead>
              <tbody>
                {arqRes.map(row => (
                  <tr key={row.means} style={{ borderBottom: '1px solid #EEF0F5' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 600 }}>{MEANS_LABEL[row.means] || row.means}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{row.means === 'USD' ? fmtUsd(row.sistema) : fmt(row.sistema)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{row.fisico == null ? '—' : row.means === 'USD' ? fmtUsd(row.fisico) : fmt(row.fisico)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: row.tipo === 'OK' ? '#0F9D58' : row.diferencia == null ? '#9AA1B2' : '#DC2626' }}>
                      {row.diferencia == null ? '—' : row.tipo === 'OK' ? 'OK' : (row.diferencia > 0 ? '+' : '') + (row.means === 'USD' ? fmtUsd(row.diferencia) : fmt(row.diferencia))}
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      {row.diferencia != null && row.tipo !== 'OK' && (
                        <button onClick={() => generarAjusteDesdeArqueo(row)} style={{ background: 'none', border: '1px solid #E6E7F0', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#4F46E5' }}>Generar ajuste</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, color: '#fff', fontWeight: 600, fontSize: 13, background: msg.t === 'success' ? 'linear-gradient(135deg,#0F9D58,#0C8A4C)' : 'linear-gradient(135deg,#DC2626,#B91C1C)' }}>
          {msg.s}
        </div>
      )}

      {/* Cajas por medio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 26 }}>
        {balances.map(b => <BalanceCard key={b.means} b={b} />)}
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 14, padding: 20, marginBottom: 26, boxShadow: '0 1px 2px rgba(23,23,45,.04)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#181B2E' }}>Registrar movimiento</h3>
          {(() => { const sty = { width: '100%', padding: 9, border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 13, background: '#FBFBFD' } as const
          const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#3D4356', marginBottom: 5 } as const
          return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            <div>
              <label style={lbl}>Tipo</label>
              <select value={fSource} onChange={e => setFSource(e.target.value)} style={sty}>
                <option value="GASTO">Gasto</option>
                <option value="CAMBIO">Cambio de moneda</option>
                <option value="AJUSTE">Ajuste de caja</option>
                <option value="MANUAL">Otro</option>
              </select>
            </div>

            {fSource === 'CAMBIO' ? (
              <>
                <div>
                  <label style={lbl}>Operación</label>
                  <select value={cxDir} onChange={e => setCxDir(e.target.value as 'COMPRA_USD' | 'VENTA_USD')} style={sty}>
                    <option value="COMPRA_USD">Compro dólares (salen pesos)</option>
                    <option value="VENTA_USD">Vendo dólares (entran pesos)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Cantidad USD</label>
                  <input type="number" value={cxUsd} onChange={e => setCxUsd(e.target.value)} style={sty} />
                </div>
                <div>
                  <label style={lbl}>Caja en pesos</label>
                  <select value={cxCaja} onChange={e => setCxCaja(e.target.value as 'EFECTIVO' | 'TRANSFERENCIA')} style={sty}>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Cotización (vacío = la vigente)</label>
                  <input type="number" value={cxCot} onChange={e => setCxCot(e.target.value)} placeholder="$" style={sty} />
                </div>
              </>
            ) : fSource === 'AJUSTE' ? (
              <>
                <div>
                  <label style={lbl}>Diferencia</label>
                  <select value={ajTipo} onChange={e => setAjTipo(e.target.value as 'SOBRANTE' | 'FALTANTE')} style={sty}>
                    <option value="FALTANTE">Faltante (falta plata)</option>
                    <option value="SOBRANTE">Sobrante (hay de más)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Medio</label>
                  <select value={fMeans} onChange={e => setFMeans(e.target.value)} style={sty}>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="USD">Dólares</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>{fMeans === 'USD' ? 'Cantidad USD' : 'Monto ($)'}</label>
                  <input type="number" value={fMeans === 'USD' ? fUsd : fAmount} onChange={e => fMeans === 'USD' ? setFUsd(e.target.value) : setFAmount(e.target.value)} style={sty} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={lbl}>Sentido</label>
                  <select value={fType} onChange={e => setFType(e.target.value)} style={sty}>
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                    <option value="NEUTRO">Neutro</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Medio</label>
                  <select value={fMeans} onChange={e => setFMeans(e.target.value)} style={sty}>
                    {Object.entries(MEANS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{fMeans === 'USD' ? 'Cantidad USD' : 'Monto ($)'}</label>
                  <input type="number" value={fMeans === 'USD' ? fUsd : fAmount} onChange={e => fMeans === 'USD' ? setFUsd(e.target.value) : setFAmount(e.target.value)} style={sty} />
                </div>
              </>
            )}

            <div>
              <label style={lbl}>Operador</label>
              <select value={fOperator} onChange={e => setFOperator(e.target.value)} style={sty}>
                <option value="">Seleccionar...</option>
                {operators.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            </div>
          </div>
          ) })()}
          {fSource === 'AJUSTE' && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3D4356', marginBottom: 5 }}>Motivo del ajuste (obligatorio)</label>
              <input value={ajMotivo} onChange={e => setAjMotivo(e.target.value)} placeholder="Ej: diferencia detectada en el arqueo del cierre" style={{ width: '100%', padding: 9, border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 13, background: '#FBFBFD' }} />
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3D4356', marginBottom: 5 }}>{fSource === 'CAMBIO' || fSource === 'AJUSTE' ? 'Observaciones (opcional)' : 'Descripción'}</label>
            <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder={fSource === 'GASTO' ? 'Ej: Alquiler del local' : 'Ej: en la casa de cambio de la esquina'} style={{ width: '100%', padding: 9, border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 13, background: '#FBFBFD' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={submit} style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Registrar</button>
            <button onClick={() => setShowForm(false)} style={{ background: '#EEEFF5', color: '#333', border: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); load(1, means, e.target.value) }} placeholder="Buscar por descripción, operación o módulo..." style={{ flex: 1, minWidth: 200, padding: 10, border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 13, background: '#fff' }} />
        <select value={means} onChange={e => { setMeans(e.target.value); load(1, e.target.value, search) }} style={{ padding: 10, border: '1.5px solid #E6E7F0', borderRadius: 9, fontSize: 13, background: '#fff' }}>
          <option value="">Todos los medios</option>
          {Object.entries(MEANS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Tabla libro diario */}
      <div style={{ background: '#fff', border: '1px solid #E6E7F0', borderRadius: 14, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', boxShadow: '0 1px 2px rgba(23,23,45,.04)' }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1A5276', color: '#fff' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Operación</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Descripción</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Tipo</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Medio</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Monto</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Operador</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #EEF0F5' }}>
                <td style={{ padding: '9px 14px', fontWeight: 600 }}>{e.operationId || e.source}</td>
                <td style={{ padding: '9px 14px', color: '#3D4356' }}>{e.description}</td>
                <td style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {e.type === 'INGRESO' ? svg.ingreso : e.type === 'EGRESO' ? svg.egreso : svg.neutro}
                  <span style={{ color: e.type === 'INGRESO' ? '#0F9D58' : e.type === 'EGRESO' ? '#DC2626' : '#6B7280', fontWeight: 600 }}>{TYPE_LABEL[e.type]}</span>
                </td>
                <td style={{ padding: '9px 14px', color: '#6B7280' }}>{MEANS_LABEL[e.means] || e.means}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#181B2E' }}>
                  {e.means === 'USD' && e.amountUsd != null ? fmtUsd(e.amountUsd) : fmt(e.amount)}
                </td>
                <td style={{ padding: '9px 14px', color: '#6B7280' }}>{e.operator || '—'}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#9AA1B2' }}>Sin movimientos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '14px 4px', fontSize: 13, color: '#6B7280' }}>
        <span>{total} movimientos</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => load(page - 1)} disabled={page <= 1} style={{ padding: '7px 14px', border: '1px solid #E6E7F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Anterior</button>
          <span>Pág {page} de {totalPages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= totalPages} style={{ padding: '7px 14px', border: '1px solid #E6E7F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Siguiente →</button>
        </span>
      </div>
    </div>
  )
}
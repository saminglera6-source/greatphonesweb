/**
 * Carga la configuración del ERP que no cubre seed-precios / seed-taller:
 *   - Operadores (lista fija)
 *   - Feriados nacionales de Argentina (para el plazo de entrega de preventas)
 *   - AppConfig: PREVENTA_PLAZO (7 a 10 días hábiles)
 *   - Tarifario Icare, procesado desde el CSV crudo de Icare
 *
 * Idempotente: cada bloque se saltea si ya hay datos.
 * Uso:  node scripts/seed-erp.mjs [ruta/al/icare.csv]
 */
import 'dotenv/config'
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 8000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// ─────────────────────────────────────────────────────────────
const OPERADORES = ['Martin', 'Maca', 'Sam', 'Eva', 'Buda']

// Feriados nacionales inamovibles de Argentina 2026-2027 (los trasladables y
// puentes turísticos se agregan desde el panel: Preventas → Configurar feriados).
const FERIADOS = [
  ['2026-01-01', 'Año Nuevo'],
  ['2026-02-16', 'Carnaval'],
  ['2026-02-17', 'Carnaval'],
  ['2026-03-24', 'Día de la Memoria'],
  ['2026-04-02', 'Día del Veterano y de los Caídos en Malvinas'],
  ['2026-04-03', 'Viernes Santo'],
  ['2026-05-01', 'Día del Trabajador'],
  ['2026-05-25', 'Día de la Revolución de Mayo'],
  ['2026-06-15', 'Paso a la Inmortalidad del Gral. Güemes (traslado)'],
  ['2026-06-20', 'Paso a la Inmortalidad del Gral. Belgrano'],
  ['2026-07-09', 'Día de la Independencia'],
  ['2026-08-17', 'Paso a la Inmortalidad del Gral. San Martín'],
  ['2026-10-12', 'Día del Respeto a la Diversidad Cultural'],
  ['2026-11-23', 'Día de la Soberanía Nacional (traslado)'],
  ['2026-12-08', 'Inmaculada Concepción de María'],
  ['2026-12-25', 'Navidad'],
  ['2027-01-01', 'Año Nuevo'],
  ['2027-02-08', 'Carnaval'],
  ['2027-02-09', 'Carnaval'],
  ['2027-03-24', 'Día de la Memoria'],
  ['2027-03-26', 'Viernes Santo'],
  ['2027-04-02', 'Día del Veterano y de los Caídos en Malvinas'],
  ['2027-05-01', 'Día del Trabajador'],
  ['2027-05-25', 'Día de la Revolución de Mayo'],
  ['2027-06-20', 'Paso a la Inmortalidad del Gral. Belgrano'],
  ['2027-07-09', 'Día de la Independencia'],
  ['2027-08-17', 'Paso a la Inmortalidad del Gral. San Martín'],
  ['2027-10-12', 'Día del Respeto a la Diversidad Cultural'],
  ['2027-11-20', 'Día de la Soberanía Nacional'],
  ['2027-12-08', 'Inmaculada Concepción de María'],
  ['2027-12-25', 'Navidad'],
]

// ─── Icare: categorización de "Parte" (igual que tarifario_icare.gs) ──────────
function categorizarParte(raw) {
  const p = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (p.includes('bateria')) return 'bateria'
  if (p.includes('pantalla')) return 'pantalla'
  if (p.includes('camara') || p.includes('lente')) return 'camara'
  if (p.includes('microfono')) return 'microfono'
  if (p.includes('parlante')) return 'parlante'
  if (p.includes('vidrio trasero')) return 'tapa'
  if (p.includes('marco')) return 'marco'
  if (p.includes('flex de carga')) return 'flex'
  if (p.includes('pin de carga')) return 'pin'
  if (p.includes('boton')) return 'botones'
  if (p.includes('chasis')) return 'chasis'
  return null
}

function normalizarModelo(modelo) {
  return String(modelo || '')
    .toLowerCase()
    .replace(/\b\d+\s*(gb|tb)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parser CSV mínimo con comillas (suficiente para el export de Icare). */
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQ = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(x => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(x => x !== '')) rows.push(row) }
  return rows
}

async function seedOperadores() {
  const n = await prisma.operator.count()
  if (n > 0) return console.log(`Operadores: ya hay ${n}, se saltea`)
  await prisma.operator.createMany({ data: OPERADORES.map(name => ({ name, active: true })) })
  console.log(`Operadores: ${OPERADORES.length} cargados`)
}

async function seedFeriados() {
  const n = await prisma.holiday.count()
  if (n > 0) return console.log(`Feriados: ya hay ${n}, se saltea`)
  await prisma.holiday.createMany({
    data: FERIADOS.map(([date, label]) => ({ date: new Date(date + 'T00:00:00Z'), label })),
    skipDuplicates: true,
  })
  console.log(`Feriados: ${FERIADOS.length} cargados`)
}

async function seedAppConfig() {
  await prisma.appConfig.upsert({
    where: { key: 'PREVENTA_PLAZO' },
    update: {},
    create: { key: 'PREVENTA_PLAZO', value: { minDias: 7, maxDias: 10 } },
  })
  console.log('AppConfig: PREVENTA_PLAZO = 7 a 10 días hábiles')
}

async function seedIcare(csvPath) {
  const n = await prisma.icareTariff.count()
  if (n > 0) return console.log(`Icare: ya hay ${n} filas, se saltea`)
  if (!csvPath || !fs.existsSync(csvPath)) {
    return console.log(`Icare: no se encontró el CSV (${csvPath || 'sin ruta'}), se saltea`)
  }
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  const header = rows.shift() // Modelo, Parte, Precio, Disponibilidad
  const iM = header.findIndex(h => /modelo/i.test(h))
  const iP = header.findIndex(h => /parte|categor/i.test(h))
  const iPr = header.findIndex(h => /precio/i.test(h))

  // Agrupar por modelo+categoría, quedarse con el precio más alto entre variantes.
  const grupos = new Map()
  let descartadas = 0
  for (const r of rows) {
    const modelo = (r[iM] || '').trim()
    const cat = categorizarParte(r[iP])
    const precio = parseInt(String(r[iPr] || '').replace(/[^\d]/g, ''), 10)
    if (!modelo || !cat || !(precio > 0)) { descartadas++; continue }
    const k = `${modelo}||${cat}`
    if (!grupos.has(k) || grupos.get(k) < precio) grupos.set(k, precio)
  }

  const data = [...grupos.entries()].map(([k, precioGuia]) => {
    const [modelo, categoria] = k.split('||')
    return {
      modelo,
      categoria,
      modeloNorm: normalizarModelo(modelo),
      precioGuia,
      precioPublico: Math.round(precioGuia * 1.2),
      updatedAt: new Date(),
    }
  })
  await prisma.icareTariff.createMany({ data })
  console.log(`Icare: ${data.length} combinaciones modelo+categoría (${descartadas} filas sin categoría descartadas)`)
}

async function main() {
  const csvPath = process.argv[2] || '/Users/inglera/Downloads/recibo_preventa (1) 2/icare_precios_iphone.csv'
  await seedOperadores()
  await seedFeriados()
  await seedAppConfig()
  await seedIcare(csvPath)
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { normalizarModelo, precioPublicoIcare, REPARACIONES_ITEMS } from '@/lib/reparaciones'

/**
 * Tarifario del proveedor externo Icare (ERP §6.13).
 *  - GET             → filas cargadas
 *  - POST { csv }    → importa (reemplaza TODO el tarifario). Formato:
 *                      modelo,categoria,precioGuia   (una fila por línea, ; o , o TAB)
 *                      Si trae menos combinaciones que las cargadas, exige
 *                      { confirmar: true } (regla 113).
 *  - DELETE          → vacía el tarifario
 */

const CAT_KEYS = new Set<string>(REPARACIONES_ITEMS.map(i => i.key))
const CAT_ALIASES: Record<string, string> = {
  bat: 'bateria', 'batería': 'bateria', 'pin_de_carga': 'pin', 'pin de carga': 'pin',
  'tapa trasera': 'tapa', 'flex de carga': 'flex', 'botones laterales': 'botones',
}

function normCat(raw: string): string | null {
  const c = raw.trim().toLowerCase()
  if (CAT_KEYS.has(c)) return c
  const alias = CAT_ALIASES[c]
  if (alias && CAT_KEYS.has(alias)) return alias
  return null
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const rows = await prisma.icareTariff.findMany({ orderBy: [{ modelo: 'asc' }, { categoria: 'asc' }] })
    return NextResponse.json({
      count: rows.length,
      rows,
      categorias: REPARACIONES_ITEMS.map(i => ({ key: i.key, label: i.label })),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const csv: string = body?.csv || ''
    if (!csv.trim()) return NextResponse.json({ error: 'Pegá el contenido del tarifario' }, { status: 400 })

    const lineas = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const parsed: { modelo: string; categoria: string; precioGuia: number }[] = []
    const errores: string[] = []
    for (const l of lineas) {
      const cols = l.split(/[;,\t]/).map(c => c.trim())
      if (cols.length < 3) continue
      const [modelo, catRaw, precioRaw] = cols
      if (/modelo/i.test(modelo) && /categor/i.test(catRaw)) continue // header
      const cat = normCat(catRaw)
      const precio = parseInt(precioRaw.replace(/[^\d]/g, ''), 10)
      if (!modelo || !cat || !(precio > 0)) {
        errores.push(l)
        continue
      }
      parsed.push({ modelo, categoria: cat, precioGuia: precio })
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No se pudo interpretar ninguna fila válida', errores }, { status: 400 })
    }

    // Regla 113: si el archivo trae menos combinaciones que las cargadas, confirmar.
    const actual = await prisma.icareTariff.count()
    if (actual > 0 && parsed.length < actual && !body?.confirmar) {
      return NextResponse.json(
        {
          needsConfirm: true,
          error: `El archivo trae ${parsed.length} filas y hoy hay ${actual}. Confirmá para reemplazar igual (podrías estar cargando un archivo parcial).`,
        },
        { status: 409 },
      )
    }

    // Regla 112: reemplaza todo.
    await prisma.$transaction(async tx => {
      await tx.icareTariff.deleteMany({})
      await tx.icareTariff.createMany({
        data: parsed.map(p => ({
          modelo: p.modelo,
          categoria: p.categoria,
          modeloNorm: normalizarModelo(p.modelo),
          precioGuia: p.precioGuia,
          precioPublico: precioPublicoIcare(p.precioGuia),
          updatedAt: new Date(),
        })),
      })
    })

    return NextResponse.json({ ok: true, importadas: parsed.length, descartadas: errores.length })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request)
    await prisma.icareTariff.deleteMany({})
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}

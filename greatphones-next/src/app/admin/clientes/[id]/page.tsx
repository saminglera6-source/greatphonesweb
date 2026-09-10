import FichaClienteClient from './FichaClienteClient'
export const dynamic = 'force-dynamic'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FichaClienteClient id={id} />
}

import { createFileRoute } from '@tanstack/react-router'
import { Transacoes } from '../components/Transacoes'

export const Route = createFileRoute('/lotes/$loteId')({ component: PaginaLote })

function PaginaLote() {
  const loteId = Number(Route.useParams().loteId)
  return <Transacoes key={loteId} loteId={loteId} />
}

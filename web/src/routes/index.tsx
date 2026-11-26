import { createFileRoute } from '@tanstack/react-router'
import { Transacoes } from '../components/Transacoes'

export const Route = createFileRoute('/')({ component: () => <Transacoes /> })

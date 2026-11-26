import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useNavigate,
} from '@tanstack/react-router'
import { useState } from 'react'
import { criarLote, listarLotes } from '../server/funcoes'

import appCss from '../estilo.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Validação de transações' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: Documento,
  component: Layout,
})

function Documento({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function Layout() {
  return (
    <div className="app">
      <Lateral />
      <main>
        <Outlet />
      </main>
    </div>
  )
}

function Lateral() {
  const lotes = useQuery({ queryKey: ['lotes'], queryFn: () => listarLotes() })
  const total = lotes.data?.reduce((soma, l) => soma + l.totalTransacoes, 0)

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [nome, setNome] = useState<string>()
  const criar = useMutation({
    mutationFn: (nome: string) => criarLote({ data: { nome } }),
    onSuccess: async ({ id }) => {
      setNome(undefined)
      await queryClient.invalidateQueries({ queryKey: ['lotes'] })
      navigate({ to: '/lotes/$loteId', params: { loteId: String(id) } })
    },
  })

  return (
    <nav className="lateral" aria-label="Lotes e configuração">
      <p className="marca">Validação de transações</p>

      <p className="grupo">Lotes</p>
      <ul>
        <li>
          <Link to="/" activeOptions={{ exact: true }}>
            Todas as transações <span>{total}</span>
          </Link>
        </li>
        {lotes.data?.map((l) => (
          <li key={l.id}>
            <Link to="/lotes/$loteId" params={{ loteId: String(l.id) }}>
              {l.nome} <span>{l.totalTransacoes}</span>
            </Link>
          </li>
        ))}
      </ul>
      {nome === undefined ? (
        <button type="button" className="novo-lote" onClick={() => setNome('')}>
          + Novo lote
        </button>
      ) : (
        <form
          className="novo-lote"
          onSubmit={(e) => {
            e.preventDefault()
            criar.mutate(nome)
          }}
        >
          <input
            autoFocus
            required
            aria-label="Nome do novo lote"
            placeholder="Nome do lote"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNome(undefined)}
          />
          {criar.error && <p className="erro">{criar.error.message}</p>}
        </form>
      )}
      {lotes.isError && <p className="erro">{lotes.error.message}</p>}

      <ul className="rodape">
        <li>
          <Link to="/configuracao">Configuração</Link>
        </li>
      </ul>
    </nav>
  )
}

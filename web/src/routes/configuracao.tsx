import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { reais } from '../formato'
import {
  excluirContaRisco,
  excluirLimite,
  lerConfiguracao,
  salvarAlerta,
  salvarContaRisco,
  salvarLimite,
} from '../server/funcoes'

export const Route = createFileRoute('/configuracao')({ component: PaginaConfiguracao })

function useAlteracao<T>(fn: (d: T) => Promise<unknown>, depois?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      depois?.()
      return queryClient.invalidateQueries({ queryKey: ['configuracao'] })
    },
  })
}

type EdicaoLimite = { categoriaOriginal?: string; categoria: string; limite: string }

function PaginaConfiguracao() {
  const configuracao = useQuery({ queryKey: ['configuracao'], queryFn: () => lerConfiguracao() })

  const [limite, setLimite] = useState<EdicaoLimite>()
  const salvaLimite = useAlteracao(
    (l: EdicaoLimite) => salvarLimite({ data: { ...l, limite: Number(l.limite) } }),
    () => setLimite(undefined),
  )
  const excluiLimite = useAlteracao(
    (categoria: string) => excluirLimite({ data: { categoria } }),
    () => setLimite(undefined),
  )

  const [conta, setConta] = useState('')
  const salvaConta = useAlteracao(() => salvarContaRisco({ data: { conta } }), () => setConta(''))
  const excluiConta = useAlteracao((conta: string) => excluirContaRisco({ data: { conta } }))

  const salvaAlerta = useAlteracao((alertaRisco: number) => salvarAlerta({ data: { alertaRisco } }))

  if (configuracao.isPending) return <p className="sozinho">Carregando…</p>
  if (configuracao.isError) return <p className="erro sozinho">{configuracao.error.message}</p>
  const { limites, contasRisco, alertaRisco } = configuracao.data
  const erroLimite = salvaLimite.error ?? excluiLimite.error
  const erroConta = salvaConta.error ?? excluiConta.error

  const linhaLimite = (original?: string) =>
    limite && (
      <tr className="editando" key={original ?? 'novo'} onKeyDown={(e) => e.key === 'Escape' && setLimite(undefined)}>
        <td>
          <input
            form="limite"
            required
            autoFocus
            aria-label="Categoria"
            value={limite.categoria}
            onChange={(e) => setLimite({ ...limite, categoria: e.target.value })}
          />
        </td>
        <td className="num">
          <input
            form="limite"
            required
            type="number"
            step="0.01"
            aria-label="Limite em reais"
            value={limite.limite}
            onChange={(e) => setLimite({ ...limite, limite: e.target.value })}
          />
        </td>
        <td className="acoes">
          <button type="submit" form="limite" className="primario" disabled={salvaLimite.isPending}>
            Salvar
          </button>
          <button type="button" className="texto" onClick={() => setLimite(undefined)}>
            Cancelar
          </button>
          {original && (
            <button
              type="button"
              className="texto perigo"
              onClick={() =>
                window.confirm(`Excluir o limite da categoria ${original}?`) && excluiLimite.mutate(original)
              }
            >
              Excluir
            </button>
          )}
        </td>
      </tr>
    )

  return (
    <div className="configuracao">
      <header className="cabecalho">
        <div>
          <h1>Configuração</h1>
          <p className="meta">Vale para todos os envios ao Prolog, de qualquer lote.</p>
        </div>
      </header>

      <section>
        <div className="secao-topo">
          <h2>Limites por categoria</h2>
          <button
            type="button"
            disabled={limite !== undefined}
            onClick={() => {
              salvaLimite.reset()
              setLimite({ categoria: '', limite: '' })
            }}
          >
            Novo limite
          </button>
        </div>
        {erroLimite && <p className="erro">{erroLimite.message}</p>}
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th className="num">Limite</th>
              <th className="acoes">
                <span className="oculto">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {limite && limite.categoriaOriginal === undefined && linhaLimite()}
            {limites.map((l) =>
              limite?.categoriaOriginal === l.categoria ? (
                linhaLimite(l.categoria)
              ) : (
                <tr key={l.categoria}>
                  <td>{l.categoria}</td>
                  <td className="num">{reais(l.limite)}</td>
                  <td className="acoes">
                    <button
                      type="button"
                      className="texto"
                      onClick={() => {
                        salvaLimite.reset()
                        setLimite({ categoriaOriginal: l.categoria, categoria: l.categoria, limite: String(l.limite) })
                      }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ),
            )}
            {limites.length === 0 && !limite && (
              <tr>
                <td colSpan={3} className="vazio">
                  Nenhum limite cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form
          id="limite"
          onSubmit={(e) => {
            e.preventDefault()
            if (limite) salvaLimite.mutate(limite)
          }}
        />
      </section>

      <section>
        <div className="secao-topo">
          <h2>Contas de risco</h2>
        </div>
        {erroConta && <p className="erro">{erroConta.message}</p>}
        <table>
          <tbody>
            {contasRisco.map((c) => (
              <tr key={c}>
                <td>{c}</td>
                <td className="acoes">
                  <button
                    type="button"
                    className="texto perigo"
                    onClick={() => window.confirm(`Tirar ${c} das contas de risco?`) && excluiConta.mutate(c)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <input
                  form="conta"
                  required
                  aria-label="Nova conta de risco"
                  placeholder="Nome da conta"
                  value={conta}
                  onChange={(e) => setConta(e.target.value)}
                />
              </td>
              <td className="acoes">
                <button type="submit" form="conta" disabled={salvaConta.isPending}>
                  Adicionar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <form
          id="conta"
          onSubmit={(e) => {
            e.preventDefault()
            salvaConta.mutate(undefined)
          }}
        />
      </section>

      <section>
        <div className="secao-topo">
          <h2>Valor de alerta</h2>
        </div>
        <p className="meta">Usado pelo Prolog na regra de conta de risco.</p>
        <form
          key={alertaRisco}
          className="alerta"
          onSubmit={(e) => {
            e.preventDefault()
            salvaAlerta.mutate(Number(new FormData(e.currentTarget).get('alerta')))
          }}
        >
          <label>
            <span className="oculto">Valor de alerta em reais</span>
            <span className="prefixo">R$</span>
            <input required name="alerta" type="number" step="0.01" defaultValue={alertaRisco} />
          </label>
          <button type="submit" disabled={salvaAlerta.isPending}>
            Salvar
          </button>
        </form>
        {salvaAlerta.error && <p className="erro">{salvaAlerta.error.message}</p>}
      </section>
    </div>
  )
}

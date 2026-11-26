import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { contar, reais } from '../formato'
import {
  excluirLote,
  excluirTransacao,
  listarLotes,
  listarTransacoes,
  renomearLote,
  salvarTransacao,
  validarLote,
  type Linha,
  type Relatorio,
  type Transacao,
} from '../server/funcoes'
import { ROTULOS, Resposta } from './Resposta'

type Campos = { loteId: string; id: string; origem: string; destino: string; valor: string; categoria: string }
type Edicao = { ref?: string; idOriginal?: string; campos: Campos }

const assinatura = (ts: Transacao[]) =>
  JSON.stringify(ts.map((t) => [t.id, t.origem, t.destino, t.valor, t.categoria]))

export function Transacoes({ loteId }: { loteId?: number }) {
  const geral = loteId === undefined
  const lotes = useQuery({ queryKey: ['lotes'], queryFn: () => listarLotes() })
  const transacoes = useQuery({
    queryKey: ['transacoes', loteId ?? 'todas'],
    queryFn: () => listarTransacoes({ data: { loteId } }),
  })
  const lista = transacoes.data ?? []

  const queryClient = useQueryClient()
  const atualizar = () =>
    Promise.all(
      [['transacoes'], ['lotes']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )

  const [desmarcadas, setDesmarcadas] = useState(new Set<string>())
  const selecionadas = lista.filter((t) => !desmarcadas.has(t.ref))
  const todas = lista.length > 0 && selecionadas.length === lista.length
  const alternar = (ref: string) =>
    setDesmarcadas((d) => {
      const nova = new Set(d)
      if (!nova.delete(ref)) nova.add(ref)
      return nova
    })

  const [relatorio, setRelatorio] = useState<Relatorio>()
  const enviar = useMutation({
    mutationFn: (refs: string[]) => validarLote({ data: { loteId, refs } }),
    onSuccess: setRelatorio,
  })
  const desatualizado =
    relatorio !== undefined &&
    assinatura(relatorio.lote.transacoes) !== assinatura(selecionadas.map((t) => ({ ...t, id: t.ref })))
  const enviadas = new Set(relatorio?.lote.transacoes.map((t) => t.id))
  const achadosPorLinha = new Map<string, Set<string>>()
  for (const a of relatorio?.achados ?? [])
    for (const ref of a.regra === 'ciclo' ? a.transacoes : [a.transacao])
      achadosPorLinha.set(ref, (achadosPorLinha.get(ref) ?? new Set()).add(ROTULOS[a.regra] ?? a.regra))

  const [edicao, setEdicao] = useState<Edicao>()
  const fechar = () => setEdicao(undefined)
  const nova = () => {
    salvar.reset()
    setEdicao({
      campos: { loteId: String(loteId ?? lotes.data?.[0]?.id ?? ''), id: '', origem: '', destino: '', valor: '', categoria: '' },
    })
  }
  const editar = (t: Linha) => {
    salvar.reset()
    setEdicao({
      ref: t.ref,
      idOriginal: t.id,
      campos: { ...t, loteId: String(t.loteId), valor: String(t.valor) },
    })
  }
  const salvar = useMutation({
    mutationFn: ({ idOriginal, campos }: Edicao) =>
      salvarTransacao({
        data: { ...campos, idOriginal, loteId: Number(campos.loteId), valor: Number(campos.valor) },
      }),
    onSuccess: () => {
      fechar()
      return atualizar()
    },
  })
  const excluir = useMutation({
    mutationFn: (t: Linha) => excluirTransacao({ data: { loteId: t.loteId, id: t.id } }),
    onSuccess: () => {
      fechar()
      return atualizar()
    },
  })

  const navigate = useNavigate()
  const [novoNome, setNovoNome] = useState<string>()
  const renomear = useMutation({
    mutationFn: (nome: string) => renomearLote({ data: { id: loteId!, nome } }),
    onSuccess: () => {
      setNovoNome(undefined)
      return atualizar()
    },
  })
  const apagarLote = useMutation({
    mutationFn: () => excluirLote({ data: { id: loteId! } }),
    onSuccess: async () => {
      await atualizar()
      navigate({ to: '/' })
    },
  })

  const erro = salvar.error ?? excluir.error ?? renomear.error ?? apagarLote.error
  const lote = lotes.data?.find((l) => l.id === loteId)
  if (!geral && lotes.isSuccess && !lote)
    return (
      <p className="sozinho">
        Este lote não existe mais. <Link to="/">Ver todas as transações</Link>
      </p>
    )

  const colunas = 6 + (geral ? 1 : 0) + (relatorio ? 1 : 0) + 1
  const linhaEdicao = (t?: Linha) =>
    edicao && (
      <LinhaEdicao
        key={t?.ref ?? 'nova'}
        linha={t}
        geral={geral}
        lotes={lotes.data ?? []}
        comResultado={relatorio !== undefined}
        edicao={edicao}
        mudar={(campo, valor) => setEdicao({ ...edicao, campos: { ...edicao.campos, [campo]: valor } })}
        cancelar={fechar}
        excluir={() => t && window.confirm(`Excluir a transação ${t.id}?`) && excluir.mutate(t)}
        salvando={salvar.isPending}
      />
    )

  return (
    <>
      <header className="cabecalho">
        {novoNome === undefined ? (
          <div>
            <h1>{geral ? 'Todas as transações' : lote?.nome}</h1>
            <p className="meta">
              {contar(lista.length, 'transação', 'transações')}
              {geral && lotes.data && ` de ${contar(lotes.data.length, 'lote', 'lotes')}`}
            </p>
          </div>
        ) : (
          <form
            className="renomear"
            onSubmit={(e) => {
              e.preventDefault()
              renomear.mutate(novoNome)
            }}
          >
            <input
              autoFocus
              required
              aria-label="Novo nome do lote"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setNovoNome(undefined)}
            />
            <button type="submit" className="primario">
              Salvar nome
            </button>
            <button type="button" onClick={() => setNovoNome(undefined)}>
              Cancelar
            </button>
          </form>
        )}
        {!geral && lote && novoNome === undefined && (
          <div className="acoes-lote">
            <button type="button" className="texto" onClick={() => setNovoNome(lote.nome)}>
              Renomear
            </button>
            <button
              type="button"
              className="texto perigo"
              onClick={() =>
                window.confirm(
                  `Excluir o lote ${lote.nome} e ${contar(lote.totalTransacoes, 'transação', 'transações')}?`,
                ) && apagarLote.mutate()
              }
            >
              Excluir lote
            </button>
          </div>
        )}
      </header>

      <div className="area">
        <section className="dados" aria-label="Transações">
          <div className="barra">
            <button type="button" onClick={nova} disabled={edicao !== undefined || !lotes.data?.length}>
              Nova transação
            </button>
            <span className="contador">
              {selecionadas.length} de {lista.length} selecionadas
            </span>
            <button
              type="button"
              className="primario"
              disabled={enviar.isPending || selecionadas.length === 0}
              onClick={() => enviar.mutate(selecionadas.map((t) => t.ref))}
            >
              {enviar.isPending ? 'Validando…' : 'Validar'}
            </button>
          </div>
          {erro && <p className="erro">{erro.message}</p>}

          <div className="rolagem">
            <table className={desatualizado ? 'desatualizada' : undefined}>
              <thead>
                <tr>
                  <th className="sel">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas"
                      checked={todas}
                      ref={(el) => {
                        if (el) el.indeterminate = selecionadas.length > 0 && !todas
                      }}
                      onChange={() => setDesmarcadas(todas ? new Set(lista.map((t) => t.ref)) : new Set())}
                    />
                  </th>
                  {geral && <th>Lote</th>}
                  <th>ID</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th className="num">Valor</th>
                  <th>Categoria</th>
                  {relatorio && <th>Resultado</th>}
                  <th className="acoes">
                    <span className="oculto">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {edicao && edicao.ref === undefined && linhaEdicao()}
                {lista.map((t) => {
                  if (edicao?.ref === t.ref) return linhaEdicao(t)
                  const achados = achadosPorLinha.get(t.ref)
                  return (
                    <tr
                      key={t.ref}
                      className={desmarcadas.has(t.ref) ? 'desmarcada' : undefined}
                      onClick={(e) => (e.target as HTMLElement).closest('button, input') || alternar(t.ref)}
                    >
                      <td className="sel">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${t.ref}`}
                          checked={!desmarcadas.has(t.ref)}
                          onChange={() => alternar(t.ref)}
                        />
                      </td>
                      {geral && <td className="suave">{t.lote}</td>}
                      <td>{t.id}</td>
                      <td>{t.origem}</td>
                      <td>{t.destino}</td>
                      <td className="num">{reais(t.valor)}</td>
                      <td>{t.categoria}</td>
                      {relatorio && (
                        <td className={achados ? 'resultado com-achado' : 'resultado'}>
                          {achados
                            ? [...achados].join(', ')
                            : enviadas.has(t.ref)
                              ? 'Sem achados'
                              : 'Não enviada'}
                        </td>
                      )}
                      <td className="acoes">
                        <button type="button" className="texto" onClick={() => editar(t)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {transacoes.isSuccess && lista.length === 0 && !edicao && (
                  <tr>
                    <td colSpan={colunas} className="vazio">
                      Nenhuma transação {geral ? 'cadastrada' : 'neste lote'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {transacoes.isPending && <p className="sozinho">Carregando…</p>}
          {transacoes.isError && <p className="erro">{transacoes.error.message}</p>}
        </section>

        <Resposta
          relatorio={relatorio}
          erro={enviar.error}
          pendente={enviar.isPending}
          desatualizado={desatualizado}
        />
      </div>

      <form
        id="edicao"
        onSubmit={(e) => {
          e.preventDefault()
          if (edicao) salvar.mutate(edicao)
        }}
      />
    </>
  )
}

function LinhaEdicao({
  linha,
  geral,
  lotes,
  comResultado,
  edicao,
  mudar,
  cancelar,
  excluir,
  salvando,
}: {
  linha?: Linha
  geral: boolean
  lotes: { id: number; nome: string }[]
  comResultado: boolean
  edicao: Edicao
  mudar: (campo: keyof Campos, valor: string) => void
  cancelar: () => void
  excluir: () => void
  salvando: boolean
}) {
  const campo = (nome: keyof Campos, rotulo: string) => ({
    form: 'edicao',
    required: true,
    'aria-label': rotulo,
    value: edicao.campos[nome],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => mudar(nome, e.target.value),
  })

  return (
    <tr className="editando" onKeyDown={(e) => e.key === 'Escape' && cancelar()}>
      <td className="sel" />
      {geral && (
        <td>
          {linha ? (
            linha.lote
          ) : (
            <select {...campo('loteId', 'Lote')}>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          )}
        </td>
      )}
      <td>
        <input autoFocus {...campo('id', 'ID')} />
      </td>
      <td>
        <input {...campo('origem', 'Origem')} />
      </td>
      <td>
        <input {...campo('destino', 'Destino')} />
      </td>
      <td className="num">
        <input type="number" step="0.01" {...campo('valor', 'Valor em reais')} />
      </td>
      <td>
        <input {...campo('categoria', 'Categoria')} />
      </td>
      <td className="acoes" colSpan={comResultado ? 2 : 1}>
        <button type="submit" form="edicao" className="primario" disabled={salvando}>
          Salvar
        </button>
        <button type="button" className="texto" onClick={cancelar}>
          Cancelar
        </button>
        {linha && (
          <button type="button" className="texto perigo" onClick={excluir}>
            Excluir
          </button>
        )}
      </td>
    </tr>
  )
}

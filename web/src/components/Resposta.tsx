import { useState } from 'react'
import { contar } from '../formato'
import type { Relatorio } from '../server/funcoes'
import { Grafo } from './Grafo'

export const ROTULOS: Record<string, string> = {
  limite_categoria: 'Acima do limite',
  conta_risco: 'Conta de risco',
  autotransferencia: 'Autotransferência',
  valor_invalido: 'Valor inválido',
  ciclo: 'Ciclo',
}

const hora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' })

const atomo = (t: string) => (/^[a-z][a-zA-Z0-9_]*$/.test(t) ? t : `'${t.replace(/'/g, "\\'")}'`)
const fatos = ({ limites, contas_risco, alerta_risco, transacoes }: Relatorio['lote']) =>
  [
    ...limites.map((l) => `limite_categoria(${atomo(l.categoria)}, ${l.limite}).`),
    ...contas_risco.map((c) => `conta_risco(${atomo(c)}).`),
    `alerta_risco(${alerta_risco}).`,
    ...transacoes.map(
      (t) =>
        `transacao(${atomo(t.id)}, ${atomo(t.origem)}, ${atomo(t.destino)}, ${t.valor}, ${atomo(t.categoria)}).`,
    ),
    '',
    '% consulta: diagnostico(Achados).',
  ].join('\n')

type Aba = 'achados' | 'grafo' | 'fatos'

export function Resposta({
  relatorio,
  erro,
  pendente,
  desatualizado,
}: {
  relatorio?: Relatorio
  erro: Error | null
  pendente: boolean
  desatualizado: boolean
}) {
  const [aba, setAba] = useState<Aba>('achados')
  const botaoAba = (id: Aba, rotulo: string, numero?: number) => (
    <button type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>
      {rotulo}
      {numero !== undefined && <span className="numero">{numero}</span>}
    </button>
  )

  return (
    <section className="resposta" aria-label="Resultado da Validação" aria-busy={pendente}>
      <div className="resposta-topo">
        <h2>Resultado da Validação</h2>
        {relatorio && (
          <span className="meta">
            Validado às {hora.format(new Date(relatorio.validadoEm))}
          </span>
        )}
      </div>

      {erro && <p className="aviso perigo">Não foi possível validar. {erro.message}</p>}
      {relatorio && desatualizado && (
        <p className="aviso">A seleção ou as transações mudaram desde a validação. Valide de novo para atualizar.</p>
      )}

      {!relatorio ? (
        !erro && (
          <p className="vazio">
            Selecione as transações e clique em Validar. O resultado aparece aqui.
          </p>
        )
      ) : (
        <>
          <div role="tablist" className="abas">
            {botaoAba('achados', 'Achados', relatorio.achados.length)}
            {botaoAba('grafo', 'Grafo')}
            {botaoAba('fatos', 'Fatos enviados', relatorio.lote.transacoes.length)}
          </div>
          <div role="tabpanel" className={pendente ? 'painel pendente' : 'painel'}>
            {aba === 'achados' && <Achados relatorio={relatorio} />}
            {aba === 'grafo' && (
              <>
                <Grafo
                  transacoes={relatorio.lote.transacoes}
                  achados={relatorio.achados}
                  contasRisco={relatorio.lote.contas_risco}
                />
                <ul className="legenda">
                  <li className="l-ciclo">em ciclo</li>
                  <li className="l-achado">com achado</li>
                  <li className="l-risco">conta de risco</li>
                </ul>
              </>
            )}
            {aba === 'fatos' && (
              <pre>
                <code>{fatos(relatorio.lote)}</code>
              </pre>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function Achados({ relatorio: { achados, lote } }: { relatorio: Relatorio }) {
  if (achados.length === 0)
    return (
      <p className="vazio">
        Nenhum achado. O Prolog não apontou problema em{' '}
        {contar(lote.transacoes.length, 'transação enviada', 'transações enviadas')}.
      </p>
    )

  return (
    <div className="rolagem">
      <table className="achados">
        <thead>
          <tr>
            <th>Transação</th>
            <th>Regra</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {achados.map((a, i) => (
            <tr key={i}>
              <td>{a.regra === 'ciclo' ? a.transacoes.join(', ') : a.transacao}</td>
              <td title={a.regra}>{ROTULOS[a.regra] ?? a.regra}</td>
              <td>{a.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { createServerFn } from '@tanstack/react-start'
import { sql } from './db'

export type Transacao = { id: string; origem: string; destino: string; valor: number; categoria: string }
export type Achado =
  | {
      regra: 'limite_categoria' | 'conta_risco' | 'autotransferencia' | 'valor_invalido'
      transacao: string
      motivo: string
    }
  | { regra: 'ciclo'; contas: string[]; transacoes: string[]; motivo: string }

function texto(v: unknown, campo: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`Preencha o campo ${campo}`)
  return v.trim()
}

function numero(v: unknown, campo: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`O campo ${campo} deve ser um número`)
  return v
}

function inteiro(v: unknown, campo: string): number {
  if (!Number.isInteger(v)) throw new Error(`O campo ${campo} deve ser um número inteiro`)
  return v as number
}

async function duplicado<T>(consulta: PromiseLike<T>, mensagem: string): Promise<T> {
  try {
    return await consulta
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new Error(mensagem)
    throw e
  }
}

export const listarLotes = createServerFn({ method: 'GET' }).handler(async () => [
  ...(await sql<{ id: number; nome: string; totalTransacoes: number }[]>`
    select l.id, l.nome, count(t.id)::int as "totalTransacoes"
    from lotes l left join transacoes t on t.lote_id = l.id
    group by l.id order by l.id`),
])

export type Linha = Transacao & { loteId: number; lote: string; ref: string }

const linhas = async (loteId?: number): Promise<Linha[]> =>
  (
    await sql<Omit<Linha, 'ref'>[]>`
      select t.lote_id as "loteId", l.nome as lote, t.id, t.origem, t.destino,
             t.valor::float8 as valor, t.categoria
      from transacoes t join lotes l on l.id = t.lote_id
      where ${loteId === undefined ? sql`true` : sql`t.lote_id = ${loteId}`}
      order by t.lote_id, t.ordem`
  ).map((t) => ({ ...t, ref: loteId === undefined ? `${t.lote}/${t.id}` : t.id }))

const loteOpcional = (d?: { loteId?: number }) => ({
  loteId: d?.loteId == null ? undefined : inteiro(d.loteId, 'loteId'),
})

export const listarTransacoes = createServerFn({ method: 'GET' })
  .validator(loteOpcional)
  .handler(({ data }) => linhas(data.loteId))

const NUCLEO = process.env.NUCLEO_URL ?? 'http://localhost:8080/validar'

export type Relatorio = {
  lote: {
    limites: { categoria: string; limite: number }[]
    contas_risco: string[]
    alerta_risco: number
    transacoes: Transacao[]
  }
  achados: Achado[]
  validadoEm: string
}

export const validarLote = createServerFn({ method: 'POST' })
  .validator((d: { loteId?: number; refs: string[] }) => {
    if (!Array.isArray(d?.refs)) throw new Error('Informe as transações selecionadas')
    return { ...loteOpcional(d), refs: d.refs.map((r) => texto(r, 'ID')) }
  })
  .handler(async ({ data }): Promise<Relatorio> => {
    const selecionadas = new Set(data.refs)
    const [limites, contas, [config], todas] = await Promise.all([
      sql<{ categoria: string; limite: number }[]>`
        select categoria, limite::float8 as limite from limites_categoria order by categoria`,
      sql<{ conta: string }[]>`select conta from contas_risco order by conta`,
      sql<{ alerta: number }[]>`select alerta_risco::float8 as alerta from configuracao`,
      linhas(data.loteId),
    ])
    const lote = {
      limites: [...limites],
      contas_risco: contas.map((c) => c.conta),
      alerta_risco: config.alerta,
      transacoes: todas
        .filter((t) => selecionadas.has(t.ref))
        .map((t) => ({ id: t.ref, origem: t.origem, destino: t.destino, valor: t.valor, categoria: t.categoria })),
    }

    let resposta: Response
    try {
      resposta = await fetch(NUCLEO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lote),
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      throw new Error('Núcleo indisponível: confira se swipl nucleo/servidor.pl está rodando')
    }
    if (resposta.status === 400) throw new Error((await resposta.json()).erro)
    if (!resposta.ok) throw new Error(`Núcleo respondeu com erro HTTP ${resposta.status}`)
    const { achados } = await resposta.json()
    return { lote, achados, validadoEm: new Date().toISOString() }
  })

export const lerConfiguracao = createServerFn({ method: 'GET' }).handler(async () => {
  const [limites, contas, [config]] = await Promise.all([
    sql<{ categoria: string; limite: number }[]>`
      select categoria, limite::float8 as limite from limites_categoria order by categoria`,
    sql<{ conta: string }[]>`select conta from contas_risco order by conta`,
    sql<{ alerta: number }[]>`select alerta_risco::float8 as alerta from configuracao`,
  ])
  return { limites: [...limites], contasRisco: contas.map((c) => c.conta), alertaRisco: config.alerta }
})

type EntradaTransacao = Transacao & { loteId: number; idOriginal?: string }

export const salvarTransacao = createServerFn({ method: 'POST' })
  .validator((d: EntradaTransacao) => ({
    loteId: inteiro(d?.loteId, 'loteId'),
    idOriginal: d?.idOriginal == null ? undefined : texto(d.idOriginal, 'ID original'),
    id: texto(d?.id, 'ID'),
    origem: texto(d?.origem, 'Origem'),
    destino: texto(d?.destino, 'Destino'),
    valor: numero(d?.valor, 'Valor'),
    categoria: texto(d?.categoria, 'Categoria'),
  }))
  .handler(async ({ data: t }) => {
    await duplicado(
      t.idOriginal === undefined
        ? sql`insert into transacoes (lote_id, id, origem, destino, valor, categoria)
              values (${t.loteId}, ${t.id}, ${t.origem}, ${t.destino}, ${t.valor}, ${t.categoria})`
        : sql`update transacoes
              set id = ${t.id}, origem = ${t.origem}, destino = ${t.destino},
                  valor = ${t.valor}, categoria = ${t.categoria}
              where lote_id = ${t.loteId} and id = ${t.idOriginal}`,
      `Já existe uma transação com o ID ${t.id} neste lote`,
    )
  })

export const excluirTransacao = createServerFn({ method: 'POST' })
  .validator((d: { loteId: number; id: string }) => ({
    loteId: inteiro(d?.loteId, 'loteId'),
    id: texto(d?.id, 'ID'),
  }))
  .handler(async ({ data }) => {
    await sql`delete from transacoes where lote_id = ${data.loteId} and id = ${data.id}`
  })

export const criarLote = createServerFn({ method: 'POST' })
  .validator((d: { nome: string }) => ({ nome: texto(d?.nome, 'nome') }))
  .handler(async ({ data }) => {
    const [lote] = await duplicado(
      sql<{ id: number }[]>`insert into lotes (nome) values (${data.nome}) returning id`,
      `Já existe um lote com o nome ${data.nome}`,
    )
    return { id: lote.id }
  })

export const renomearLote = createServerFn({ method: 'POST' })
  .validator((d: { id: number; nome: string }) => ({
    id: inteiro(d?.id, 'id'),
    nome: texto(d?.nome, 'nome'),
  }))
  .handler(async ({ data }) => {
    await duplicado(
      sql`update lotes set nome = ${data.nome} where id = ${data.id}`,
      `Já existe um lote com o nome ${data.nome}`,
    )
  })

export const excluirLote = createServerFn({ method: 'POST' })
  .validator((d: { id: number }) => ({ id: inteiro(d?.id, 'id') }))
  .handler(async ({ data }) => {
    await sql`delete from lotes where id = ${data.id}`
  })

export const salvarLimite = createServerFn({ method: 'POST' })
  .validator((d: { categoriaOriginal?: string; categoria: string; limite: number }) => ({
    categoriaOriginal:
      d?.categoriaOriginal == null ? undefined : texto(d.categoriaOriginal, 'categoria original'),
    categoria: texto(d?.categoria, 'Categoria'),
    limite: numero(d?.limite, 'Limite'),
  }))
  .handler(async ({ data: l }) => {
    await duplicado(
      l.categoriaOriginal === undefined
        ? sql`insert into limites_categoria values (${l.categoria}, ${l.limite})`
        : sql`update limites_categoria set categoria = ${l.categoria}, limite = ${l.limite}
              where categoria = ${l.categoriaOriginal}`,
      `Já existe um limite para a categoria ${l.categoria}`,
    )
  })

export const excluirLimite = createServerFn({ method: 'POST' })
  .validator((d: { categoria: string }) => ({ categoria: texto(d?.categoria, 'Categoria') }))
  .handler(async ({ data }) => {
    await sql`delete from limites_categoria where categoria = ${data.categoria}`
  })

export const salvarContaRisco = createServerFn({ method: 'POST' })
  .validator((d: { conta: string }) => ({ conta: texto(d?.conta, 'Conta') }))
  .handler(async ({ data }) => {
    await duplicado(
      sql`insert into contas_risco values (${data.conta})`,
      `A conta ${data.conta} já é de risco`,
    )
  })

export const excluirContaRisco = createServerFn({ method: 'POST' })
  .validator((d: { conta: string }) => ({ conta: texto(d?.conta, 'Conta') }))
  .handler(async ({ data }) => {
    await sql`delete from contas_risco where conta = ${data.conta}`
  })

export const salvarAlerta = createServerFn({ method: 'POST' })
  .validator((d: { alertaRisco: number }) => ({ alertaRisco: numero(d?.alertaRisco, 'Valor de alerta') }))
  .handler(async ({ data }) => {
    await sql`update configuracao set alerta_risco = ${data.alertaRisco}`
  })

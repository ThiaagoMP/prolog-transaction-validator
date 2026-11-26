create table lotes (
  id   serial primary key,
  nome text not null unique
);

create table transacoes (
  lote_id   int  not null references lotes(id) on delete cascade,
  id        text not null,
  origem    text not null,
  destino   text not null,
  valor     numeric(14,2) not null,
  categoria text not null,
  ordem     serial,
  primary key (lote_id, id)
);

create table limites_categoria (
  categoria text primary key,
  limite    numeric(14,2) not null
);

create table contas_risco (
  conta text primary key
);

create table configuracao (
  unica        boolean primary key default true check (unica),
  alerta_risco numeric(14,2) not null
);

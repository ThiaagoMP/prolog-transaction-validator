insert into limites_categoria values ('suprimentos', 50000), ('servicos', 10000);
insert into contas_risco values ('conta_fantasma');
insert into configuracao (alerta_risco) values (10000);

with l as (insert into lotes (nome) values ('proposta') returning id)
insert into transacoes (lote_id, id, origem, destino, valor, categoria)
select l.id, t.* from l, (values
  ('t1', 'pedro', 'bruno', 60000, 'suprimentos'),
  ('t2', 'bruno', 'bruno', 500, 'servicos'),
  ('t3', 'bruno', 'conta_fantasma', 15000, 'servicos'),
  ('t4', 'bruno', 'carla', 300, 'servicos'),
  ('t5', 'carla', 'pedro', 200, 'servicos'),
  ('t6', 'carla', 'davi', 0, 'servicos')
) as t(id, origem, destino, valor, categoria);

with l as (insert into lotes (nome) values ('limpo') returning id)
insert into transacoes (lote_id, id, origem, destino, valor, categoria)
select l.id, t.* from l, (values
  ('t1', 'ana', 'beto', 12000, 'suprimentos'),
  ('t2', 'beto', 'caio', 3500, 'servicos'),
  ('t3', 'caio', 'duda', 800, 'servicos'),
  ('t4', 'ana', 'conta_fantasma', 2000, 'servicos'),
  ('t5', 'duda', 'eva', 49999.90, 'suprimentos')
) as t(id, origem, destino, valor, categoria);

with l as (insert into lotes (nome) values ('ciclos') returning id)
insert into transacoes (lote_id, id, origem, destino, valor, categoria)
select l.id, t.* from l, (values
  ('t1', 'a', 'b', 1000, 'servicos'),
  ('t2', 'b', 'a', 400, 'servicos'),
  ('t3', 'b', 'c', 700, 'servicos'),
  ('t4', 'c', 'a', 300, 'servicos'),
  ('t5', 'd', 'e', 900, 'servicos'),
  ('t6', 'e', 'f', 600, 'servicos'),
  ('t7', 'f', 'e', 200, 'servicos')
) as t(id, origem, destino, valor, categoria);

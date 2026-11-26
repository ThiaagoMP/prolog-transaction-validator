limite_categoria(suprimentos, 50000).
limite_categoria(servicos, 10000).

conta_risco(conta_fantasma).

alerta_risco(10000).

transacao(t1, pedro, bruno, 60000, suprimentos).
transacao(t2, bruno, bruno, 500, servicos).
transacao(t3, bruno, conta_fantasma, 15000, servicos).
transacao(t4, bruno, carla, 300, servicos).
transacao(t5, carla, pedro, 200, servicos).
transacao(t6, carla, davi, 0, servicos).

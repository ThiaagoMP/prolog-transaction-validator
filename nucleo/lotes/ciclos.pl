limite_categoria(suprimentos, 50000).
limite_categoria(servicos, 10000).

conta_risco(conta_fantasma).

alerta_risco(10000).

transacao(t1, a, b, 1000, servicos).
transacao(t2, b, a, 400, servicos).
transacao(t3, b, c, 700, servicos).
transacao(t4, c, a, 300, servicos).
transacao(t5, d, e, 900, servicos).
transacao(t6, e, f, 600, servicos).
transacao(t7, f, e, 200, servicos).

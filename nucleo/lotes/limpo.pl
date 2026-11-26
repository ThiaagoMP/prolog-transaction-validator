limite_categoria(suprimentos, 50000).
limite_categoria(servicos, 10000).

conta_risco(conta_fantasma).

alerta_risco(10000).

transacao(t1, ana, beto, 12000, suprimentos).
transacao(t2, beto, caio, 3500, servicos).
transacao(t3, caio, duda, 800, servicos).
transacao(t4, ana, conta_fantasma, 2000, servicos).
transacao(t5, duda, eva, 49999.90, suprimentos).

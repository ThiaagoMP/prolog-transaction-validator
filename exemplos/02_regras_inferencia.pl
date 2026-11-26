transferencia(pedro, bruno, 500).
transferencia(bruno, carla, 300).
transferencia(bruno, davi, 15000).
conta_risco(davi).

suspeita(Origem, Destino) :-
    transferencia(Origem, Destino, Valor),
    conta_risco(Destino),
    Valor > 10000.

alerta(Conta) :- suspeita(Conta, _).

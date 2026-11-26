transferencia(pedro, bruno, 500).
transferencia(bruno, carla, 300).
transferencia(carla, davi, 15000).
conta_risco(davi).

alcanca(A, B) :- transferencia(A, B, _).
alcanca(A, B) :- transferencia(A, X, _), alcanca(X, B).

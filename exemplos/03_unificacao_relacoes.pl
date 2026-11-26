transferencia(pedro, bruno, 500).
transferencia(bruno, carla, 300).
transferencia(carla, carla, 50).

autotransferencia(Conta) :- transferencia(Conta, Conta, _).

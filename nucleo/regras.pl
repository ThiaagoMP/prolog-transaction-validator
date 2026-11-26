:- dynamic transacao/5, limite_categoria/2, conta_risco/1, alerta_risco/1.

validar(Fatos, Achados) :-
    with_mutex(lote,
               setup_call_cleanup(carregar(Fatos), diagnostico(Achados), limpar)).

carregar(Fatos) :-
    limpar,
    maplist(assertz, Fatos).

limpar :-
    retractall(transacao(_, _, _, _, _)),
    retractall(limite_categoria(_, _)),
    retractall(conta_risco(_)),
    retractall(alerta_risco(_)).

violacao(Id, limite_categoria, Motivo) :-
    transacao(Id, _, _, Valor, Categoria),
    limite_categoria(Categoria, Limite),
    Valor > Limite,
    reais(Valor, V),
    reais(Limite, L),
    format(atom(Motivo), 'R$ ~w passa do limite de R$ ~w da categoria ~w',
           [V, L, Categoria]).

violacao(Id, conta_risco, Motivo) :-
    transacao(Id, _, Destino, Valor, _),
    conta_risco(Destino),
    alerta_risco(Alerta),
    Valor > Alerta,
    reais(Valor, V),
    format(atom(Motivo), 'valor alto (R$ ~w) enviado para a conta de risco ~w',
           [V, Destino]).

violacao(Id, autotransferencia, Motivo) :-
    transacao(Id, Conta, Conta, _, _),
    format(atom(Motivo), 'origem e destino são a mesma conta (~w)', [Conta]).

violacao(Id, valor_invalido, Motivo) :-
    transacao(Id, _, _, Valor, _),
    Valor =< 0,
    reais(Valor, V),
    format(atom(Motivo), 'valor zerado ou negativo (R$ ~w)', [V]).

aresta(A, B) :-
    distinct(A-B, ( transacao(_, A, B, Valor, _), Valor > 0, A \== B )).

caminho(Atual, Inicio, _, [Inicio]) :-
    aresta(Atual, Inicio).
caminho(Atual, Inicio, Visitados, [Prox|Resto]) :-
    aresta(Atual, Prox),
    \+ memberchk(Prox, Visitados),
    caminho(Prox, Inicio, [Prox|Visitados], Resto).

ciclo([Inicio|Resto]) :-
    contas_do_lote(Contas),
    append(Antes, [Inicio|_], Contas),
    caminho(Inicio, Inicio, [Inicio|Antes], Resto).

contas_do_lote(Contas) :-
    findall(C, ( transacao(_, O, D, _, _), member(C, [O, D]) ), Todas),
    list_to_set(Todas, Contas).

transacoes_do_ciclo(Contas, Ids) :-
    pares(Contas, Pares),
    findall(Id, ( transacao(Id, A, B, Valor, _),
                  Valor > 0,
                  memberchk(A-B, Pares) ),
            Ids).

pares([A, B|Resto], [A-B|Pares]) :-
    pares([B|Resto], Pares).
pares([_], []).

motivo_ciclo([Inicio|Resto], Motivo) :-
    atomic_list_concat([Inicio|Resto], ' → ', Percurso),
    format(atom(Motivo), 'o dinheiro sai de ~w e volta para ~w (~w)',
           [Inicio, Inicio, Percurso]).

diagnostico(Achados) :-
    findall(achado(transacao(Id), Regra, Motivo),
            ( transacao(Id, _, _, _, _),
              violacao(Id, Regra, Motivo) ),
            PorTransacao),
    findall(achado(ciclo(Contas, Ids), ciclo, Motivo),
            ( ciclo(Contas),
              transacoes_do_ciclo(Contas, Ids),
              motivo_ciclo(Contas, Motivo) ),
            Ciclos),
    append(PorTransacao, Ciclos, Achados).

mostrar_diagnostico :-
    diagnostico(Achados),
    (   Achados == []
    ->  writeln('nenhum problema encontrado')
    ;   forall(member(A, Achados), mostrar_achado(A))
    ).

mostrar_achado(achado(transacao(Id), Regra, Motivo)) :-
    format('~w [~w] ~w~n', [Id, Regra, Motivo]).
mostrar_achado(achado(ciclo(_, Ids), ciclo, Motivo)) :-
    atomic_list_concat(Ids, ',', Item),
    format('~w [ciclo] ~w~n', [Item, Motivo]).

reais(Valor, Texto) :-
    (   Valor =:= truncate(Valor)
    ->  Inteiro is truncate(Valor),
        format(atom(EmIngles), '~D', [Inteiro])
    ;   Centavos is round(Valor * 100),
        format(atom(EmIngles), '~2D', [Centavos])
    ),
    atom_chars(EmIngles, Cs),
    maplist(troca_separador, Cs, Ts),
    atom_chars(Texto, Ts).

troca_separador(C, T) :-
    (   C == ','
    ->  T = '.'
    ;   C == '.'
    ->  T = ','
    ;   T = C
    ).

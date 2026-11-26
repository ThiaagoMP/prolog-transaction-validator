:- use_module(library(plunit)).
:- use_module(library(http/json)).
:- ensure_loaded(regras).
:- ensure_loaded(servidor).

lote(Nome, Fatos) :-
    source_file(lote(_, _), Este),
    file_directory_name(Este, Dir),
    format(atom(Arquivo), '~w/lotes/~w.pl', [Dir, Nome]),
    fatos_do_arquivo(Arquivo, Fatos).

fatos_do_arquivo(Arquivo, Fatos) :-
    setup_call_cleanup(open(Arquivo, read, In), ler_termos(In, Fatos), close(In)).

ler_termos(In, Termos) :-
    read_term(In, T, []),
    (   T == end_of_file
    ->  Termos = []
    ;   Termos = [T|Resto],
        ler_termos(In, Resto)
    ).

regras_de(Achados, Pares) :-
    findall(Id-R, member(achado(transacao(Id), R, _), Achados), Pares).

ciclos_de(Achados, Ciclos) :-
    findall(C-Ids, member(achado(ciclo(C, Ids), ciclo, _), Achados), Ciclos).

fatos_do_json(Texto, Fatos) :-
    opcoes_json(Opcoes),
    atom_json_dict(Texto, Lote, Opcoes),
    json_para_fatos(Lote, Fatos).

:- begin_tests(base).

test(reais_inteiro) :- reais(60000, T), T == '60.000'.
test(reais_centavos) :- reais(1500.5, T), T == '1.500,50'.
test(reais_zero) :- reais(0, T), T == '0'.
test(reais_negativo) :- reais(-10, T), T == '-10'.
test(lote_vazio) :- validar([], A), A == [].
test(limpa_depois) :-
    validar([transacao(x, a, b, 1, c)], _),
    \+ transacao(_, _, _, _, _).

:- end_tests(base).

:- begin_tests(regras).

test(limite_dispara) :-
    validar([limite_categoria(suprimentos, 50000),
             transacao(t1, pedro, bruno, 60000, suprimentos)], A),
    A == [achado(transacao(t1), limite_categoria,
                 'R$ 60.000 passa do limite de R$ 50.000 da categoria suprimentos')].
test(limite_igual_nao_dispara) :-
    validar([limite_categoria(c, 100), transacao(t1, a, b, 100, c)], []).
test(limite_categoria_sem_limite) :-
    validar([limite_categoria(outra, 10), transacao(t1, a, b, 100, c)], []).

test(risco_dispara) :-
    validar([conta_risco(conta_fantasma), alerta_risco(10000),
             transacao(t3, bruno, conta_fantasma, 15000, servicos)], A),
    A == [achado(transacao(t3), conta_risco,
                 'valor alto (R$ 15.000) enviado para a conta de risco conta_fantasma')].
test(risco_igual_nao_dispara) :-
    validar([conta_risco(x), alerta_risco(100), transacao(t1, a, x, 100, c)], []).
test(risco_fora_da_lista) :-
    validar([conta_risco(x), alerta_risco(100), transacao(t1, a, y, 500, c)], []).

test(autotransferencia_dispara) :-
    validar([transacao(t2, bruno, bruno, 500, servicos)], A),
    A == [achado(transacao(t2), autotransferencia,
                 'origem e destino são a mesma conta (bruno)')].
test(autotransferencia_nao_dispara) :-
    validar([transacao(t1, a, b, 1, c)], []).

test(valor_zero) :-
    validar([transacao(t6, carla, davi, 0, servicos)], A),
    A == [achado(transacao(t6), valor_invalido, 'valor zerado ou negativo (R$ 0)')].
test(valor_negativo) :-
    validar([transacao(t1, a, b, -10, c)], A),
    regras_de(A, [t1-valor_invalido]).
test(valor_centavo_nao_dispara) :-
    validar([transacao(t1, a, b, 0.01, c)], []).

test(duas_regras_mesma_transacao) :-
    validar([transacao(t1, a, a, 0, c)], A),
    regras_de(A, R),
    R == [t1-autotransferencia, t1-valor_invalido].
test(ordem_do_lote) :-
    validar([limite_categoria(c, 10),
             transacao(t1, a, b, 0, c),
             transacao(t2, a, b, 50, c)], A),
    regras_de(A, R),
    R == [t1-valor_invalido, t2-limite_categoria].
test(lotes_isolados) :-
    validar([limite_categoria(c, 100), transacao(t1, a, b, 500, c)], [_]),
    validar([transacao(t1, a, b, 500, c)], []).

test(lote_seed_transacoes) :-
    lote(seed, Fatos),
    validar(Fatos, A),
    regras_de(A, R),
    R == [t1-limite_categoria, t2-autotransferencia, t3-limite_categoria,
          t3-conta_risco, t6-valor_invalido].
test(lote_limpo) :-
    lote(limpo, Fatos),
    validar(Fatos, []).

:- end_tests(regras).

:- begin_tests(ciclos).

test(ida_e_volta) :-
    validar([transacao(t1, a, b, 10, x), transacao(t2, b, a, 10, x)], A),
    ciclos_de(A, C),
    C == [[a, b, a]-[t1, t2]].
test(triangulo_uma_vez) :-
    validar([transacao(t1, a, b, 10, x), transacao(t2, b, c, 10, x),
             transacao(t3, c, a, 10, x)], A),
    ciclos_de(A, C),
    C == [[a, b, c, a]-[t1, t2, t3]].
test(revisita_termina) :-
    validar([transacao(t1, a, b, 10, x), transacao(t2, b, c, 10, x),
             transacao(t3, c, b, 10, x)], A),
    ciclos_de(A, C),
    C == [[b, c, b]-[t2, t3]].
test(ciclos_com_contas_em_comum) :-
    validar([transacao(t1, a, b, 10, x), transacao(t2, b, a, 10, x),
             transacao(t3, b, c, 10, x), transacao(t4, c, a, 10, x)], A),
    ciclos_de(A, C),
    C == [[a, b, a]-[t1, t2], [a, b, c, a]-[t1, t3, t4]].
test(sem_ciclo) :-
    validar([transacao(t1, a, b, 10, x), transacao(t2, b, c, 10, x)], []).
test(autotransferencia_nao_e_ciclo) :-
    validar([transacao(t1, a, a, 10, x)], A),
    ciclos_de(A, []).
test(valor_zero_nao_fecha_ciclo) :-
    validar([transacao(t1, a, b, 10, x), transacao(t2, b, a, 0, x)], A),
    ciclos_de(A, []).
test(varias_transacoes_mesmo_par) :-
    validar([transacao(t1, a, b, 10, x), transacao(t2, a, b, 20, x),
             transacao(t3, b, a, 5, x)], A),
    ciclos_de(A, C),
    C == [[a, b, a]-[t1, t2, t3]].
test(motivo_do_ciclo) :-
    validar([transacao(t1, pedro, bruno, 10, x), transacao(t4, bruno, carla, 10, x),
             transacao(t5, carla, pedro, 10, x)], [achado(_, ciclo, M)]),
    M == 'o dinheiro sai de pedro e volta para pedro (pedro → bruno → carla → pedro)'.

test(lote_ciclos) :-
    lote(ciclos, Fatos),
    validar(Fatos, A),
    ciclos_de(A, C),
    C == [[a, b, a]-[t1, t2], [a, b, c, a]-[t1, t3, t4], [e, f, e]-[t6, t7]],
    length(A, 3).
test(lote_seed_completo) :-
    lote(seed, Fatos),
    validar(Fatos, A),
    length(A, 6),
    regras_de(A, R),
    R == [t1-limite_categoria, t2-autotransferencia, t3-limite_categoria,
          t3-conta_risco, t6-valor_invalido],
    last(A, achado(ciclo([pedro, bruno, carla, pedro], [t1, t4, t5]), ciclo, _)).

:- end_tests(ciclos).

:- begin_tests(entrada).

test(lote_da_proposta) :-
    fatos_do_json('{"limites": [{"categoria": "suprimentos", "limite": 50000},
                                {"categoria": "servicos", "limite": 10000}],
                    "contas_risco": ["conta_fantasma"],
                    "alerta_risco": 10000,
                    "transacoes": [
      {"id": "t1", "origem": "pedro", "destino": "bruno", "valor": 60000, "categoria": "suprimentos"},
      {"id": "t2", "origem": "bruno", "destino": "bruno", "valor": 500, "categoria": "servicos"},
      {"id": "t3", "origem": "bruno", "destino": "conta_fantasma", "valor": 15000, "categoria": "servicos"},
      {"id": "t4", "origem": "bruno", "destino": "carla", "valor": 300, "categoria": "servicos"},
      {"id": "t5", "origem": "carla", "destino": "pedro", "valor": 200, "categoria": "servicos"},
      {"id": "t6", "origem": "carla", "destino": "davi", "valor": 0, "categoria": "servicos"}]}',
                  Fatos),
    lote(seed, Seed),
    Fatos == Seed.
test(listas_vazias) :-
    fatos_do_json('{"limites": [], "contas_risco": [], "alerta_risco": 0, "transacoes": []}', F),
    F == [alerta_risco(0)].

test(nao_e_objeto, throws(erro_entrada('o lote deve ser um objeto JSON'))) :-
    fatos_do_json('[1, 2]', _).
test(campo_ausente, throws(erro_entrada('transacoes[1]: campo obrigatório ausente: valor'))) :-
    fatos_do_json('{"limites": [], "contas_risco": [], "alerta_risco": 0, "transacoes": [
      {"id": "t1", "origem": "a", "destino": "b", "valor": 1, "categoria": "c"},
      {"id": "t2", "origem": "a", "destino": "b", "categoria": "c"}]}', _).
test(lista_ausente, throws(erro_entrada('campo obrigatório ausente: transacoes'))) :-
    fatos_do_json('{"limites": [], "contas_risco": [], "alerta_risco": 0}', _).
test(valor_nao_numerico, throws(erro_entrada('transacoes[0]: campo valor deve ser número'))) :-
    fatos_do_json('{"limites": [], "contas_risco": [], "alerta_risco": 0, "transacoes": [
      {"id": "t1", "origem": "a", "destino": "b", "valor": "100", "categoria": "c"}]}', _).
test(limite_nao_numerico, throws(erro_entrada('limites[0]: campo limite deve ser número'))) :-
    fatos_do_json('{"limites": [{"categoria": "c", "limite": "x"}], "contas_risco": [],
                    "alerta_risco": 0, "transacoes": []}', _).
test(alerta_nao_numerico, throws(erro_entrada('campo alerta_risco deve ser número'))) :-
    fatos_do_json('{"limites": [], "contas_risco": [], "alerta_risco": null, "transacoes": []}', _).
test(id_nao_texto, throws(erro_entrada('transacoes[0]: campo id deve ser texto'))) :-
    fatos_do_json('{"limites": [], "contas_risco": [], "alerta_risco": 0, "transacoes": [
      {"id": 1, "origem": "a", "destino": "b", "valor": 1, "categoria": "c"}]}', _).
test(null_nao_e_texto, throws(erro_entrada('transacoes[0]: campo origem deve ser texto'))) :-
    fatos_do_json('{"limites": [], "contas_risco": [], "alerta_risco": 0, "transacoes": [
      {"id": "t1", "origem": null, "destino": "b", "valor": 1, "categoria": "c"}]}', _).
test(conta_risco_nao_texto, throws(erro_entrada('contas_risco[0]: deve ser texto'))) :-
    fatos_do_json('{"limites": [], "contas_risco": [true], "alerta_risco": 0, "transacoes": []}', _).
test(lista_nao_e_lista, throws(erro_entrada('limites deve ser uma lista'))) :-
    fatos_do_json('{"limites": {}, "contas_risco": [], "alerta_risco": 0, "transacoes": []}', _).
test(item_nao_objeto, throws(erro_entrada('transacoes[0]: deve ser um objeto'))) :-
    fatos_do_json('{"limites": [], "contas_risco": [], "alerta_risco": 0, "transacoes": ["t1"]}', _).
test(id_repetido, throws(erro_entrada('id repetido: t1'))) :-
    fatos_do_json('{"limites": [], "contas_risco": [], "alerta_risco": 0, "transacoes": [
      {"id": "t1", "origem": "a", "destino": "b", "valor": 1, "categoria": "c"},
      {"id": "t2", "origem": "a", "destino": "b", "valor": 1, "categoria": "c"},
      {"id": "t1", "origem": "b", "destino": "a", "valor": 1, "categoria": "c"}]}', _).

test(achado_json_transacao) :-
    achado_json(achado(transacao(t1), limite_categoria, m), J),
    J = _{regra: limite_categoria, transacao: t1, motivo: m}.
test(achado_json_ciclo) :-
    achado_json(achado(ciclo([a, b, a], [t1, t2]), ciclo, m), J),
    J = _{regra: ciclo, contas: [a, b, a], transacoes: [t1, t2], motivo: m}.

:- end_tests(entrada).

:- begin_tests(desempenho).

transacao_sorteada(NContas, I, transacao(I, Origem, Destino, 100, x)) :-
    random_between(1, NContas, Origem),
    random_between(1, NContas, Destino).

test(cem_transacoes_em_menos_de_1s) :-
    set_random(seed(42)),
    numlist(1, 100, Is),
    maplist(transacao_sorteada(60), Is, Fatos),
    call_time(validar(Fatos, _), Tempo),
    Tempo.cpu < 1.0.

:- end_tests(desempenho).

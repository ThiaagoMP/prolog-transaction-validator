:- ensure_loaded(regras).
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).

:- http_handler(root(validar), validar_http, [method(post)]).

:- if((prolog_load_context(source, Arquivo),
       current_prolog_flag(associated_file, Arquivo))).
:- initialization(main, main).
:- endif.

main :-
    http_server(http_dispatch, [port(8080)]),
    format('núcleo em http://localhost:8080/validar (Ctrl+C para sair)~n'),
    thread_get_message(_).

opcoes_json([value_string_as(atom), true(@(true)), false(@(false)), null(@(null))]).

validar_http(Requisicao) :-
    catch(( ler_lote(Requisicao, Fatos),
            validar(Fatos, Achados),
            maplist(achado_json, Achados, Json),
            reply_json_dict(_{achados: Json}) ),
          erro_entrada(Mensagem),
          reply_json_dict(_{erro: Mensagem}, [status(400)])).

ler_lote(Requisicao, Fatos) :-
    opcoes_json(Opcoes),
    catch(http_read_json_dict(Requisicao, Lote, Opcoes),
          error(_, _),
          throw(erro_entrada('JSON inválido'))),
    json_para_fatos(Lote, Fatos).

json_para_fatos(Lote, Fatos) :-
    (   is_dict(Lote)
    ->  true
    ;   erro('o lote deve ser um objeto JSON', [])
    ),
    campo(Lote, limites, '', Limites),
    campo(Lote, contas_risco, '', Contas),
    campo_numero(Lote, alerta_risco, '', Alerta),
    campo(Lote, transacoes, '', Transacoes),
    itens(limites, Limites, limite_fato, FLimites),
    itens(contas_risco, Contas, conta_fato, FContas),
    itens(transacoes, Transacoes, transacao_fato, FTransacoes),
    ids_unicos(FTransacoes),
    append([FLimites, FContas, [alerta_risco(Alerta)], FTransacoes], Fatos).

limite_fato(Onde, Item, limite_categoria(Categoria, Limite)) :-
    objeto(Onde, Item),
    campo_texto(Item, categoria, Onde, Categoria),
    campo_numero(Item, limite, Onde, Limite).

conta_fato(Onde, Conta, conta_risco(Conta)) :-
    (   atom(Conta)
    ->  true
    ;   erro('~wdeve ser texto', [Onde])
    ).

transacao_fato(Onde, Item, transacao(Id, Origem, Destino, Valor, Categoria)) :-
    objeto(Onde, Item),
    campo_texto(Item, id, Onde, Id),
    campo_texto(Item, origem, Onde, Origem),
    campo_texto(Item, destino, Onde, Destino),
    campo_numero(Item, valor, Onde, Valor),
    campo_texto(Item, categoria, Onde, Categoria).

itens(Nome, Lista, Conversor, Fatos) :-
    (   is_list(Lista)
    ->  true
    ;   erro('~w deve ser uma lista', [Nome])
    ),
    foldl(item(Nome, Conversor), Lista, Fatos, 0, _).

item(Nome, Conversor, Item, Fato, I0, I) :-
    format(atom(Onde), '~w[~w]: ', [Nome, I0]),
    call(Conversor, Onde, Item, Fato),
    I is I0 + 1.

ids_unicos(Transacoes) :-
    findall(Id, member(transacao(Id, _, _, _, _), Transacoes), Ids),
    (   append(_, [Id|Depois], Ids),
        memberchk(Id, Depois)
    ->  erro('id repetido: ~w', [Id])
    ;   true
    ).

objeto(Onde, Item) :-
    (   is_dict(Item)
    ->  true
    ;   erro('~wdeve ser um objeto', [Onde])
    ).

campo(Dict, Chave, Onde, Valor) :-
    (   get_dict(Chave, Dict, Valor)
    ->  true
    ;   erro('~wcampo obrigatório ausente: ~w', [Onde, Chave])
    ).

campo_texto(Dict, Chave, Onde, Valor) :-
    campo(Dict, Chave, Onde, Valor),
    (   atom(Valor)
    ->  true
    ;   erro('~wcampo ~w deve ser texto', [Onde, Chave])
    ).

campo_numero(Dict, Chave, Onde, Valor) :-
    campo(Dict, Chave, Onde, Valor),
    (   number(Valor)
    ->  true
    ;   erro('~wcampo ~w deve ser número', [Onde, Chave])
    ).

erro(Formato, Argumentos) :-
    format(atom(Mensagem), Formato, Argumentos),
    throw(erro_entrada(Mensagem)).

achado_json(achado(transacao(Id), Regra, Motivo),
            _{regra: Regra, transacao: Id, motivo: Motivo}).
achado_json(achado(ciclo(Contas, Ids), ciclo, Motivo),
            _{regra: ciclo, contas: Contas, transacoes: Ids, motivo: Motivo}).

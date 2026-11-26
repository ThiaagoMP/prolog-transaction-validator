# prolog-transaction-validator

Validador de transações financeiras em **Prolog**. Ele aponta valores acima do limite da
categoria, dinheiro enviado para contas de risco, transferências para a própria conta,
valores inválidos e ciclos de dinheiro. Uma tela web envia os lotes ao Prolog e mostra o
resultado, com um grafo das ligações entre as contas.

## Como executar

Com o Docker instalado, na pasta do projeto:

```sh
docker compose up --build
```

Depois, abra **http://localhost:3000**.

Para parar:

```sh
docker compose down
```

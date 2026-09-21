# GPT_slot2 · Runtime VibeCoder Lab V4

Branch experimental: `v4-vibecoder-html-js-css`.

Esta linha de pesquisa substitui o domínio financeiro por um **vibe coder procedural para HTML + JavaScript puro, com CSS auxiliar**. O motor não gera código token a token com um LLM em runtime: ele interpreta o pedido, seleciona microcompetências compatíveis, compõe um pequeno programa de edição e aplica esse programa ao projeto atual.

## Escopo V4.0

- HTML estático
- JavaScript client-side sem frameworks
- CSS
- edição de texto e atributos
- classes e visibilidade
- criação e remoção de elementos
- eventos de clique
- regras CSS
- prompts compostos em múltiplas etapas
- preview no navegador
- trace da busca e do expert temporário

## Benchmark interno

`vibe_benchmark_500.js` gera exatamente **500 casos**, divididos em 10 famílias com 50 casos cada. O teste de linha de comando é:

```bash
npm test
```

Na versão atual, o benchmark interno fecha em **500/500**. Ele é um benchmark gerado pela própria gramática do projeto e deve ser tratado como teste de regressão/cobertura, não como prova de generalização para linguagem aberta.

## Arquivos principais

- `vibe_engine.js` — motor procedural e microcompetências
- `vibe_benchmark_500.js` — benchmark interno de 500 casos
- `test_vibe.mjs` — gate de 500/500
- `index.html` — laboratório web
- `app.js` — interface, preview e benchmark no navegador
- `styles.css` — interface

## Licença

Este repositório é público, mas o código permanece **proprietário e source-available**. Consulte `LICENSE`.

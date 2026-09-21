# Recipe V0 — Combinatorial Core

Primeiro MVP estrutural da arquitetura.

## Regra central

- **Expert** = agrupador de variáveis; não contém lógica de tarefa.
- **Variable** = valor conceitual atômico.
- **Slot** = posição tipada a ser preenchida.
- **Constraint** = restringe combinações possíveis sem criar um expert especializado.
- **Formula** = calcula parâmetros em runtime, como quantidade por porções.
- **Composition** = materializa uma estrutura/resposta a partir dos slots resolvidos.

O motor é genérico. O domínio de receitas vive em `domain.js`.

## Estado atual

O domínio inicial tem:

- 10 slots
- 15 experts
- 81 variáveis
- capacidade categórica bruta: **620.217.000 configurações**
- parâmetros numéricos, como porções e quantidades, ficam fora da enumeração e são calculados em runtime.

A capacidade é apenas uma medida estrutural bruta; não significa 620 milhões de receitas úteis. Restrições e roteamento existem justamente para evitar materializar ou explorar combinações incoerentes.

## Exemplo

```text
prompt: "Tenho frango e quero preparar alguma coisa"

slot: mainIngredient
router -> ingredient_protein
candidatos locais -> EGG, CHICKEN, BEEF, TUNA, TOFU...
selecionado -> CHICKEN
```

Com uma restrição:

```text
constraint = NO_DAIRY
```

variáveis marcadas com a tag `dairy` deixam de ser candidatas sem que exista um expert `NO_DAIRY_RECIPE`.

## Arquivos

- `schema.js` — núcleo genérico da arquitetura.
- `domain.js` — dados do domínio culinário.
- `test_recipe_v0.mjs` — testes do motor, constraints, roteamento, fórmulas e capacidade.

## Teste

```bash
npm run test:recipe-v0
```

O GitHub Actions também executa o benchmark V4 anterior para garantir que esta linha experimental não quebre o projeto existente.

## Próximo experimento

A próxima etapa deve medir **generalização combinatória**: criar combinações de ingredientes/métodos/restrições que não aparecem como casos completos em nenhum lugar do código e verificar se o motor consegue resolvê-las explorando apenas uma pequena fração das 81 variáveis.

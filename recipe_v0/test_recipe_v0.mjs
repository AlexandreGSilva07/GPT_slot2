import assert from 'node:assert/strict';
import {
  candidatesForSlot,
  chooseCandidate,
  materialize,
  registryStats,
  estimateCategoricalCapacity
} from './schema.js';
import {recipeRegistry} from './domain.js';

const stats = registryStats(recipeRegistry);
assert.equal(stats.slots, 10);
assert.equal(stats.experts, 15);
assert.equal(stats.variables, 81);

// 1) Natural-language hint routes to the protein expert and resolves FRANGO.
{
  const r = chooseCandidate(recipeRegistry, 'mainIngredient', {
    text:'Tenho frango e quero preparar alguma coisa',
    topExperts:1
  });
  assert.equal(r.expertsOpened[0], 'ingredient_protein');
  assert.equal(r.selected?.id, 'CHICKEN');
}

// 2) A dietary constraint filters dairy without adding special-purpose expert code.
{
  const noDairy = recipeRegistry.variables.get('NO_DAIRY');
  const candidates = candidatesForSlot(recipeRegistry, 'mainIngredient', {
    text:'quero algo com leite ou outra coisa',
    state:{constraint:[noDairy]},
    topExperts:6,
    maxVariables:100
  });
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(x => !x.variable.tags.includes('dairy')));
}

// 3) Dish state can constrain method search generically.
{
  const smoothie = recipeRegistry.variables.get('SMOOTHIE');
  const candidates = candidatesForSlot(recipeRegistry, 'method', {
    text:'quero bater no liquidificador',
    state:{dish:smoothie},
    topExperts:2,
    maxVariables:20
  });
  assert.deepEqual(candidates.map(x => x.variable.id), ['BLEND']);
}

// 4) Numeric quantities are computed at runtime, not stored as variables.
{
  const state = {
    intent: recipeRegistry.variables.get('PREPARE'),
    dish: recipeRegistry.variables.get('OMELET'),
    mainIngredient: recipeRegistry.variables.get('EGG'),
    secondaryIngredient: recipeRegistry.variables.get('TOMATO'),
    method: recipeRegistry.variables.get('PAN_FRY'),
    constraint: [],
    desiredResult: recipeRegistry.variables.get('SOFT'),
    portions: 4,
    timeLimit: 10,
    responseAct: recipeRegistry.variables.get('STEP_BY_STEP')
  };
  const result = materialize(recipeRegistry, 'recipe-answer', state);
  assert.equal(result.state.mainQuantity.value, 6);
  assert.equal(result.state.mainQuantity.unit, 'un');
  assert.equal(result.state.secondaryQuantity.value, 320);
  assert.equal(result.state.secondaryQuantity.unit, 'g');
}

// 5) Capacity is represented by combinations while runtime parameters are not enumerated.
{
  const capacity = estimateCategoricalCapacity(recipeRegistry);
  assert.ok(capacity.total > 1_000_000n);
  assert.equal(capacity.perSlot.portions, null);
  assert.equal(capacity.perSlot.timeLimit, null);
  console.log('categorical capacity:', capacity.total.toString());
}

console.log(JSON.stringify({
  ok:true,
  core:'recipe_v0',
  ...stats
}, null, 2));

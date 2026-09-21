import assert from 'node:assert/strict';
import {resolveRecipeRequest, getResolverStats} from './resolver.js';

{
  const r = resolveRecipeRequest(
    'Tenho frango, batata e tomate, não quero usar forno e preciso fazer algo rápido.'
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.ingredients.map(x => x.id), ['CHICKEN','POTATO','TOMATO']);
  assert.ok(r.state.constraint.some(x => x.id === 'NO_OVEN'));
  assert.equal(r.state.dish.id, 'STIR_FRY');
  assert.ok(!r.state.method.tags.includes('oven'));
  assert.ok(r.trace.expertsActivated.length < getResolverStats().expertsStored);
}

{
  const r = resolveRecipeRequest(
    'Quero uma vitamina de banana e morango para 4 pessoas em 10 minutos.'
  );
  assert.equal(r.ok, true);
  assert.equal(r.state.dish.id, 'SMOOTHIE');
  assert.equal(r.state.method.id, 'BLEND');
  assert.equal(r.state.portions, 4);
  assert.equal(r.state.timeLimit, 10);
  assert.deepEqual(r.ingredients.map(x => x.id), ['BANANA','STRAWBERRY']);
}

{
  const r = resolveRecipeRequest(
    'Quero bolo de banana para 4 pessoas.'
  );
  assert.equal(r.ok, true);
  assert.equal(r.state.dish.id, 'CAKE');
  assert.equal(r.state.method.id, 'BAKE');
  assert.equal(r.state.portions, 4);
}

{
  const r = resolveRecipeRequest(
    'Tenho frango e tomate, quero algo sem leite e sem forno.'
  );
  assert.equal(r.ok, true);
  assert.ok(r.state.constraint.some(x => x.id === 'NO_DAIRY'));
  assert.ok(r.state.constraint.some(x => x.id === 'NO_OVEN'));
  assert.ok(!r.state.method.tags.includes('oven'));
  assert.ok(r.ingredients.every(x => !['MILK','YOGURT','MOZZARELLA','PARMESAN','BUTTER'].includes(x.id)));
}

{
  const r = resolveRecipeRequest('Quero alguma coisa rápida.');
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['INGREDIENT']);
}

console.log(JSON.stringify({
  ok:true,
  resolver:getResolverStats()
}, null, 2));

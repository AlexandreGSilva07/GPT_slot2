import {candidatesForSlot, materialize} from './schema.js';
import {recipeRegistry} from './domain.js';

const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9%°]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function buildLexicon(registry) {
  const index = new Map();
  let maxWords = 1;

  for (const variable of registry.variables.values()) {
    for (const alias of variable.aliases) {
      const key = normalize(alias);
      if (!key) continue;
      maxWords = Math.max(maxWords, key.split(' ').length);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(variable);
    }
  }

  return {index, maxWords};
}

const LEXICON = buildLexicon(recipeRegistry);

function lexicalMentions(text) {
  const tokens = normalize(text).split(' ').filter(Boolean);
  const found = new Map();
  let lookups = 0;

  for (let start = 0; start < tokens.length; start++) {
    for (let size = 1; size <= LEXICON.maxWords && start + size <= tokens.length; size++) {
      const phrase = tokens.slice(start, start + size).join(' ');
      lookups++;
      const matches = LEXICON.index.get(phrase);
      if (!matches) continue;

      for (const variable of matches) {
        const previous = found.get(variable.id);
        if (!previous || size > previous.words) {
          found.set(variable.id, {variable, start, words:size, phrase});
        }
      }
    }
  }

  return {
    mentions:[...found.values()].sort((a,b) => a.start - b.start || b.words - a.words),
    lookups
  };
}

function mentionsOf(mentions, type) {
  return mentions.filter(x => x.variable.type === type);
}

function firstVariable(registry, id) {
  const value = registry.variables.get(id);
  if (!value) throw new Error(`Unknown fallback variable: ${id}`);
  return value;
}

function parseRuntimeParameters(text) {
  const n = normalize(text);

  let portions = null;
  const portionsMatch = n.match(/\b(\d+)\s*(?:porcoes|porcao|pessoas|pessoa)\b/);
  if (portionsMatch) portions = Number(portionsMatch[1]);
  if (!portions) portions = 2;

  let timeLimit = null;
  const minutes = n.match(/\b(\d+)\s*(?:min|minuto|minutos)\b/);
  const hours = n.match(/\b(\d+)\s*(?:h|hora|horas)\b/);
  if (minutes) timeLimit = Number(minutes[1]);
  else if (hours) timeLimit = Number(hours[1]) * 60;
  else if (/\bmeia hora\b/.test(n)) timeLimit = 30;
  else if (/\b(?:rapido|rapida|rapidinho|rapidinha)\b/.test(n)) timeLimit = 30;

  return {portions, timeLimit};
}

const DISH_PROFILES = Object.freeze({
  OMELET:       {accept:['egg'], method:['pan'], maxMinutes:20},
  SOUP:         {accept:['protein','legume','vegetable','grain'], method:['wet'], maxMinutes:90},
  PASTA:        {accept:['grain'], method:['boil'], maxMinutes:35},
  RICE_BOWL:    {accept:['grain','protein','vegetable','legume'], method:['boil','assembly'], maxMinutes:45},
  STIR_FRY:     {accept:['protein','vegetable','plant'], method:['pan','grill'], maxMinutes:30},
  SALAD:        {accept:['leaf','vegetable','legume','protein'], method:['no_cook','assembly'], maxMinutes:20},
  SANDWICH:     {accept:['protein','vegetable','cheese','assembly'], method:['assembly'], maxMinutes:15},
  SMOOTHIE:     {accept:['fruit'], method:['blend'], maxMinutes:10},
  FRUIT_BOWL:   {accept:['fruit'], method:['no_cook','assembly'], maxMinutes:15},
  COLD_BOWL:    {accept:['grain','protein','vegetable','legume'], method:['assembly'], maxMinutes:25},
  ROASTED_TRAY: {accept:['protein','vegetable','starch'], method:['oven'], maxMinutes:60},
  SAVORY_PIE:   {accept:['protein','vegetable','cheese','flour'], method:['oven'], maxMinutes:75},
  BAKED_PASTA:  {accept:['grain','cheese','protein'], method:['oven'], maxMinutes:60},
  CAKE:         {accept:['flour','fruit','cocoa'], method:['oven'], maxMinutes:75},
  BAKED_FRUIT:  {accept:['fruit'], method:['oven'], maxMinutes:40}
});

function hasConstraint(constraints, id) {
  return constraints.some(x => x.id === id);
}

function chooseDish(ingredients, constraints, timeLimit, explicitDish = null) {
  if (explicitDish) return {value:explicitDish, evaluated:1, score:Infinity, reason:'explicit'};

  const dishes = [...recipeRegistry.variables.values()].filter(v => v.type === 'DISH');
  let best = null;

  for (const dish of dishes) {
    const profile = DISH_PROFILES[dish.id];
    if (!profile) continue;

    if (hasConstraint(constraints, 'NO_OVEN') && dish.tags.includes('oven')) continue;

    let score = 0;
    for (const ingredient of ingredients) {
      if (profile.accept.some(tag => ingredient.tags.includes(tag))) score += 4;
      if (ingredient.tags.includes('savory') && dish.tags.includes('savory')) score += 1;
      if (ingredient.tags.includes('sweet') && dish.tags.includes('sweet')) score += 1;
    }

    if (timeLimit != null) {
      if (profile.maxMinutes <= timeLimit) score += 3;
      else score -= Math.min(6, Math.ceil((profile.maxMinutes - timeLimit) / 10));
    }

    if (!best || score > best.score || (score === best.score && dish.id < best.value.id)) {
      best = {value:dish, score, reason:'compatibility'};
    }
  }

  return {...best, evaluated:dishes.length};
}

function chooseMethod(dish, constraints, text) {
  const profile = DISH_PROFILES[dish.id] ?? {method:[]};
  const state = {dish, constraint:constraints};

  const candidates = candidatesForSlot(recipeRegistry, 'method', {
    text,
    state,
    topExperts:2,
    maxVariables:50
  });

  let best = null;
  for (const candidate of candidates) {
    const overlap = profile.method.filter(tag => candidate.variable.tags.includes(tag)).length;
    const score = candidate.score + overlap * 5;
    if (!best || score > best.score) best = {...candidate, score};
  }

  if (!best) {
    throw new Error('Nenhum método compatível sobreviveu às constraints.');
  }

  return {value:best.variable, candidates, expert:best.expert};
}

function pickDesiredResult(mentions, dish) {
  const explicit = mentionsOf(mentions, 'RESULT')[0]?.variable;
  if (explicit) return explicit;
  if (dish.tags.includes('sweet')) return firstVariable(recipeRegistry, 'SOFT');
  if (dish.tags.includes('cold')) return firstVariable(recipeRegistry, 'LIGHT');
  return firstVariable(recipeRegistry, 'GOLDEN');
}

function sentenceLabel(variable) {
  return variable?.aliases?.[0] ?? variable?.id ?? '';
}

function quantityFor(variable, portions) {
  const per = variable?.attributes?.perServing;
  if (!Number.isFinite(per)) return null;
  return {
    value:Math.round(per * portions * 10) / 10,
    unit:variable.attributes.unit
  };
}

function quantityText(q) {
  if (!q) return '';
  return `${String(q.value).replace('.', ',')} ${q.unit}`;
}

function buildAnswer(state, ingredients, dishDecision, methodDecision) {
  const mainQ = quantityFor(state.mainIngredient, state.portions);
  const extras = ingredients.slice(1).map(variable => ({
    variable,
    quantity:quantityFor(variable, state.portions)
  }));

  const ingredientText = [
    `${quantityText(mainQ)} de ${sentenceLabel(state.mainIngredient)}`,
    ...extras.map(x => `${quantityText(x.quantity)} de ${sentenceLabel(x.variable)}`)
  ].join(', ');

  const timePart = state.timeLimit ? ` respeitando o limite de cerca de ${state.timeLimit} minutos` : '';

  return {
    title:`${sentenceLabel(state.dish)} com ${sentenceLabel(state.mainIngredient)}`,
    text:`Sugestão: ${sentenceLabel(state.dish)} usando ${ingredientText}. Use o método ${sentenceLabel(state.method)}${timePart}. Busque um resultado ${sentenceLabel(state.desiredResult)}.`,
    ingredients:ingredients.map(variable => ({
      id:variable.id,
      label:sentenceLabel(variable),
      quantity:quantityFor(variable, state.portions)
    })),
    dishDecision,
    methodDecision
  };
}

export function resolveRecipeRequest(text, {defaultPortions = 2} = {}) {
  const lex = lexicalMentions(text);
  const mentions = lex.mentions;
  const parameters = parseRuntimeParameters(text);
  if (!parameters.portions) parameters.portions = defaultPortions;

  const constraints = mentionsOf(mentions, 'CONSTRAINT').map(x => x.variable);
  const ingredientMentions = mentionsOf(mentions, 'INGREDIENT');
  const ingredients = [...new Map(ingredientMentions.map(x => [x.variable.id, x.variable])).values()];

  if (!ingredients.length) {
    return {
      ok:false,
      missing:['INGREDIENT'],
      answer:'Preciso de pelo menos um ingrediente para compor uma receita.',
      trace:{
        lexicalLookups:lex.lookups,
        mentions:mentions.map(x => x.variable.id),
        expertsActivated:[...new Set(mentions.map(x => x.variable.expert))]
      }
    };
  }

  const explicitDish = mentionsOf(mentions, 'DISH')[0]?.variable ?? null;
  const dishDecision = chooseDish(ingredients, constraints, parameters.timeLimit, explicitDish);
  if (!dishDecision?.value) {
    return {ok:false, missing:['DISH'], answer:'Não encontrei um tipo de prato compatível.'};
  }

  const methodDecision = chooseMethod(dishDecision.value, constraints, text);

  const state = {
    intent:mentionsOf(mentions, 'INTENT')[0]?.variable ?? firstVariable(recipeRegistry, 'PREPARE'),
    dish:dishDecision.value,
    mainIngredient:ingredients[0],
    secondaryIngredient:ingredients[1] ?? null,
    constraint:constraints,
    desiredResult:pickDesiredResult(mentions, dishDecision.value),
    method:methodDecision.value,
    portions:parameters.portions,
    timeLimit:parameters.timeLimit,
    responseAct:mentionsOf(mentions, 'RESPONSE_ACT')[0]?.variable ?? firstVariable(recipeRegistry, 'SHORT_SUGGESTION')
  };

  // Materialize validates the required structural slots and evaluates formulas.
  const materialized = materialize(recipeRegistry, 'recipe-answer', state);
  const answer = buildAnswer(state, ingredients, dishDecision, methodDecision);

  const expertsActivated = new Set(mentions.map(x => x.variable.expert));
  expertsActivated.add(methodDecision.expert);

  return {
    ok:true,
    input:text,
    answer:answer.text,
    title:answer.title,
    state,
    materialized,
    ingredients:answer.ingredients,
    trace:{
      lexicalLookups:lex.lookups,
      lexicalMentions:mentions.map(x => ({
        id:x.variable.id,
        type:x.variable.type,
        expert:x.variable.expert,
        phrase:x.phrase
      })),
      expertsActivated:[...expertsActivated],
      dishCandidatesEvaluated:dishDecision.evaluated,
      dishSelected:dishDecision.value.id,
      dishScore:dishDecision.score,
      methodCandidatesEvaluated:methodDecision.candidates.length,
      methodSelected:methodDecision.value.id,
      totalVariablesStored:recipeRegistry.variables.size
    }
  };
}

export function getResolverStats() {
  return {
    variablesStored:recipeRegistry.variables.size,
    expertsStored:recipeRegistry.experts.size,
    lexicalEntries:LEXICON.index.size,
    maxAliasWords:LEXICON.maxWords
  };
}

// V5 Recipe Combinatorial Core
// Expert = data partition. Variable = candidate value. Slot = typed position.
// Constraints and formulas live outside experts.

export const CORE_VERSION = '5.0.0-v0';

const freeze = value => Object.freeze(value);
const arr = value => Array.isArray(value) ? value : [value];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function defineVariable({
  id,
  type,
  expert,
  aliases = [],
  tags = [],
  attributes = {}
}) {
  assert(id && type && expert, 'Variable requires id, type and expert');
  return freeze({
    kind: 'variable',
    id,
    type,
    expert,
    aliases: freeze([...new Set([id, ...aliases].map(String))]),
    tags: freeze([...new Set(tags.map(String))]),
    attributes: freeze({...attributes})
  });
}

export function defineExpert({
  id,
  slotTypes,
  variables,
  keywords = []
}) {
  assert(id, 'Expert requires id');
  assert(Array.isArray(slotTypes) && slotTypes.length, `Expert ${id} requires slotTypes`);
  assert(Array.isArray(variables) && variables.length, `Expert ${id} requires variables`);
  for (const variable of variables) {
    assert(variable.kind === 'variable', `Expert ${id} contains non-variable entry`);
    assert(variable.expert === id, `Variable ${variable.id} points to ${variable.expert}, expected ${id}`);
  }
  return freeze({
    kind: 'expert',
    id,
    slotTypes: freeze([...new Set(slotTypes)]),
    keywords: freeze([...new Set(keywords.map(String))]),
    variables: freeze([...variables])
  });
}

export function defineSlot({
  id,
  type,
  required = true,
  multi = false,
  maxItems = multi ? Infinity : 1,
  acceptsExperts = null
}) {
  assert(id && type, 'Slot requires id and type');
  return freeze({
    kind: 'slot',
    id,
    type,
    required: Boolean(required),
    multi: Boolean(multi),
    maxItems,
    acceptsExperts: acceptsExperts ? freeze([...acceptsExperts]) : null
  });
}

export function defineConstraint({
  id,
  when = [],
  targetSlot,
  allowTags = [],
  denyTags = [],
  allowValues = [],
  denyValues = []
}) {
  assert(id && targetSlot, 'Constraint requires id and targetSlot');
  return freeze({
    kind: 'constraint',
    id,
    when: freeze(when.map(x => freeze({...x}))),
    targetSlot,
    allowTags: freeze([...allowTags]),
    denyTags: freeze([...denyTags]),
    allowValues: freeze([...allowValues]),
    denyValues: freeze([...denyValues])
  });
}

export function defineFormula({
  id,
  inputs,
  output,
  compute
}) {
  assert(id && Array.isArray(inputs) && output && typeof compute === 'function', 'Invalid formula');
  return freeze({
    kind: 'formula',
    id,
    inputs: freeze([...inputs]),
    output,
    compute
  });
}

export function defineComposition({
  id,
  slots,
  formulas = [],
  output
}) {
  assert(id && Array.isArray(slots) && typeof output === 'function', 'Invalid composition');
  return freeze({
    kind: 'composition',
    id,
    slots: freeze([...slots]),
    formulas: freeze([...formulas]),
    output
  });
}

export function buildRegistry({slots, experts, constraints = [], formulas = [], compositions = []}) {
  const slotMap = new Map(slots.map(x => [x.id, x]));
  const expertMap = new Map(experts.map(x => [x.id, x]));
  const variableMap = new Map();
  for (const expert of experts) {
    for (const variable of expert.variables) {
      assert(!variableMap.has(variable.id), `Duplicate variable id: ${variable.id}`);
      variableMap.set(variable.id, variable);
    }
  }

  for (const slot of slots) {
    if (slot.acceptsExperts) {
      for (const id of slot.acceptsExperts) assert(expertMap.has(id), `Slot ${slot.id} references unknown expert ${id}`);
    }
  }

  return freeze({
    slots: slotMap,
    experts: expertMap,
    variables: variableMap,
    constraints: freeze([...constraints]),
    formulas: new Map(formulas.map(x => [x.id, x])),
    compositions: new Map(compositions.map(x => [x.id, x]))
  });
}

function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%°]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lexicalScore(text, terms) {
  const n = normalize(text);
  if (!n) return 0;
  let score = 0;
  for (const term of terms) {
    const t = normalize(term);
    if (!t) continue;
    if (n.includes(t)) score += Math.max(1, t.split(' ').length);
  }
  return score;
}

function conditionMatches(condition, state) {
  const current = state[condition.slot];
  if (condition.op === 'exists') return current != null;
  if (condition.op === 'eq') return current === condition.value || current?.id === condition.value;
  if (condition.op === 'in') {
    const value = current?.id ?? current;
    return arr(condition.value).includes(value);
  }
  if (condition.op === 'tag') {
    const values = Array.isArray(current) ? current : [current];
    return values.some(v => v?.tags?.includes(condition.value));
  }
  return false;
}

function activeConstraints(registry, state, slotId) {
  return registry.constraints.filter(c =>
    c.targetSlot === slotId &&
    c.when.every(condition => conditionMatches(condition, state))
  );
}

function variableAllowed(variable, constraints) {
  for (const c of constraints) {
    if (c.allowValues.length && !c.allowValues.includes(variable.id)) return false;
    if (c.denyValues.includes(variable.id)) return false;
    if (c.allowTags.length && !c.allowTags.some(tag => variable.tags.includes(tag))) return false;
    if (c.denyTags.some(tag => variable.tags.includes(tag))) return false;
  }
  return true;
}

export function routeExperts(registry, slotId, text = '', topK = 1) {
  const slot = registry.slots.get(slotId);
  assert(slot, `Unknown slot: ${slotId}`);

  const candidates = [...registry.experts.values()]
    .filter(expert =>
      expert.slotTypes.includes(slot.type) &&
      (!slot.acceptsExperts || slot.acceptsExperts.includes(expert.id))
    )
    .map(expert => ({
      expert,
      score: lexicalScore(text, [expert.id, ...expert.keywords])
    }))
    .sort((a, b) => b.score - a.score || a.expert.id.localeCompare(b.expert.id));

  // If language gives no signal, keep deterministic sparse fallback.
  return candidates.slice(0, Math.max(1, topK));
}

export function candidatesForSlot(registry, slotId, {
  text = '',
  state = {},
  topExperts = 1,
  maxVariables = 50
} = {}) {
  const constraints = activeConstraints(registry, state, slotId);
  const routed = routeExperts(registry, slotId, text, topExperts);
  const candidates = [];

  for (const {expert, score: expertScore} of routed) {
    for (const variable of expert.variables) {
      if (!variableAllowed(variable, constraints)) continue;
      const score = expertScore + lexicalScore(text, variable.aliases);
      candidates.push({expert: expert.id, variable, score});
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.variable.id.localeCompare(b.variable.id))
    .slice(0, maxVariables);
}

export function chooseCandidate(registry, slotId, options = {}) {
  const candidates = candidatesForSlot(registry, slotId, options);
  return {
    selected: candidates[0]?.variable ?? null,
    candidates,
    expertsOpened: [...new Set(candidates.map(x => x.expert))]
  };
}

export function evaluateFormulas(registry, compositionId, state) {
  const composition = registry.compositions.get(compositionId);
  assert(composition, `Unknown composition: ${compositionId}`);
  const next = {...state};

  for (const formulaId of composition.formulas) {
    const formula = registry.formulas.get(formulaId);
    assert(formula, `Unknown formula: ${formulaId}`);
    const input = {};
    for (const key of formula.inputs) input[key] = next[key];
    next[formula.output] = formula.compute(input, next);
  }

  return next;
}

export function materialize(registry, compositionId, state) {
  const composition = registry.compositions.get(compositionId);
  assert(composition, `Unknown composition: ${compositionId}`);

  for (const slotId of composition.slots) {
    const slot = registry.slots.get(slotId);
    if (slot?.required && state[slotId] == null) {
      throw new Error(`Required slot not filled: ${slotId}`);
    }
  }

  const resolved = evaluateFormulas(registry, compositionId, state);
  return composition.output(resolved);
}

export function registryStats(registry) {
  const experts = [...registry.experts.values()];
  const variables = [...registry.variables.values()];
  return {
    slots: registry.slots.size,
    experts: experts.length,
    variables: variables.length,
    averageVariablesPerExpert: variables.length / Math.max(1, experts.length)
  };
}

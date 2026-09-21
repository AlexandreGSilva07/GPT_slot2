export const VALUE_STATE = Object.freeze({
  KNOWN: 'KNOWN',
  UNKNOWN: 'UNKNOWN',
  ABSENT: 'ABSENT',
  AMBIGUOUS: 'AMBIGUOUS',
  DERIVED: 'DERIVED'
});

export const Known = (value, meta = {}) => ({
  state: VALUE_STATE.KNOWN,
  value,
  confidence: meta.confidence ?? 1,
  source: meta.source ?? 'explicit',
  evidence: meta.evidence ?? null
});

export const Unknown = (reason = 'explicitly unknown', meta = {}) => ({
  state: VALUE_STATE.UNKNOWN,
  reason,
  confidence: meta.confidence ?? 1,
  source: meta.source ?? 'explicit-unknown',
  evidence: meta.evidence ?? null
});

export const Absent = (meta = {}) => ({
  state: VALUE_STATE.ABSENT,
  reason: meta.reason ?? 'not mentioned',
  source: meta.source ?? 'absence'
});

export const Ambiguous = (candidates = [], meta = {}) => ({
  state: VALUE_STATE.AMBIGUOUS,
  candidates,
  reason: meta.reason ?? 'multiple plausible values',
  source: meta.source ?? 'ambiguity'
});

export const Derived = (expression, dependencies = [], meta = {}) => ({
  state: VALUE_STATE.DERIVED,
  expression,
  dependencies,
  value: meta.value,
  confidence: meta.confidence ?? 1,
  source: meta.source ?? 'derived'
});

export function isKnown(v) {
  return Boolean(v && (v.state === VALUE_STATE.KNOWN ||
    (v.state === VALUE_STATE.DERIVED && Number.isFinite(v.value))));
}

export function unwrap(v) {
  return isKnown(v) ? v.value : undefined;
}

export function node(id, type, fields = {}, links = {}, meta = {}) {
  return {
    id,
    type,
    fields: { ...fields },
    links: { ...links },
    meta: { confidence: meta.confidence ?? 1, source: meta.source ?? 'parser', ...meta }
  };
}

export function relation(type, from, to, meta = {}) {
  return { type, from, to, meta: { confidence: meta.confidence ?? 1, ...meta } };
}

export function createWorld(meta = {}) {
  return {
    version: 1,
    nodes: [],
    relations: [],
    goals: [],
    issues: [],
    meta: { ...meta }
  };
}

export function addNode(world, n) {
  world.nodes.push(n);
  return n;
}

export function addRelation(world, r) {
  world.relations.push(r);
  return r;
}

export function addGoal(world, goal) {
  world.goals.push(goal);
  return goal;
}

export function addIssue(world, issue) {
  world.issues.push(issue);
  return issue;
}

export function nodesOf(world, type) {
  return world.nodes.filter(n => n.type === type);
}

export function findNode(world, id) {
  return world.nodes.find(n => n.id === id) || null;
}

export function nextId(world, type) {
  const prefix = type.toLowerCase();
  let i = 1;
  while (findNode(world, `${prefix}:${i}`)) i++;
  return `${prefix}:${i}`;
}

export function related(world, nodeId, relationType, direction = 'out') {
  const matches = world.relations.filter(r => {
    if (r.type !== relationType) return false;
    return direction === 'in' ? r.to === nodeId : r.from === nodeId;
  });
  return matches
    .map(r => findNode(world, direction === 'in' ? r.from : r.to))
    .filter(Boolean);
}

export function fieldValue(n, key) {
  return unwrap(n?.fields?.[key]);
}

export function knownField(n, key) {
  return isKnown(n?.fields?.[key]);
}

export function setField(n, key, valueState) {
  n.fields[key] = valueState;
  return valueState;
}

export function worldSummary(world) {
  const counts = {};
  for (const n of world.nodes) counts[n.type] = (counts[n.type] || 0) + 1;
  return {
    nodeCount: world.nodes.length,
    relationCount: world.relations.length,
    goalCount: world.goals.length,
    issueCount: world.issues.length,
    counts
  };
}

// Temporary compatibility bridge while V3 is introduced incrementally.
// It only exposes scalar fields when the world contains a single unambiguous value.
export function worldToLegacyEntities(world) {
  const out = {};
  const singleton = (type, field, key = field) => {
    const vals = nodesOf(world, type)
      .map(n => fieldValue(n, field))
      .filter(v => v !== undefined);
    const uniq = [...new Set(vals)];
    if (uniq.length === 1) out[key] = uniq[0];
  };

  singleton('PURCHASE', 'quantity', 'quantity');
  singleton('PURCHASE', 'unitCost', 'unitCost');
  singleton('SALE', 'unitPrice', 'salePrice');
  singleton('FIXED_COST', 'amount', 'fixedCost');
  singleton('FEE', 'ratePct', 'feePct');
  singleton('RETURN', 'ratePct', 'returnsPct');
  singleton('PERIOD_VALUE', 'previous', 'previous');
  singleton('PERIOD_VALUE', 'current', 'current');

  return out;
}

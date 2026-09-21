import { analyzeV3 } from './engine_v3.js';
import { worldToLegacyEntities } from './world_model.js';

export const BENCHMARK_SCHEMA_VERSION = 2;

function numClose(actual, expected, tolerance = 1e-6) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return actual === expected;
  return Math.abs(actual - expected) <= tolerance;
}

function normalizeDocument(input) {
  const raw = Array.isArray(input) ? { cases: input } : input;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.cases)) {
    throw new Error('JSON inválido: use um objeto com "cases": [...] ou um array de casos.');
  }

  const cases = raw.cases.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Caso ${index + 1}: objeto inválido.`);
    if (typeof item.prompt !== 'string' || !item.prompt.trim()) {
      throw new Error(`Caso ${index + 1}: "prompt" é obrigatório.`);
    }
    return {
      id: String(item.id ?? `case-${index + 1}`),
      prompt: item.prompt,
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      note: item.note ? String(item.note) : '',
      expected: item.expected && typeof item.expected === 'object' ? item.expected : null
    };
  });

  return {
    schemaVersion: Number(raw.schemaVersion || BENCHMARK_SCHEMA_VERSION),
    name: String(raw.name || 'Benchmark personalizado'),
    description: String(raw.description || ''),
    cases
  };
}

export function parseBenchmarkJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON inválido: ${error.message}`);
  }
  return normalizeDocument(parsed);
}

function makeCheck(name, expected, actual, pass) {
  return { name, expected, actual, pass: Boolean(pass) };
}

function serializeValueState(v) {
  if (!v || typeof v !== 'object') return v ?? null;
  if (!v.state) return v;
  const out = { state: v.state };
  if ('value' in v) out.value = v.value;
  if (v.reason) out.reason = v.reason;
  if (v.expression) out.expression = v.expression;
  if (Array.isArray(v.dependencies)) out.dependencies = v.dependencies;
  if (Array.isArray(v.candidates)) out.candidates = v.candidates;
  if (v.source) out.source = v.source;
  if (v.confidence !== undefined) out.confidence = v.confidence;
  return out;
}

function serializeNode(n) {
  return {
    id: n.id,
    type: n.type,
    fields: Object.fromEntries(
      Object.entries(n.fields || {}).map(([k, v]) => [k, serializeValueState(v)])
    ),
    links: { ...(n.links || {}) },
    meta: { ...(n.meta || {}) }
  };
}

export function evaluateBenchmarkCase(testCase) {
  const startedAt = performance.now();
  try {
    const r = analyzeV3(testCase.prompt);
    const durationMs = performance.now() - startedAt;
    const status = r.ok ? 'resolved' : 'incomplete';
    const legacyEntities = worldToLegacyEntities(r.world);
    const actual = {
      engineVersion: r.version,
      status,
      target: r.target || null,
      targets: r.target ? [r.target] : [],
      targetConfidence: Number(r.goal?.confidence || 0),
      targetWord: r.goal?.source || null,
      normalized: r.normalized || '',
      entities: legacyEntities,
      worldSummary: r.worldSummary,
      nodes: (r.world?.nodes || []).map(serializeNode),
      relations: (r.world?.relations || []).map(x => ({ ...x })),
      issues: (r.world?.issues || []).map(x => ({ ...x })),
      motors: [...(r.motors || [])],
      stepCount: r.steps?.length || 0,
      expertSignature: r.expertSignature,
      steps: (r.steps || []).map((s, index) => ({
        index: index + 1,
        id: s.id,
        motor: s.motor,
        output: s.output,
        expression: s.expression,
        value: s.value,
        meta: s.meta || {}
      })),
      values: { ...(r.values || {}) },
      value: r.value,
      answer: r.answer || null,
      missing: Array.isArray(r.missing) ? r.missing : [],
      registeredFlows: 0
    };

    const expected = testCase.expected;
    const checks = [];
    if (expected) {
      const tolerance = Number.isFinite(Number(expected.tolerance)) ? Number(expected.tolerance) : 1e-6;

      if (expected.status !== undefined) {
        checks.push(makeCheck('status', expected.status, actual.status, actual.status === expected.status));
      }
      if (expected.target !== undefined) {
        checks.push(makeCheck('target', expected.target, actual.target, actual.target === expected.target));
      }
      if (expected.value !== undefined) {
        const expectedValue = Number(expected.value);
        checks.push(makeCheck(
          'value',
          expectedValue,
          actual.value,
          numClose(Number(actual.value), expectedValue, tolerance)
        ));
      }

      // Backward-compatible scalar subset checks for V2/V2.3 benchmark files.
      if (expected.entities && typeof expected.entities === 'object') {
        for (const [key, value] of Object.entries(expected.entities)) {
          const expectedValue = Number(value);
          const actualEntity = actual.entities[key];
          checks.push(makeCheck(
            `entity.${key}`,
            expectedValue,
            actualEntity,
            numClose(Number(actualEntity), expectedValue, tolerance)
          ));
        }
      }

      // V3-native structural checks.
      if (expected.worldCounts && typeof expected.worldCounts === 'object') {
        for (const [type, count] of Object.entries(expected.worldCounts)) {
          const actualCount = Number(actual.worldSummary?.counts?.[type] || 0);
          checks.push(makeCheck(
            `worldCounts.${type}`,
            Number(count),
            actualCount,
            actualCount === Number(count)
          ));
        }
      }

      if (Array.isArray(expected.issueTypes)) {
        const expectedTypes = expected.issueTypes.map(String).sort();
        const actualTypes = actual.issues.map(x => String(x.type || '')).filter(Boolean).sort();
        checks.push(makeCheck(
          'issueTypes',
          expectedTypes,
          actualTypes,
          JSON.stringify(expectedTypes) === JSON.stringify(actualTypes)
        ));
      }

      if (Array.isArray(expected.motors)) {
        const expectedMotors = expected.motors.map(String);
        checks.push(makeCheck(
          'motors',
          expectedMotors,
          actual.motors,
          JSON.stringify(actual.motors) === JSON.stringify(expectedMotors)
        ));
      }
      if (expected.stepCount !== undefined) {
        checks.push(makeCheck(
          'stepCount',
          Number(expected.stepCount),
          actual.stepCount,
          actual.stepCount === Number(expected.stepCount)
        ));
      }
    }

    const scored = Boolean(expected && checks.length);
    const pass = scored ? checks.every(c => c.pass) : null;

    return {
      id: testCase.id,
      prompt: testCase.prompt,
      tags: testCase.tags,
      note: testCase.note,
      expected: expected || null,
      scored,
      pass,
      durationMs,
      checks,
      actual
    };
  } catch (error) {
    return {
      id: testCase.id,
      prompt: testCase.prompt,
      tags: testCase.tags,
      note: testCase.note,
      expected: testCase.expected || null,
      scored: Boolean(testCase.expected),
      pass: false,
      durationMs: performance.now() - startedAt,
      checks: [],
      error: String(error?.stack || error?.message || error),
      actual: null
    };
  }
}

export function runBenchmarkDocument(input) {
  const doc = normalizeDocument(input);
  const startedAt = performance.now();
  const results = doc.cases.map(evaluateBenchmarkCase);
  const totalDurationMs = performance.now() - startedAt;
  const scored = results.filter(r => r.scored);
  const passed = scored.filter(r => r.pass).length;
  const failed = scored.filter(r => !r.pass).length;
  const observed = results.filter(r => !r.scored).length;
  const resolved = results.filter(r => r.actual?.status === 'resolved').length;
  const incomplete = results.filter(r => r.actual?.status === 'incomplete').length;

  return {
    reportVersion: 2,
    engine: 'Runtime Expert V3 World Model',
    benchmark: {
      schemaVersion: doc.schemaVersion,
      name: doc.name,
      description: doc.description
    },
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      scored: scored.length,
      passed,
      failed,
      observed,
      resolved,
      incomplete,
      passRate: scored.length ? passed / scored.length : null,
      totalDurationMs,
      averageDurationMs: results.length ? totalDurationMs / results.length : 0
    },
    results
  };
}

function csvCell(value) {
  const valueText = value == null ? '' : String(value);
  return `"${valueText.replace(/"/g, '""')}"`;
}

export function reportToCSV(report) {
  const header = [
    'id','pass','scored','status','target','value','target_confidence',
    'motors','steps','world_nodes','relations','issues','duration_ms',
    'prompt','tags','answer','error'
  ];
  const rows = report.results.map(r => [
    r.id,
    r.pass === null ? '' : r.pass,
    r.scored,
    r.actual?.status || '',
    r.actual?.target || '',
    r.actual?.value ?? '',
    r.actual?.targetConfidence ?? '',
    r.actual?.motors?.join(' > ') || '',
    r.actual?.stepCount ?? '',
    r.actual?.worldSummary?.nodeCount ?? '',
    r.actual?.worldSummary?.relationCount ?? '',
    r.actual?.issues?.map(x=>x.type).join(' | ') || '',
    r.durationMs.toFixed(3),
    r.prompt,
    r.tags.join(' | '),
    r.actual?.answer || '',
    r.error || ''
  ]);
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
}

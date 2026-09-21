import { EXTERNAL_GEMINI_500 } from './external_gemini_500.js';
import { makeStarterProject, runVibeCoder } from './vibe_engine.js';

const results = EXTERNAL_GEMINI_500.map((prompt, index) => {
  const project = makeStarterProject('external');
  const r = runVibeCoder(prompt, project);
  return {
    id: index + 1,
    ok: Boolean(r.ok),
    steps: r.plan?.length || 0,
    candidates: r.stats?.candidatesEvaluated || 0,
    missing: r.missing || []
  };
});

const resolved = results.filter(x => x.ok).length;
const incomplete = results.length - resolved;
const summary = {
  benchmark: 'External Gemini 500 — frozen first-shot',
  total: results.length,
  resolved,
  incomplete,
  resolutionRate: resolved / results.length
};

console.log(JSON.stringify(summary, null, 2));
console.log('resolved ids:', results.filter(x=>x.ok).map(x=>x.id).join(',') || '(none)');
console.log('sample failures:', JSON.stringify(results.filter(x=>!x.ok).slice(0,20), null, 2));

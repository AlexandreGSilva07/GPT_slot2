import { analyzeV3 } from './engine_v3.js';
import { parseBenchmarkJSON, runBenchmarkDocument, reportToCSV } from './benchmark.js';
import { generateBusinessHard6_1200 } from './hard_business_1200_blind6.js';

const $ = s => document.querySelector(s);
const promptEl = $('#prompt');
const answerEl = $('#answer');
const stepsEl = $('#steps');
const normalizedEl = $('#normalized');
const goalEl = $('#goalTrace');
const nodesEl = $('#worldNodes');
const relationsEl = $('#worldRelations');
const issuesEl = $('#worldIssues');
const targetEl = $('#target');
const expertEl = $('#expert');
const statusEl = $('#status');

let loadedBenchmark = null;
let loadedBenchmarkFileName = '';
let lastBenchmarkReport = null;

const examples = [
  'comprei 120 unidades por 18 cada. vendas: 70 x 32 / 50 x 35. taxa 6% sobre faturamento. fixo 100. lucro liquido?',
  'site: 40 x 55, taxa 4%; marketplace: 60 x 52, taxa 12%; balcao: 20 x 58, taxa 2%. custo por item 24; fixo 300. resultado liquido?',
  'preco 45; custo unitario 18; taxa 6%; devolucao 2%; fixo 2400. ponto de equilibrio em unidades?',
  'antes: 80 x 30 / 40 x 35. agora: 70 x 38 / 60 x 36. quanto mudou o faturamento em %?'
];

$('#examples').innerHTML = examples.map((x,i)=>`<button data-i="${i}">Exemplo ${i+1}</button>`).join('');
$('#examples').addEventListener('click', e => {
  const i = e.target?.dataset?.i;
  if (i !== undefined) {
    promptEl.value = examples[Number(i)];
    run();
  }
});

function esc(v='') {
  return String(v).replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmt(v) {
  if (!Number.isFinite(Number(v))) return String(v ?? '—');
  return Number(v).toLocaleString('pt-BR',{maximumFractionDigits:4});
}

function pretty(value) {
  return esc(JSON.stringify(value, null, 2));
}

function compactValueState(v) {
  if (!v || typeof v !== 'object' || !v.state) return v;
  const out = {state:v.state};
  if ('value' in v) out.value = v.value;
  if (v.expression) out.expression = v.expression;
  if (v.dependencies) out.dependencies = v.dependencies;
  if (v.reason) out.reason = v.reason;
  if (v.candidates) out.candidates = v.candidates;
  if (v.source) out.source = v.source;
  return out;
}

function compactNode(n) {
  return {
    id:n.id,
    type:n.type,
    fields:Object.fromEntries(
      Object.entries(n.fields || {}).map(([k,v])=>[k,compactValueState(v)])
    ),
    links:n.links || {},
    source:n.meta?.source || null
  };
}

function run() {
  const r = analyzeV3(promptEl.value);

  normalizedEl.textContent = r.normalized || '—';
  goalEl.textContent = r.goal ? JSON.stringify(r.goal,null,2) : '—';
  nodesEl.textContent = r.world?.nodes?.length
    ? r.world.nodes.map(compactNode).map(x=>JSON.stringify(x,null,2)).join('\n\n')
    : '—';
  relationsEl.textContent = r.world?.relations?.length
    ? JSON.stringify(r.world.relations,null,2)
    : '—';
  issuesEl.textContent = (r.world?.issues?.length || r.missing?.length)
    ? JSON.stringify({parserIssues:r.world?.issues || [],plannerMissing:r.missing || []},null,2)
    : 'nenhum';

  targetEl.innerHTML = r.target
    ? `<b>${esc(r.target)}</b><small>${esc(r.goal?.source || 'objetivo inferido')} · confiança ${Math.round((r.goal?.confidence || 0)*100)}%</small>`
    : '<b>Não identificado</b><small>nenhum objetivo compatível com o domínio foi inferido</small>';

  $('#nodeCount').textContent = r.worldSummary?.nodeCount ?? 0;
  $('#motorCount').textContent = r.motors?.length ?? 0;
  $('#stepCount').textContent = r.steps?.length ?? 0;

  expertEl.innerHTML = r.steps?.length
    ? `<div class="motor-row">${r.motors.map(m=>`<span>${esc(m)}</span>`).join('<i>+</i>')}</div><code>${esc(r.expertSignature)}</code>`
    : '<span>Nenhum expert pôde ser materializado.</span>';

  if (r.ok) {
    statusEl.textContent = 'resolvido';
    statusEl.className = 'status ok';
    answerEl.className = 'answer';
    answerEl.innerHTML = `
      <span>RESULTADO · V3 WORLD MODEL</span>
      <strong>${esc(r.answer)}</strong>
      <small>O resultado foi materializado a partir de eventos, escopos e dependências do World Model.</small>`;
    stepsEl.innerHTML = r.steps.map((s,i)=>`
      <article>
        <div class="step-index">${i+1}</div>
        <div>
          <b>${esc(s.motor)}</b>
          <code>${esc(s.expression || s.id)}</code>
          <span>→ ${esc(fmt(s.value))}</span>
        </div>
      </article>`).join('');
  } else {
    statusEl.textContent = 'incompleto';
    statusEl.className = 'status warn';
    answerEl.className = 'answer empty';
    const missing = r.missing?.length ? JSON.stringify(r.missing) : 'dados ou relações insuficientes';
    answerEl.innerHTML = `
      <strong>Não consegui montar um caminho completo.</strong>
      <small>A V3 preserva UNKNOWN/AMBIGUOUS e recusa inventar fatos necessários. ${esc(missing)}</small>`;
    stepsEl.innerHTML = r.steps?.map((s,i)=>`
      <article>
        <div class="step-index">${i+1}</div>
        <div>
          <b>${esc(s.motor)}</b>
          <code>${esc(s.expression || s.id)}</code>
          <span>→ ${esc(fmt(s.value))}</span>
        </div>
      </article>`).join('') || '';
  }
}

$('#runBtn').onclick = run;
promptEl.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run();
});
$('#clearBtn').onclick = () => {
  promptEl.value='';
  promptEl.focus();
};

$('#benchBtn').onclick = async () => {
  const btn = $('#benchBtn');
  const out = $('#benchResult');
  btn.disabled = true;
  btn.textContent = 'Executando 1.200 casos...';
  out.textContent = 'Executando o Hard6 congelado na V3...';
  await new Promise(resolve=>setTimeout(resolve,20));
  try {
    const start=performance.now();
    const report=runBenchmarkDocument(generateBusinessHard6_1200());
    const ms=performance.now()-start;
    out.innerHTML = `
      <b>${report.summary.passed.toLocaleString('pt-BR')}/${report.summary.scored.toLocaleString('pt-BR')}</b>
      casos aprovados · <b>${(report.summary.passRate*100).toFixed(2)}%</b> · <b>${ms.toFixed(1)} ms</b>
      <br><span>Hard6 congelado: eventos repetidos, canais, temporal, desconto, devolução, restante derivado, markup, break-even e recusas.</span>`;
  } catch (error) {
    out.innerHTML = `<b>Falha:</b> ${esc(error.message)}`;
  } finally {
    btn.disabled=false;
    btn.textContent='Rodar Hard6 interno · 1.200 casos';
  }
};

function downloadBlob(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileStem(name) {
  return String(name || 'benchmark')
    .replace(/\.json$/i,'')
    .replace(/[^a-zA-Z0-9_-]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80) || 'benchmark';
}

function renderCheck(check) {
  return `
    <li class="${check.pass ? 'check-pass' : 'check-fail'}">
      <b>${check.pass ? 'PASS' : 'FAIL'} · ${esc(check.name)}</b>
      <span>esperado: <code>${esc(JSON.stringify(check.expected))}</code></span>
      <span>obtido: <code>${esc(JSON.stringify(check.actual))}</code></span>
    </li>`;
}

function renderBenchmarkCases(report) {
  const box = $('#customBenchCases');
  box.innerHTML = report.results.map((r, index) => {
    const cls = r.pass === true ? 'pass' : r.pass === false ? 'fail' : 'observed';
    const label = r.pass === true ? 'PASS' : r.pass === false ? 'FAIL' : 'OBSERVADO';
    const checks = r.checks?.length
      ? `<ul class="check-list">${r.checks.map(renderCheck).join('')}</ul>`
      : '<p class="muted">Sem gabarito suficiente para pontuar este caso.</p>';

    const actual = r.actual;
    const trace = actual ? `
      <div class="case-grid">
        <article><h4>Normalizado</h4><pre>${esc(actual.normalized)}</pre></article>
        <article><h4>World summary</h4><pre>${pretty(actual.worldSummary)}</pre></article>
        <article><h4>Nós / value states</h4><pre>${pretty(actual.nodes)}</pre></article>
        <article><h4>Relações / escopos</h4><pre>${pretty(actual.relations)}</pre></article>
        <article><h4>Issues + missing</h4><pre>${pretty({issues:actual.issues,missing:actual.missing})}</pre></article>
        <article><h4>Expert</h4><pre>${esc(actual.expertSignature)}</pre></article>
      </div>
      <h4>Etapas materializadas</h4>
      <pre class="json-block">${pretty(actual.steps)}</pre>
      <h4>Valores finais</h4>
      <pre class="json-block">${pretty(actual.values)}</pre>
    ` : `<pre class="json-block error-block">${esc(r.error || 'Sem resultado')}</pre>`;

    return `
      <details class="bench-case ${cls}" ${index < 3 || cls === 'fail' ? 'open' : ''}>
        <summary>
          <span class="case-index">${index + 1}</span>
          <span class="case-main"><b>${esc(r.id)}</b><small>${esc(r.prompt)}</small></span>
          <span class="case-status">${label}</span>
          <span class="case-time">${r.durationMs.toFixed(2)} ms</span>
        </summary>
        <div class="case-body">
          ${r.tags.length ? `<div class="tag-row">${r.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>` : ''}
          ${r.note ? `<p class="muted">${esc(r.note)}</p>` : ''}
          <div class="expected-actual">
            <div><h4>Expected</h4><pre class="json-block">${pretty(r.expected)}</pre></div>
            <div><h4>Resposta</h4><pre class="json-block">${pretty(actual ? {
              engine:actual.engineVersion,
              status:actual.status,
              target:actual.target,
              value:actual.value,
              answer:actual.answer,
              motors:actual.motors,
              stepCount:actual.stepCount
            } : null)}</pre></div>
          </div>
          <h4>Checks</h4>
          ${checks}
          ${trace}
        </div>
      </details>`;
  }).join('');
}

function renderBenchmarkSummary(report) {
  const s = report.summary;
  $('#benchTotal').textContent = s.total;
  $('#benchPassed').textContent = s.passed;
  $('#benchFailed').textContent = s.failed;
  $('#benchObserved').textContent = s.observed;
  $('#benchResolved').textContent = s.resolved;
  $('#benchIncomplete').textContent = s.incomplete;
  $('#customBenchSummary').classList.remove('hidden');
  $('#downloadRow').classList.remove('hidden');

  const scoredText = s.scored
    ? `${s.passed}/${s.scored} pontuados aprovados (${(s.passRate*100).toFixed(1)}%)`
    : 'sem casos pontuados';
  $('#customBenchStatus').innerHTML =
    `<b>${esc(report.benchmark.name)}</b> · V3 World Model · ${scoredText} · ${s.observed} observacionais · ${s.totalDurationMs.toFixed(1)} ms total`;
}

$('#benchmarkFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  loadedBenchmark = null;
  lastBenchmarkReport = null;
  $('#runCustomBenchBtn').disabled = true;
  $('#downloadRow').classList.add('hidden');
  $('#customBenchSummary').classList.add('hidden');
  $('#customBenchCases').innerHTML = '';

  if (!file) {
    $('#benchmarkFileName').textContent = 'Nenhum arquivo selecionado';
    $('#customBenchStatus').textContent = 'Aguardando um arquivo JSON.';
    return;
  }

  loadedBenchmarkFileName = file.name;
  $('#benchmarkFileName').textContent = file.name;

  try {
    loadedBenchmark = parseBenchmarkJSON(await file.text());
    $('#runCustomBenchBtn').disabled = false;
    $('#customBenchStatus').innerHTML =
      `<b>JSON válido.</b> ${loadedBenchmark.cases.length} casos carregados · ${esc(loadedBenchmark.name)}`;
  } catch (error) {
    $('#customBenchStatus').innerHTML = `<b>Erro no JSON:</b> ${esc(error.message)}`;
  }
});

$('#runCustomBenchBtn').onclick = async () => {
  if (!loadedBenchmark) return;
  const btn = $('#runCustomBenchBtn');
  btn.disabled = true;
  btn.textContent = 'Executando...';
  $('#customBenchStatus').textContent = `Executando ${loadedBenchmark.cases.length} casos na V3...`;
  await new Promise(resolve => setTimeout(resolve, 20));

  try {
    lastBenchmarkReport = runBenchmarkDocument(loadedBenchmark);
    renderBenchmarkSummary(lastBenchmarkReport);
    renderBenchmarkCases(lastBenchmarkReport);
  } catch (error) {
    $('#customBenchStatus').innerHTML = `<b>Falha no benchmark:</b> ${esc(error.message)}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Rodar benchmark personalizado';
  }
};

$('#downloadJsonBtn').onclick = () => {
  if (!lastBenchmarkReport) return;
  const stem = safeFileStem(loadedBenchmarkFileName);
  downloadBlob(
    `${stem}-resultados-v3.json`,
    JSON.stringify(lastBenchmarkReport, null, 2),
    'application/json;charset=utf-8'
  );
};

$('#downloadCsvBtn').onclick = () => {
  if (!lastBenchmarkReport) return;
  const stem = safeFileStem(loadedBenchmarkFileName);
  downloadBlob(
    `${stem}-resumo-v3.csv`,
    '\uFEFF' + reportToCSV(lastBenchmarkReport),
    'text/csv;charset=utf-8'
  );
};

$('#sampleBtn').onclick = async () => {
  try {
    const response = await fetch('./benchmark.example.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    downloadBlob('benchmark.example.json', await response.text(), 'application/json;charset=utf-8');
  } catch (error) {
    $('#customBenchStatus').innerHTML = `<b>Não consegui baixar o modelo:</b> ${esc(error.message)}`;
  }
};

run();

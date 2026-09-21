import { composeSrcdoc, makeStarterProject, runVibeCoder } from './vibe_engine.js';
import { runVibeBenchmark500 } from './vibe_benchmark_500.js';

const $=s=>document.querySelector(s);
const htmlEditor=$('#htmlEditor'), jsEditor=$('#jsEditor'), cssEditor=$('#cssEditor');
let project=makeStarterProject('demo');

const examples=[
  'mude o texto de #titulo-demo para "Painel principal"',
  'adicione a classe destaque em #painel-demo',
  'esconda #painel-demo',
  'crie um <p> com id novo-aviso e texto "Tudo certo" dentro de #app-demo',
  'ao clicar em #botao-demo, altere o texto de #status-demo para "Executado"',
  'ao clicar em #botao-demo, alterne a classe ativo em #painel-demo',
  'no CSS, defina color de #titulo-demo para tomato'
];

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function syncEditors(){ htmlEditor.value=project.html; jsEditor.value=project.js; cssEditor.value=project.css; updatePreview(); }
function readEditors(){ project={html:htmlEditor.value,js:jsEditor.value,css:cssEditor.value}; }
function updatePreview(){ $('#preview').srcdoc=composeSrcdoc(project); }
function renderResult(r){
  $('#status').textContent=r.ok?'resolvido':'incompleto';
  $('#status').className=`status ${r.ok?'ok':'warn'}`;
  $('#stepCount').textContent=r.stats?.steps??0;
  $('#candidateCount').textContent=r.stats?.candidatesEvaluated??0;
  $('#segmentCount').textContent=r.stats?.segments??0;
  $('#expert').textContent=r.expertSignature||r.missing?.join(' · ')||'—';
  $('#plan').innerHTML=(r.plan||[]).map((x,i)=>`<article><div class="step-index">${i+1}</div><div><b>${esc(x.expert)}</b><code>${esc(JSON.stringify(x.args))}</code><span>${esc(x.family)}</span></div></article>`).join('');
  $('#trace').textContent=JSON.stringify(r.trace,null,2);
}
function run(){ readEditors(); const r=runVibeCoder($('#prompt').value,project); if(r.ok){project=r.project;syncEditors();} renderResult(r); }

$('#examples').innerHTML=examples.map((x,i)=>`<button data-i="${i}">${esc(x)}</button>`).join('');
$('#examples').onclick=e=>{const b=e.target.closest('button'); if(b) $('#prompt').value=examples[Number(b.dataset.i)];};
$('#runBtn').onclick=run;
$('#resetBtn').onclick=()=>{project=makeStarterProject('demo');syncEditors();renderResult({ok:false,plan:[],trace:[],stats:{steps:0,candidatesEvaluated:0,segments:0},missing:['Projeto resetado']});};
for(const el of [htmlEditor,jsEditor,cssEditor]) el.addEventListener('input',()=>{readEditors();updatePreview();});
$('#prompt').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')run();});

$('#benchBtn').onclick=async()=>{
  const btn=$('#benchBtn'), out=$('#benchResult'); btn.disabled=true;btn.textContent='Executando...';out.textContent='Rodando 500 casos...';
  await new Promise(r=>setTimeout(r,20));
  try{
    const report=runVibeBenchmark500();
    out.innerHTML=`<b>${report.passed}/${report.total}</b> aprovados · <b>${(report.passRate*100).toFixed(2)}%</b> · ${report.totalDurationMs.toFixed(1)} ms`;
    $('#benchCategories').innerHTML=Object.entries(report.byCategory).map(([name,x])=>`<article class="${x.passed===x.total?'pass':'fail'}"><b>${esc(name)}</b><span>${x.passed}/${x.total}</span></article>`).join('');
  }catch(error){out.innerHTML=`<b>Falha:</b> ${esc(error.message||error)}`;}
  finally{btn.disabled=false;btn.textContent='Rodar 500 casos';}
};

syncEditors();
run();

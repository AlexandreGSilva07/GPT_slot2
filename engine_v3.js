import {parseWorld} from './world_parser.js';
import {planWorld,WORLD_EXPERTS} from './world_planner.js';
import {worldSummary} from './world_model.js';

const labels={
  revenue:'faturamento',
  netProfit:'lucro líquido',
  marginPct:'margem líquida',
  markupPct:'markup',
  breakEvenUnits:'ponto de equilíbrio',
  growthPct:'crescimento',
  reductionPct:'redução'
};

function format(target,value){
  if(!Number.isFinite(value))return'indefinido';
  if(target?.endsWith('Pct'))return `${+value.toFixed(2)}%`;
  if(target==='breakEvenUnits')return `${Math.ceil(value)} unidades`;
  return `R$ ${value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

export function analyzeV3(input){
  const parsed=parseWorld(input);
  const planned=planWorld(parsed.world);
  const target=planned.target;
  return {
    version:'3.0.0-dev',
    normalized:parsed.normalized,
    goal:parsed.goal,
    world:parsed.world,
    worldSummary:worldSummary(parsed.world),
    ok:planned.ok,
    target,
    value:planned.value,
    values:planned.values,
    steps:planned.steps,
    motors:planned.motors,
    missing:planned.missing,
    answer:planned.ok?`${labels[target]||target}: ${format(target,planned.value)}.`:null,
    expertSignature:planned.steps.length?planned.steps.map(s=>s.id).join(' → '):'nenhum expert',
    expertLibrary:WORLD_EXPERTS
  };
}

export {parseWorld,planWorld,WORLD_EXPERTS};

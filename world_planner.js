import {
  VALUE_STATE,isKnown,unwrap,nodesOf,findNode,fieldValue,related
} from './world_model.js';

export const WORLD_EXPERTS = Object.freeze([
  'event',
  'reference',
  'scope',
  'aggregation',
  'transformation',
  'cost',
  'inventory',
  'commercial',
  'profitability',
  'temporal',
  'break-even',
  'constraint'
]);

function step(id,motor,output,value,expression,meta={}){
  return {id,motor,output,value,expression,meta};
}

function fail(target,missing=[],steps=[],values={}){
  return {
    ok:false,target,value:undefined,values,steps,
    motors:[...new Set(steps.map(s=>s.motor))],
    missing
  };
}

function success(target,value,steps=[],values={}){
  return {
    ok:Number.isFinite(value),target,value,
    values:{...values,[target]:value},
    steps,
    motors:[...new Set(steps.map(s=>s.motor))],
    missing:Number.isFinite(value)?[]:[{type:'NON_FINITE',target}]
  };
}

function stateProblem(v,label){
  if(!v)return {type:'MISSING',field:label};
  if(v.state===VALUE_STATE.UNKNOWN)return {type:'UNKNOWN_REQUIRED',field:label,reason:v.reason};
  if(v.state===VALUE_STATE.AMBIGUOUS)return {type:'AMBIGUOUS',field:label,candidates:v.candidates};
  if(!isKnown(v))return {type:'UNRESOLVED',field:label,state:v.state};
  return null;
}

function numericField(n,key,label=key){
  const v=n?.fields?.[key];
  const issue=stateProblem(v,label);
  return issue?{ok:false,issue}:{ok:true,value:unwrap(v)};
}

function appliesTo(world,node,target){
  if(!node)return false;
  if(node.links?.scope==='ALL_SALES')return target.type==='SALE';
  if(node.links?.scope===target.id)return true;
  if(node.links?.scope && target.links?.channel && node.links.scope===target.links.channel)return true;
  return world.relations.some(r=>r.type==='APPLIES_TO'&&r.from===node.id&&r.to===target.id);
}

function returnsForSale(world,sale){
  return nodesOf(world,'RETURN').filter(r=>appliesTo(world,r,sale) || r.links?.scope==='ALL_SALES');
}
function discountsForSale(world,sale){
  return nodesOf(world,'DISCOUNT').filter(d=>appliesTo(world,d,sale) || d.links?.scope==='ALL_SALES');
}
function feesForSale(world,sale){
  return nodesOf(world,'FEE').filter(f=>appliesTo(world,f,sale) || f.links?.scope==='ALL_SALES');
}

function resolveSale(world,sale,{forProfit=false}={}){
  const steps=[],missing=[];
  const q=numericField(sale,'quantity',`${sale.id}.quantity`);
  const p=numericField(sale,'unitPrice',`${sale.id}.unitPrice`);
  if(!q.ok)missing.push(q.issue);
  if(!p.ok)missing.push(p.issue);
  if(missing.length)return {ok:false,missing,steps};

  let quantity=q.value;
  let unitPrice=p.value;

  for(const d of discountsForSale(world,sale)){
    const r=numericField(d,'ratePct',`${d.id}.ratePct`);
    if(!r.ok){missing.push(r.issue);continue}
    unitPrice=unitPrice*(1-r.value/100);
    steps.push(step('transformation.discount','transformation',`${sale.id}.effectiveUnitPrice`,unitPrice,'preço efetivo = preço × (1 − desconto%)',{saleId:sale.id,discountId:d.id}));
  }

  let returned=0;
  for(const ret of returnsForSale(world,sale)){
    if(ret.fields?.quantity){
      const rq=numericField(ret,'quantity',`${ret.id}.quantity`);
      if(!rq.ok){missing.push(rq.issue);continue}
      returned+=rq.value;
    }else if(ret.fields?.ratePct){
      const rr=numericField(ret,'ratePct',`${ret.id}.ratePct`);
      if(!rr.ok){missing.push(rr.issue);continue}
      returned+=quantity*rr.value/100;
    }
  }

  if(returned){
    quantity=Math.max(0,quantity-returned);
    steps.push(step('inventory.returns','inventory',`${sale.id}.completedQuantity`,quantity,'quantidade concluída = vendas − devoluções',{saleId:sale.id,returned}));
  }

  if(missing.length)return {ok:false,missing,steps};

  const revenue=quantity*unitPrice;
  steps.push(step('commercial.saleRevenue','commercial',`${sale.id}.revenue`,revenue,'receita do evento = quantidade efetiva × preço efetivo',{saleId:sale.id}));
  return {ok:true,quantity,unitPrice,revenue,returned,steps};
}

function resolveRevenue(world,scope=null){
  const allSales=nodesOf(world,'SALE');
  const sales=scope?.periodId?allSales.filter(s=>s.links?.period===scope.periodId):allSales;
  if(!sales.length)return fail('revenue',[{type:'MISSING',field:'SALE'}]);

  const steps=[],missing=[],parts=[];
  for(const sale of sales){
    const r=resolveSale(world,sale);
    steps.push(...r.steps);
    if(!r.ok){missing.push(...r.missing);continue}
    parts.push({saleId:sale.id,revenue:r.revenue,quantity:r.quantity});
  }
  if(missing.length)return fail('revenue',missing,steps);
  const total=parts.reduce((a,b)=>a+b.revenue,0);
  steps.push(step('aggregation.sumRevenue','aggregation','revenue',total,'receita total = Σ receita(evento)',{parts}));
  return success('revenue',total,steps,{saleRevenueParts:parts});
}

function resolveUnitCost(world){
  const purchases=nodesOf(world,'PURCHASE');
  const known=[];
  const missing=[];
  for(const p of purchases){
    if(!p.fields?.unitCost)continue;
    const c=numericField(p,'unitCost',`${p.id}.unitCost`);
    if(c.ok)known.push(c.value); else missing.push(c.issue);
  }
  if(missing.length)return {ok:false,missing};
  const uniq=[...new Set(known)];
  if(uniq.length>1)return {ok:false,missing:[{type:'AMBIGUOUS',field:'unitCost',candidates:uniq}]};
  if(!uniq.length)return {ok:false,missing:[{type:'MISSING',field:'unitCost'}]};

  let unitCost=uniq[0],steps=[];
  const components=nodesOf(world,'COST_COMPONENT').filter(c=>c.links?.perUnit!==false);
  for(const c of components){
    const amount=numericField(c,'amount',`${c.id}.amount`);
    if(!amount.ok)return {ok:false,missing:[amount.issue],steps};
    unitCost+=amount.value;
    steps.push(step('cost.addComponent','cost','landedUnitCost',unitCost,'custo unitário total = custo base + componente',{component:c.id}));
  }
  return {ok:true,value:unitCost,steps};
}

function resolveRecognizedCost(world){
  const sales=nodesOf(world,'SALE');
  const cost=resolveUnitCost(world);
  if(!cost.ok)return {ok:false,missing:cost.missing,steps:cost.steps||[]};

  const steps=[...(cost.steps||[])],missing=[];
  let units=0;
  if(sales.length){
    for(const sale of sales){
      const r=resolveSale(world,sale,{forProfit:true});
      steps.push(...r.steps.filter(x=>x.id==='inventory.returns'));
      if(!r.ok){missing.push(...r.missing);continue}
      units+=r.quantity;
    }
  }else{
    const purchases=nodesOf(world,'PURCHASE');
    const qs=purchases.map(p=>numericField(p,'quantity',`${p.id}.quantity`));
    for(const q of qs)if(!q.ok)missing.push(q.issue);else units+=q.value;
  }
  if(missing.length)return {ok:false,missing,steps};

  const total=units*cost.value;
  steps.push(step('cost.recognized','cost','totalCost',total,'custo reconhecido = unidades concluídas × custo unitário total',{units,unitCost:cost.value}));
  return {ok:true,value:total,unitCost:cost.value,units,steps};
}

function resolveFees(world){
  const sales=nodesOf(world,'SALE');
  const steps=[],missing=[];
  let total=0;
  for(const sale of sales){
    const sr=resolveSale(world,sale);
    if(!sr.ok){missing.push(...sr.missing);continue}
    for(const fee of feesForSale(world,sale)){
      const rate=numericField(fee,'ratePct',`${fee.id}.ratePct`);
      if(!rate.ok){missing.push(rate.issue);continue}
      const amount=sr.revenue*rate.value/100;
      total+=amount;
      steps.push(step('transformation.fee','transformation',`${fee.id}.amount`,amount,'taxa = receita do escopo × taxa%',{feeId:fee.id,saleId:sale.id,ratePct:rate.value}));
    }
  }
  if(missing.length)return {ok:false,missing,steps};
  return {ok:true,value:total,steps};
}

function resolveFixed(world){
  let total=0,steps=[],missing=[];
  for(const n of nodesOf(world,'FIXED_COST')){
    const a=numericField(n,'amount',`${n.id}.amount`);
    if(!a.ok){missing.push(a.issue);continue}
    total+=a.value;
  }
  if(missing.length)return {ok:false,missing,steps};
  if(total)steps.push(step('cost.fixed','cost','fixedCost',total,'custos fixos = Σ componentes fixos'));
  return {ok:true,value:total,steps};
}

function resolveProfit(world){
  const rev=resolveRevenue(world),cost=resolveRecognizedCost(world),fees=resolveFees(world),fixed=resolveFixed(world);
  const steps=[...rev.steps,...(cost.steps||[]),...(fees.steps||[]),...(fixed.steps||[])];
  const missing=[...(rev.missing||[]),...(cost.missing||[]),...(fees.missing||[]),...(fixed.missing||[])];
  if(missing.length)return fail('netProfit',missing,steps);
  const value=rev.value-cost.value-fees.value-fixed.value;
  steps.push(step('profit.net','profitability','netProfit',value,'lucro líquido = receita − custo reconhecido − taxas − fixos'));
  return success('netProfit',value,steps,{revenue:rev.value,totalCost:cost.value,feeValue:fees.value,fixedCost:fixed.value});
}

function resolveMargin(world){
  const p=resolveProfit(world);
  if(!p.ok)return fail('marginPct',p.missing,p.steps,p.values);
  const revenue=p.values.revenue;
  if(!revenue)return fail('marginPct',[{type:'ZERO_BASE',field:'revenue'}],p.steps,p.values);
  const value=p.value/revenue*100;
  const steps=[...p.steps,step('profit.margin','profitability','marginPct',value,'margem% = lucro líquido ÷ receita × 100')];
  return success('marginPct',value,steps,{...p.values,netProfit:p.value});
}

function resolveMarkup(world){
  const sales=nodesOf(world,'SALE');
  if(sales.length!==1)return fail('markupPct',[{type:'AMBIGUOUS',field:'sale',count:sales.length}]);
  const p=numericField(sales[0],'unitPrice',`${sales[0].id}.unitPrice`);
  const c=resolveUnitCost(world);
  const missing=[];
  if(!p.ok)missing.push(p.issue);
  if(!c.ok)missing.push(...c.missing);
  const steps=[...(c.steps||[])];
  if(missing.length)return fail('markupPct',missing,steps);
  const value=(p.value/c.value-1)*100;
  steps.push(step('profit.markup','profitability','markupPct',value,'markup% = (preço ÷ custo total − 1) × 100',{salePrice:p.value,unitCost:c.value}));
  return success('markupPct',value,steps,{salePrice:p.value,unitCost:c.value});
}

function globalRate(world,type){
  const nodes=nodesOf(world,type);
  if(!nodes.length)return {ok:true,value:0};
  const relevant=nodes.filter(n=>n.links?.scope==='ALL_SALES'||!n.links?.scope);
  if(!relevant.length && nodes.length===1)return numericField(nodes[0],type==='FEE'?'ratePct':'ratePct');
  if(relevant.length!==1)return {ok:false,missing:[{type:'AMBIGUOUS',field:`${type}.ratePct`,count:relevant.length}]};
  const r=numericField(relevant[0],'ratePct',`${relevant[0].id}.ratePct`);
  return r.ok?{ok:true,value:r.value}:{ok:false,missing:[r.issue]};
}

function resolveBreakEven(world){
  const fixed=resolveFixed(world);
  const unit=resolveUnitCost(world);
  const sales=nodesOf(world,'SALE');
  const missing=[...(fixed.missing||[]),...(unit.missing||[])];
  if(sales.length!==1)missing.push({type:'AMBIGUOUS',field:'sale',count:sales.length});
  let price;
  if(sales.length===1){
    const p=numericField(sales[0],'unitPrice',`${sales[0].id}.unitPrice`);
    if(!p.ok)missing.push(p.issue); else price=p.value;
  }
  const fee=globalRate(world,'FEE');
  if(!fee.ok)missing.push(...fee.missing);
  const ret=globalRate(world,'RETURN');
  if(!ret.ok)missing.push(...ret.missing);
  const steps=[...(fixed.steps||[]),...(unit.steps||[])];
  if(missing.length)return fail('breakEvenUnits',missing,steps);
  const contribution=price-unit.value-price*(fee.value||0)/100-price*(ret.value||0)/100;
  steps.push(step('break.contribution','break-even','contributionUnit',contribution,'contribuição = preço − custo − taxa − devolução',{price,unitCost:unit.value,feePct:fee.value||0,returnsPct:ret.value||0}));
  if(!(contribution>0))return fail('breakEvenUnits',[{type:'NON_POSITIVE_CONTRIBUTION',value:contribution}],steps);
  const value=Math.ceil(fixed.value/contribution);
  steps.push(step('break.units','break-even','breakEvenUnits',value,'equilíbrio = teto(custos fixos ÷ contribuição)'));
  return success('breakEvenUnits',value,steps,{fixedCost:fixed.value,contributionUnit:contribution});
}

function resolveTemporal(world){
  const periods=nodesOf(world,'PERIOD');
  const prev=periods.find(p=>p.fields?.label?.value==='previous');
  const cur=periods.find(p=>p.fields?.label?.value==='current');
  if(!prev||!cur)return fail('changePct',[{type:'MISSING',field:'previous/current period'}]);
  const a=resolveRevenue(world,{periodId:prev.id}),b=resolveRevenue(world,{periodId:cur.id});
  const steps=[...a.steps,...b.steps],missing=[...(a.missing||[]),...(b.missing||[])];
  if(missing.length)return fail('changePct',missing,steps);
  if(!a.value)return fail('changePct',[{type:'ZERO_BASE',field:'previousRevenue'}],steps);
  const delta=b.value-a.value;
  const target=delta>=0?'growthPct':'reductionPct';
  const value=Math.abs(delta)/a.value*100;
  steps.push(step('temporal.compare','temporal',target,value,'variação% = |atual − anterior| ÷ anterior × 100',{previous:a.value,current:b.value}));
  return success(target,value,steps,{previous:a.value,current:b.value});
}

function unresolvedExplicitUnknowns(world,metric){
  if(metric==='revenue'){
    return world.issues.filter(i=>i.type==='UNKNOWN_REQUIRED' && ['discount','returnQuantity'].includes(i.concept));
  }
  if(['netProfit','marginPct','markupPct','breakEvenUnits'].includes(metric)){
    return world.issues.filter(i=>i.type==='UNKNOWN_REQUIRED'||i.type==='AMBIGUOUS');
  }
  return [];
}

export function planWorld(world,goalOverride=null){
  const goal=goalOverride || world.goals?.[0]?.metric || null;
  if(!goal)return fail(null,[{type:'MISSING_GOAL'}]);

  const blockers=unresolvedExplicitUnknowns(world,goal);
  if(blockers.length)return fail(goal,blockers);

  if(goal==='revenue')return resolveRevenue(world);
  if(goal==='netProfit')return resolveProfit(world);
  if(goal==='marginPct')return resolveMargin(world);
  if(goal==='markupPct')return resolveMarkup(world);
  if(goal==='breakEvenUnits')return resolveBreakEven(world);
  if(goal==='changePct')return resolveTemporal(world);
  if(goal==='growthPct'||goal==='reductionPct')return resolveTemporal(world);
  return fail(goal,[{type:'UNSUPPORTED_GOAL',goal}]);
}

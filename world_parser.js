import {
  createWorld,node,addNode,addRelation,addGoal,addIssue,nextId,
  Known,Unknown,Ambiguous,Derived
} from './world_model.js';

const ALIASES = {
  conprei:'comprei', cmprei:'comprei', compri:'comprei', compro:'comprei', peguei:'comprei',
  pessa:'peca', pecas:'peca', produtos:'produto', itens:'item', unidades:'unidade', unid:'unidade',
  vendi:'vendi', vendo:'vendi', revendi:'vendi', revendo:'vendi', repassei:'repassai',
  mercadoria:'produto', mercadorias:'produto', plataforma:'plataforma',
  qnt:'quanto', qt:'quanto', qto:'quanto', qtas:'quantas', qta:'quanta',
  market:'marketplace', marketplase:'marketplace',
  comissao:'taxa', tarifa:'taxa',
  devolucoes:'devolucao', devolvidas:'devolvida', devolvidos:'devolvida', devolvido:'devolvida', retornou:'devolvida', retornaram:'devolvida',
  canceladas:'cancelada', cancelados:'cancelada', cancelado:'cancelada',
  fixos:'fixo', fixa:'fixo', estrutura:'fixo',
  faturamento:'faturamento', faturei:'faturamento',
  variacao:'variacao', reducao:'reducao'
};

function deaccent(s){
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

export function normalizeWorldText(input){
  let s=deaccent(input).toLowerCase()
    .replace(/r\$/g,' rs ')
    .replace(/(\d),(\d)/g,'$1.$2')
    .replace(/por\s+cento/g,'%')
    .replace(/([.;:!?])/g,' | ')
    .replace(/,/g,' , ')
    .replace(/\+/g,' + ')
    .replace(/%/g,' % ')
    .replace(/[^a-z0-9.%+|,\s-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  const toks=s.split(' ').map(t=>ALIASES[t] ?? t);
  return toks.join(' ')
    .replace(/\s*\|\s*/g,' | ')
    .replace(/\s*,\s*/g,' , ')
    .replace(/\s+/g,' ')
    .trim();
}

function goalFromText(text){
  if(/ponto de equilibrio|quantidade de equilibrio|equilibrio|empatar|nao perde(?:r)? dinheiro|zerar(?: o resultado)?|pra zerar|quantas? (?:unidade|venda).*empatar|quantas? unidades? cobrem tudo|preciso vender quantas/.test(text))
    return {metric:'breakEvenUnits',confidence:1,source:'break-even intent'};
  if(/markup|marcacao|acima do custo/.test(text))
    return {metric:'markupPct',confidence:1,source:'markup intent'};
  if(/margem/.test(text))
    return {metric:'marginPct',confidence:1,source:'margin intent'};
  if(/quanto mudou|variacao|crescimento|queda percentual|reducao/.test(text))
    return {metric:'changePct',confidence:.99,source:'temporal comparison intent'};
  if(/lucro|quanto sobra|resultado liquido|resultado\b/.test(text))
    return {metric:'netProfit',confidence:.99,source:'profit intent'};
  if(/faturamento|receita|quanto entrou|quanto entro|entrou de venda/.test(text))
    return {metric:'revenue',confidence:.98,source:'revenue intent'};
  return null;
}

function addPurchase(world, quantity, unitCost, meta={}){
  const n=addNode(world,node(nextId(world,'PURCHASE'),'PURCHASE',{
    quantity: quantity === undefined ? Unknown('quantity missing') : Known(+quantity,meta),
    unitCost: unitCost === undefined ? Unknown('unit cost missing') : Known(+unitCost,meta)
  },{},meta));
  return n;
}

function addSale(world, quantity, unitPrice, meta={}){
  const qState = quantity && typeof quantity==='object' && quantity.state
    ? quantity
    : quantity === undefined ? Unknown('sale quantity missing') : Known(+quantity,meta);
  const pState = unitPrice && typeof unitPrice==='object' && unitPrice.state
    ? unitPrice
    : unitPrice === undefined ? Unknown('sale price missing') : Known(+unitPrice,meta);
  return addNode(world,node(nextId(world,'SALE'),'SALE',{
    quantity:qState,
    unitPrice:pState
  },{},meta));
}

function addFixed(world, amount, meta={}){
  return addNode(world,node(nextId(world,'FIXED_COST'),'FIXED_COST',{
    amount: Known(+amount,meta)
  },{},meta));
}

function addFee(world, ratePct, meta={}){
  return addNode(world,node(nextId(world,'FEE'),'FEE',{
    ratePct: ratePct && ratePct.state ? ratePct : Known(+ratePct,meta)
  },{
    scope: meta.scope ?? 'ALL_SALES',
    completedOnly: Boolean(meta.completedOnly)
  },meta));
}

function addDiscount(world, ratePct, saleId, meta={}){
  const d=addNode(world,node(nextId(world,'DISCOUNT'),'DISCOUNT',{
    ratePct: Known(+ratePct,meta)
  },{scope:saleId},meta));
  addRelation(world,{type:'APPLIES_TO',from:d.id,to:saleId,meta:{confidence:meta.confidence ?? 1}});
  return d;
}

function addReturn(world, quantity, saleId, meta={}){
  const r=addNode(world,node(nextId(world,'RETURN'),'RETURN',{
    quantity: quantity && quantity.state ? quantity : Known(+quantity,meta),
    ratePct: meta.ratePct === undefined ? undefined : Known(+meta.ratePct,meta),
    refunded: Known(meta.refunded ?? true,meta),
    restocked: Known(meta.restocked ?? true,meta)
  },{scope:saleId},meta));
  addRelation(world,{type:'APPLIES_TO',from:r.id,to:saleId,meta:{confidence:meta.confidence ?? 1}});
  return r;
}

function addChannel(world,name){
  const existing=world.nodes.find(n=>n.type==='CHANNEL'&&n.fields.name?.value===name);
  if(existing) return existing;
  return addNode(world,node(nextId(world,'CHANNEL'),'CHANNEL',{name:Known(name)},{},{source:'channel'}));
}

function inChannel(world,event,channel){
  event.links.channel=channel.id;
  addRelation(world,{type:'IN_CHANNEL',from:event.id,to:channel.id,meta:{confidence:1}});
}

function addPeriod(world,label){
  return addNode(world,node(nextId(world,'PERIOD'),'PERIOD',{label:Known(label)},{},{source:'temporal'}));
}
function inPeriod(world,event,period){
  event.links.period=period.id;
  addRelation(world,{type:'IN_PERIOD',from:event.id,to:period.id,meta:{confidence:1}});
}

function parseExplicitUnknowns(text,world){
  if(/(?:marketplace|taxa)[^|]{0,35}nao sei quanto|nao sei quanto[^|]{0,35}taxa/.test(text)){
    addFee(world,Unknown('explicit fee value unknown',{source:'explicit-unknown'}),{source:'explicit-unknown'});
    addIssue(world,{type:'UNKNOWN_REQUIRED',concept:'feePct',message:'A taxa existe, mas seu valor foi declarado como desconhecido.'});
  }
  let m=text.match(/custo[^|]{0,20}pode ser\s+(\d+(?:\.\d+)?)\s+ou\s+(\d+(?:\.\d+)?)/);
  if(m){
    const p=addPurchase(world,undefined,undefined,{source:'ambiguous cost'});
    p.fields.quantity=undefined;
    p.fields.unitCost=Ambiguous([Known(+m[1]),Known(+m[2])],{reason:'two supplier costs'});
    addIssue(world,{type:'AMBIGUOUS',concept:'unitCost',candidates:[+m[1],+m[2]]});
  }
  if(/desconto[^|]{0,35}nao lembro quanto|nao lembro quanto[^|]{0,35}desconto/.test(text)){
    addNode(world,node(nextId(world,'DISCOUNT'),'DISCOUNT',{ratePct:Unknown('discount value unknown')},{scope:'UNRESOLVED'},{source:'explicit-unknown'}));
    addIssue(world,{type:'UNKNOWN_REQUIRED',concept:'discount'});
  }
  if(/frete variavel/.test(text)){
    addNode(world,node(nextId(world,'COST_COMPONENT'),'COST_COMPONENT',{
      kind:Known('freight'), amount:Unknown('variable freight not provided')
    },{perUnit:true},{source:'explicit-unknown'}));
    addIssue(world,{type:'UNKNOWN_REQUIRED',concept:'freight'});
  }
  if(/tive devolucao[^|]{0,50}nao sei quantas|nao sei quantas[^|]{0,40}devolucao/.test(text)){
    addReturn(world,Unknown('return quantity unknown'),null,{source:'explicit-unknown'});
    addIssue(world,{type:'UNKNOWN_REQUIRED',concept:'returnQuantity'});
  }
}

function parseTemporalMulti(text,world){
  // Generic temporal grouping: identify two period spans, then extract any
  // number of quantity×price sale pairs inside each span.
  const prevMarker=/(?:\bantes\b|\bmes anterior\b|\bmes passado\b|\bperiodo velho\b)/.exec(text);
  const curMarker=/(?:\bagora\b|\bmes atual\b|\bhoje\b|\bperiodo atual\b|\bperiodo novo\b)/.exec(text);
  if(prevMarker&&curMarker&&curMarker.index>prevMarker.index){
    const prevZone=text.slice(prevMarker.index+prevMarker[0].length,curMarker.index);
    const curZone=text.slice(curMarker.index+curMarker[0].length);
    const extract=(zone)=>{
      const out=[];
      const re=/(\d+)\s*(?:unidade|produto|item|peca|vendas?)?\s*(?:x|por|a)\s*(\d+)/g;
      for(const m of zone.matchAll(re))out.push([+m[1],+m[2]]);
      return out;
    };
    const previous=extract(prevZone),current=extract(curZone);
    if(previous.length>=2&&current.length>=2){
      const prev=addPeriod(world,'previous'),cur=addPeriod(world,'current');
      previous.forEach(([q,p])=>inPeriod(world,addSale(world,q,p,{source:'generic temporal previous'}),prev));
      current.forEach(([q,p])=>inPeriod(world,addSale(world,q,p,{source:'generic temporal current'}),cur));
      return true;
    }
  }

  let m;

  m=text.match(/antes vendia\s+(\d+)\s+unidade\s+a\s+(\d+)\s+e\s+(\d+)\s+a\s+(\d+)[^|]*\|?[^|]*agora\s+vendi\s+(\d+)\s+a\s+(\d+)\s+e\s+(\d+)\s+a\s+(\d+)/);
  if(!m) m=text.match(/antes vendia\s+(\d+)\s+unidade\s+a\s+(\d+)\s+e\s+(\d+)\s+a\s+(\d+)[^|]*agora\s+vendi\s+(\d+)\s+a\s+(\d+)\s+e\s+(\d+)\s+a\s+(\d+)/);
  if(m){
    const prev=addPeriod(world,'previous'),cur=addPeriod(world,'current');
    inPeriod(world,addSale(world,+m[1],+m[2],{source:'temporal sale'}),prev);
    inPeriod(world,addSale(world,+m[3],+m[4],{source:'temporal sale'}),prev);
    inPeriod(world,addSale(world,+m[5],+m[6],{source:'temporal sale'}),cur);
    inPeriod(world,addSale(world,+m[7],+m[8],{source:'temporal sale'}),cur);
    return true;
  }

  m=text.match(/periodo velho\s+(\d+)\s*x\s*(\d+)\s*\+?\s*(\d+)\s*x\s*(\d+)[^|]*\|?[^|]*periodo atual\s+(\d+)\s*x\s*(\d+)\s*\+?\s*(\d+)\s*x\s*(\d+)/);
  if(m){
    const prev=addPeriod(world,'previous'),cur=addPeriod(world,'current');
    [[m[1],m[2]],[m[3],m[4]]].forEach(x=>inPeriod(world,addSale(world,+x[0],+x[1],{source:'temporal x pair'}),prev));
    [[m[5],m[6]],[m[7],m[8]]].forEach(x=>inPeriod(world,addSale(world,+x[0],+x[1],{source:'temporal x pair'}),cur));
    return true;
  }

  m=text.match(/mes passado foram\s+(\d+)\s+produto\s+por\s+(\d+)\s+e\s+(\d+)\s+por\s+(\d+)[^|]*\|?[^|]*hoje\s+(\d+)\s+por\s+(\d+)\s+e\s+(\d+)\s+por\s+(\d+)/);
  if(m){
    const prev=addPeriod(world,'previous'),cur=addPeriod(world,'current');
    [[m[1],m[2]],[m[3],m[4]]].forEach(x=>inPeriod(world,addSale(world,+x[0],+x[1],{source:'temporal period'}),prev));
    [[m[5],m[6]],[m[7],m[8]]].forEach(x=>inPeriod(world,addSale(world,+x[0],+x[1],{source:'temporal period'}),cur));
    return true;
  }
  return false;
}

function parseChannelGroups(text,world){
  const labelRe=/\b(canal\s+[abc]|site|marketplace|balcao|loja online|app|fisico)\b/g;
  const labels=[...text.matchAll(labelRe)];
  if(labels.length<2)return false;

  const specs=[];
  for(let i=0;i<labels.length;i++){
    const start=labels[i].index;
    const end=i+1<labels.length?labels[i+1].index:text.length;
    const chunk=text.slice(start,end);
    const name=labels[i][1];
    const pair=chunk.match(/(\d+)\s*(?:vendas?|unidade|produto|item|peca)?\s*(?:a|por|x)\s*(\d+)/);
    const fee=chunk.match(/(?:taxa|fica|cobra)\s*(\d+)\s*%/) || chunk.match(/(\d+)\s*%/);
    if(pair&&fee)specs.push({name,q:+pair[1],p:+pair[2],fee:+fee[1],source:chunk.trim()});
  }

  if(specs.length<2)return false;

  for(const spec of specs){
    const ch=addChannel(world,spec.name);
    const sale=addSale(world,spec.q,spec.p,{source:'channel-group sale'});
    inChannel(world,sale,ch);
    const fee=addFee(world,spec.fee,{scope:sale.id,source:'channel-group fee'});
    addRelation(world,{type:'APPLIES_TO',from:fee.id,to:sale.id,meta:{confidence:1}});
  }
  return true;
}

function parseChannels(text,world){
  let m=text.match(/canal a\s+vendeu\s+(\d+)\s+unidade\s+por\s+(\d+)\s*,?\s*taxa\s+(\d+)\s*%[^|]*canal b\s+(\d+)\s+unidade\s+por\s+(\d+)\s*,?\s*taxa\s+(\d+)\s*%[^|]*custo de cada produto\s+(\d+)[^|]*fixo\s+(\d+)/);
  if(m){
    const a=addChannel(world,'A'),b=addChannel(world,'B');
    const s1=addSale(world,+m[1],+m[2],{source:'channel A sale'}),s2=addSale(world,+m[4],+m[5],{source:'channel B sale'});
    inChannel(world,s1,a);inChannel(world,s2,b);
    const f1=addFee(world,+m[3],{scope:s1.id,source:'channel A fee'}),f2=addFee(world,+m[6],{scope:s2.id,source:'channel B fee'});
    addRelation(world,{type:'APPLIES_TO',from:f1.id,to:s1.id,meta:{confidence:1}});
    addRelation(world,{type:'APPLIES_TO',from:f2.id,to:s2.id,meta:{confidence:1}});
    addPurchase(world,+m[1]+ +m[4],+m[7],{source:'channel aggregate cost'});
    addFixed(world,+m[8],{source:'fixed'});
    return true;
  }

  m=text.match(/(?:loja\s+)?(\d+)\s+venda\s+a\s+(\d+)\s+no site[^0-9%]{0,25}(\d+)\s*%\s*\+?\s*(\d+)\s+a\s+(\d+)\s+no marketplace[^0-9%]{0,25}(\d+)\s*%[^0-9]{0,25}custo unit\s+(\d+)[^0-9]{0,25}(?:fixo|estrutura)\s+(\d+)/);
  if(m){
    const a=addChannel(world,'site'),b=addChannel(world,'marketplace');
    const s1=addSale(world,+m[1],+m[2],{source:'site sale'}),s2=addSale(world,+m[4],+m[5],{source:'market sale'});
    inChannel(world,s1,a);inChannel(world,s2,b);
    const f1=addFee(world,+m[3],{scope:s1.id,source:'site fee'}),f2=addFee(world,+m[6],{scope:s2.id,source:'market fee'});
    addRelation(world,{type:'APPLIES_TO',from:f1.id,to:s1.id,meta:{confidence:1}});
    addRelation(world,{type:'APPLIES_TO',from:f2.id,to:s2.id,meta:{confidence:1}});
    addPurchase(world,+m[1]+ +m[4],+m[7],{source:'channel aggregate cost'});
    addFixed(world,+m[8],{source:'fixed'});
    return true;
  }

  m=text.match(/site\s+(\d+)\s*x\s*(\d+)\s+com taxa\s+(\d+)\s*%[^|]*marketplace\s+(\d+)\s*x\s*(\d+)\s+com\s+(\d+)\s*%[^|]*produto custa\s+(\d+)\s+cada[^|]*fixo\s+(\d+)/);
  if(m){
    const a=addChannel(world,'site'),b=addChannel(world,'marketplace');
    const s1=addSale(world,+m[1],+m[2],{source:'site x sale'}),s2=addSale(world,+m[4],+m[5],{source:'market x sale'});
    inChannel(world,s1,a);inChannel(world,s2,b);
    const f1=addFee(world,+m[3],{scope:s1.id,source:'site fee'}),f2=addFee(world,+m[6],{scope:s2.id,source:'market fee'});
    addRelation(world,{type:'APPLIES_TO',from:f1.id,to:s1.id,meta:{confidence:1}});
    addRelation(world,{type:'APPLIES_TO',from:f2.id,to:s2.id,meta:{confidence:1}});
    addPurchase(world,+m[1]+ +m[4],+m[7],{source:'channel aggregate cost'});
    addFixed(world,+m[8],{source:'fixed'});
    return true;
  }
  return false;
}

function parseScopedDiscounts(text,world){
  if(world.nodes.some(n=>n.type==='DISCOUNT'))return false;
  const sales=world.nodes.filter(n=>n.type==='SALE');

  // "... vendi 66 pelo preço 59; as outras 15 tiveram 5% de desconto sobre 59"
  let m=text.match(/(?:vendi|vendeu)\s+(\d+)\s+(?:item|produto|peca|unidade)?\s*(?:pelo preco|ao preco|por|a)\s+(\d+).*?(?:as outras|os outros|restantes|demais)\s+(\d+)\s+(?:tiveram|teve|com)\s+(\d+)\s*%\s+(?:de desconto|off)(?:\s+sobre\s+(\d+))?/);
  if(m){
    if(!sales.length)addSale(world,+m[1],+m[2],{source:'scoped discount full-price sale'});
    const current=world.nodes.filter(n=>n.type==='SALE');
    // The second mention is a distinct SALE event even when quantity/price
    // happen to equal the first event. Event identity must never collapse
    // merely because scalar values are equal.
    const firstEvent=current[0] || null;
    let target=current.slice(1).find(s=>s.fields?.quantity?.value===+m[3]);
    if(!target){
      target=addSale(world,+m[3],+(m[5]||m[2]),{
        source:'scoped discount inherited-price sale',
        distinctFrom:firstEvent?.id ?? null
      });
    }
    addDiscount(world,+m[4],target.id,{source:'scoped discount'});
    return true;
  }

  // "50 saíram a 95; 116 restantes com desconto de 30%"
  m=text.match(/(\d+)\s+sairam\s+(?:a|por)\s+(\d+).*?(\d+)\s+restantes\s+com desconto de\s+(\d+)\s*%/);
  if(m){
    if(!sales.length)addSale(world,+m[1],+m[2],{source:'scoped discount first sale'});
    const current=world.nodes.filter(n=>n.type==='SALE');
    let target=current.slice(1).find(s=>s.fields?.quantity?.value===+m[3]);
    if(!target)target=addSale(world,+m[3],+m[2],{
      source:'scoped discount remainder',
      distinctFrom:current[0]?.id ?? null
    });
    addDiscount(world,+m[4],target.id,{source:'scoped discount'});
    return true;
  }

  // "preço cheio 101; 90 vendas sem desconto e 18 com 5% off"
  m=text.match(/preco (?:cheio|tabela)\s+(\d+).*?(\d+)\s+vendas?\s+sem desconto\s+e\s+(\d+)\s+com\s+(\d+)\s*%\s*(?:off|de desconto)?/);
  if(m){
    if(!sales.length){
      addSale(world,+m[2],+m[1],{source:'table-price full sale'});
      const target=addSale(world,+m[3],+m[1],{source:'table-price discounted sale'});
      addDiscount(world,+m[4],target.id,{source:'scoped discount'});
    }else{
      const current=world.nodes.filter(n=>n.type==='SALE');
      let target=current.slice(1).find(s=>s.fields?.quantity?.value===+m[3]);
      if(!target)target=addSale(world,+m[3],+m[1],{
        source:'table-price discounted sale',
        distinctFrom:current[0]?.id ?? null
      });
      addDiscount(world,+m[4],target.id,{source:'scoped discount'});
    }
    return true;
  }

  return false;
}

function parseScopedReturns(text,world){
  if(world.nodes.some(n=>n.type==='RETURN'))return false;
  const sales=world.nodes.filter(n=>n.type==='SALE');
  if(!sales.length)return false;

  let m=text.match(/(?:do segundo lote|destas ultimas|dessas ultimas|das ultimas)[^0-9]{0,25}(\d+)\s+(?:voltaram|foram devolvida|foram cancelada|cancelaram)/);
  if(!m)m=text.match(/segundo.*?(\d+)\s+foram\s+(?:devolvida|cancelada)/);
  if(!m)return false;

  const target=sales[1] || sales[sales.length-1];
  addReturn(world,+m[1],target.id,{
    refunded:true,
    restocked:/retornaram ao estoque|voltaram ao estoque|restocad/.test(text),
    source:'scoped return to second sale'
  });
  return true;
}

function parseDiscountScenario(text,world){
  let m=text.match(/vendi\s+(\d+)\s+peca\s+(?:pelo preco cheio|por)\s+(\d+)[^|]*nas outras\s+(\d+)\s+dei\s+(\d+)\s*%\s+de desconto/);
  if(m){
    addSale(world,+m[1],+m[2],{source:'full price sale'});
    const s2=addSale(world,+m[3],+m[2],{source:'discounted sale base'});
    addDiscount(world,+m[4],s2.id,{source:'partial discount'});
    return true;
  }
  m=text.match(/(\d+)\s+unidade\s+sairam\s+a\s+(\d+)[^|]*mais\s+(\d+)\s+com desconto de\s+(\d+)\s*%/);
  if(m){
    addSale(world,+m[1],+m[2],{source:'full price sale'});
    const s2=addSale(world,+m[3],+m[2],{source:'discount inherited price'});
    addDiscount(world,+m[4],s2.id,{source:'partial discount'});
    return true;
  }
  m=text.match(/preco tabela\s+(\d+)[^|]*foram\s+(\d+)\s+sem desconto\s+e\s+(\d+)\s+com\s+(\d+)\s*%\s+off/);
  if(m){
    addSale(world,+m[2],+m[1],{source:'table price sale'});
    const s2=addSale(world,+m[3],+m[1],{source:'table price discounted'});
    addDiscount(world,+m[4],s2.id,{source:'partial discount'});
    return true;
  }
  m=text.match(/vendas quebrada[^|]*?(\d+)\s*x\s*(\d+)[^|]*outras\s+(\d+)\s+tiveram\s+(\d+)\s*%\s+desconto/);
  if(m){
    addSale(world,+m[1],+m[2],{source:'split sale'});
    const s2=addSale(world,+m[3],+m[2],{source:'split discount inherited'});
    addDiscount(world,+m[4],s2.id,{source:'partial discount'});
    return true;
  }
  return false;
}

function parseReturnScenario(text,world){
  let m=text.match(/vendi\s+(\d+)\s+unidade\s+por\s+(\d+).*?custo\s+(\d+)\s+cada.*?(\d+)\s+foram devolvida.*?taxa\s+(\d+)\s*%.*?fixo\s+(\d+)/);
  if(m){
    const s=addSale(world,+m[1],+m[2],{source:'sale with returns'});
    addPurchase(world,+m[1],+m[3],{source:'cost with returns'});
    addReturn(world,+m[4],s.id,{refunded:true,restocked:true,source:'returned units'});
    const fee=addFee(world,+m[5],{scope:s.id,completedOnly:true,source:'completed sales fee'});
    addRelation(world,{type:'APPLIES_TO',from:fee.id,to:s.id,meta:{confidence:1}});
    addFixed(world,+m[6],{source:'fixed'});
    return true;
  }
  m=text.match(/foram\s+(\d+)\s+vendas\s+a\s+(\d+).*?(\d+)\s+cancelaram.*?custo unit\s+(\d+).*?taxa cobra\s+(\d+)\s*%|foram\s+(\d+)\s+vendas\s+a\s+(\d+).*?(\d+)\s+cancelaram.*?custo unit\s+(\d+).*?marketplace cobra\s+(\d+)\s*%/);
  if(m){
    const vals=m.slice(1).filter(x=>x!==undefined).map(Number);
    const [q,p,ret,c,feePct]=vals;
    const fxm=text.match(/fixo\s+(\d+)/);
    const s=addSale(world,q,p,{source:'cancelled sales scenario'});
    addPurchase(world,q,c,{source:'cost with returns'});
    addReturn(world,ret,s.id,{refunded:true,restocked:true,source:'cancelled units'});
    const fee=addFee(world,feePct,{scope:s.id,completedOnly:true,source:'completed sales fee'});
    addRelation(world,{type:'APPLIES_TO',from:fee.id,to:s.id,meta:{confidence:1}});
    if(fxm)addFixed(world,+fxm[1],{source:'fixed'});
    return true;
  }
  m=text.match(/(\d+)\s+pedidos\s*x\s*(\d+).*?mas\s+(\d+)\s+devolvida.*?custo\s+(\d+).*?taxa\s+(\d+)\s*%.*?fixo\s+(\d+)/);
  if(m){
    const s=addSale(world,+m[1],+m[2],{source:'orders sale'});
    addPurchase(world,+m[1],+m[4],{source:'orders cost'});
    addReturn(world,+m[3],s.id,{refunded:true,restocked:true,source:'returned orders'});
    const fee=addFee(world,+m[5],{scope:s.id,completedOnly:true,source:'completed orders fee'});
    addRelation(world,{type:'APPLIES_TO',from:fee.id,to:s.id,meta:{confidence:1}});
    addFixed(world,+m[6],{source:'fixed'});
    return true;
  }
  return false;
}

function parseDerivedMarkup(text,world){
  // Generic unit-cost composition. The labels identify independent components;
  // the planner remains responsible for summing them into landed unit cost.
  const first=(patterns)=>{
    for(const re of patterns){
      const m=text.match(re);
      if(m)return +m[1];
    }
    return undefined;
  };

  const base=first([
    /produto custa\s+(\d+)/,
    /custo base\s+(\d+)/,
    /por item pago\s+(\d+)\s+no produto/,
    /pago\s+(\d+)\s+n[ao] produto/,
    /compra\s+(\d+)/
  ]);
  const freight=first([
    /frete unitario\s+(\d+)/,
    /(\d+)\s+de frete por unidade/,
    /(\d+)\s+de frete unitario/,
    /(\d+)\s+no transporte/,
    /frete de\s+(\d+)\s+por unidade/,
    /mais frete\s+(\d+)/
  ]);
  const packaging=first([
    /embalagem por (?:peca|item|unidade)\s+(\d+)/,
    /(\d+)\s+de embalagem/,
    /(\d+)\s+na embalagem/
  ]);
  const price=first([
    /preco de venda\s+(\d+)/,
    /preco final\s+(\d+)/,
    /vendo\s+(?:por|a)\s+(\d+)/,
    /vendi\s+(?:por|a)?\s*(\d+)/,
    /cobro\s+(\d+)/
  ]);

  if(Number.isFinite(base)&&Number.isFinite(price)&&(Number.isFinite(freight)||Number.isFinite(packaging))){
    addPurchase(world,1,base,{source:'composed base unit cost'});
    if(Number.isFinite(freight)){
      addNode(world,node(nextId(world,'COST_COMPONENT'),'COST_COMPONENT',{
        kind:Known('freight'),amount:Known(freight)
      },{perUnit:true},{source:'freight component'}));
    }
    if(Number.isFinite(packaging)){
      addNode(world,node(nextId(world,'COST_COMPONENT'),'COST_COMPONENT',{
        kind:Known('packaging'),amount:Known(packaging)
      },{perUnit:true},{source:'packaging component'}));
    }
    addSale(world,1,price,{source:'markup sale'});
    return true;
  }

  // Legacy two-component wording retained as fallback.
  let m=text.match(/produto custa\s+(\d+).*?frete de\s+(\d+)\s+por unidade.*?vendi\s+a\s+(\d+)|produto custa\s+(\d+).*?frete de\s+(\d+)\s+por unidade.*?vendo\s+a\s+(\d+)/);
  if(!m)m=text.match(/pago\s+(\d+)\s+no produto\s*\+?\s*(\d+)\s+de frete unitario.*?preco final\s+(\d+)/);
  if(!m)m=text.match(/custo real por peca.*?compra\s+(\d+)\s+mais frete\s+(\d+).*?vendi\s+(\d+)|custo real por peca.*?compra\s+(\d+)\s+mais frete\s+(\d+).*?cobro\s+(\d+)/);
  if(m){
    const vals=m.slice(1).filter(x=>x!==undefined).map(Number);
    const [legacyBase,legacyFreight,legacyPrice]=vals;
    addPurchase(world,1,legacyBase,{source:'base unit cost'});
    addNode(world,node(nextId(world,'COST_COMPONENT'),'COST_COMPONENT',{
      kind:Known('freight'),amount:Known(legacyFreight)
    },{perUnit:true},{source:'freight component'}));
    addSale(world,1,legacyPrice,{source:'markup sale'});
    return true;
  }
  return false;
}

function parseGenericPurchase(text,world){
  if(world.nodes.some(n=>n.type==='PURCHASE'))return true;
  let m;
  const patterns=[
    [/comprei\s+(\d+)\s*(?:peca|produto|item|unidade)?\s*(?:por|a)?\s*(\d+)\s*(?:cada)?/,'generic purchase'],
    [/lote(?:\s+de)?\s+(\d+)[^|]{0,35}(?:custo|custando)(?:\s+(?:unit|unitario|unidade))?\s+(\d+)/,'lot cost'],
    [/(\d+)\s+(?:item|produto|peca|unidade)[^|]{0,25}custando\s+(\d+)\s+cada/,'items costing'],
    [/(\d+)\s+(?:item|produto|peca|unidade)[^|]{0,20}(?:me\s+)?custaram\s+(\d+)\s+por unidade/,'items cost per unit'],
    [/(\d+)\s+(?:item|produto|peca|unidade)\s+custo\s+(\d+)/,'items cost'],
    [/negocio com\s+(\d+)\s+unidade[^|]{0,25}custo\s+(\d+)/,'business units cost'],
    [/tenho\s+(\d+)\s+produto[^|]{0,20}custou\s+(\d+)/,'inventory cost'],
    [/estoque\s+(\d+)[^|]{0,25}custo\s+(\d+)\s+cada/,'stock cost']
  ];
  for(const [re,source] of patterns){
    m=text.match(re);
    if(m){addPurchase(world,+m[1],+m[2],{source});return true;}
  }

  const unitPatterns=[
    [/custo de cada produto\s+(\d+)/,'unit cost only'],
    [/custo (?:unit|unitario|unidade|por unidade)\s+(\d+)/,'unit cost only'],
    [/custo por (?:item|produto|peca|unidade)\s+(\d+)/,'cost per item'],
    [/(?:cada item|cada produto|cada peca) custa\s+(\d+)/,'each item cost'],
    [/\bcusto\s+(\d+)\b/,'plain unit cost'],
    [/produto custa\s+(\d+)\s+cada/,'product cost'],
    [/produto custa\s+(\d+)/,'product cost plain'],
    [/mercadoria custa\s+(\d+)/,'product cost'],
    [/custo base\s+(\d+)/,'base cost'],
    [/por item pago\s+(\d+)\s+no produto/,'base cost']
  ];
  for(const [re,source] of unitPatterns){
    m=text.match(re);
    if(m){addPurchase(world,undefined,+m[1],{source});return true;}
  }
  m=text.match(/(?:tenho|estoque(?: de)?)\s+(\d+)\s+(?:item|produto|peca|unidade)/);
  if(m){ addPurchase(world,+m[1],undefined,{source:'quantity-only inventory'}); return true; }
  return false;
}

function parseGenericSales(text,world){
  if(world.nodes.some(n=>n.type==='SALE'))return true;

  const found=[];
  const add=(m,source)=>{
    const q=+m[1],p=+m[2],index=m.index??0,end=index+String(m[0]??'').length;
    const key=`${index}:${end}:${q}:${p}`;
    if(Number.isFinite(q)&&Number.isFinite(p)&&!found.some(x=>x.key===key))
      found.push({key,index,end,q,p,source});
  };

  // Once a sale-context marker appears, all explicit q×price / q por price / q a price
  // pairs after it are candidate SALE events. This supports arbitrary batch counts.
  const marker=/\b(?:vendi|venda|vendas|sairam|saidas|repassei|repassai|receita veio de|venda fracionada|primeiro lote|estoque vendido|lotes?|site|canal a)\b/.exec(text);
  if(marker){
    const zone=text.slice(marker.index);
    const pair=/\b(\d+)\s*(?:unidade|produto|item|peca|vendas?)?\s*(?:x|por|a)\s*(\d+)\b/g;
    for(const m of zone.matchAll(pair)){
      m.index=(m.index??0)+marker.index;
      add(m,'sale-context pair');
    }
  }

  // Local constructions where the quantity occurs before the sale verb.
  const localPatterns=[
    {re:/vendi\s+(\d+)\s+(?:item|produto|peca|unidade)?\s*(?:pelo preco|ao preco)\s+(\d+)/g,source:'full-price wording'},
    {re:/(\d+)\s+(?:eu\s+)?(?:repassei|repassai)\s+(?:por|a)\s+(\d+)/g,source:'resale pair'},
    {re:/sairam\s+(\d+)\s+cobrando\s+(\d+)/g,source:'outgoing charged'},
    {re:/(\d+)\s+sairam\s+(?:a|por)\s+(\d+)/g,source:'quantity outgoing pair'},
    {re:/(\d+)\s+vendas?\s+(?:a|por)\s+(\d+)/g,source:'quantity-before-sale noun'},
    {re:/(\d+)\s+vendi\s+(?:a|por)\s+(\d+)/g,source:'quantity-before-vendi'},
    {re:/(\d+)\s+foram vendidos?\s+(?:a|por)\s+(\d+)/g,source:'passive sold pair'},
    {re:/o resto\s*,?\s*(\d+)[^|]{0,25}saiu\s+(?:por|a)\s+(\d+)/g,source:'rest sale'},
    {re:/as outras\s+(\d+)\s+(?:(?:vendi|saiu|foram)\s+)?(?:por|a)\s+(\d+)/g,source:'other sale'},
    {re:/(?:depois|mais)\s+(\d+)\s+(?:por|a)\s+(\d+)/g,source:'continued described sale'},
    {re:/(?:as\s+)?(\d+)\s+(?:finais|restantes|demais)\s+(?:por|a)\s+(\d+)/g,source:'described trailing sale'},
    {re:/(?:o\s+)?restante\s+(\d+)\s+(?:por|a)\s+(\d+)/g,source:'explicit remainder sale'}
  ];
  for(const {re,source} of localPatterns)for(const m of text.matchAll(re))add(m,source);

  found.sort((a,b)=>a.index-b.index);
  const emitted=[];
  for(const x of found){
    // Deduplicate only when two extractors matched the same textual span.
    // Equal quantity/price values at different spans are distinct business events.
    const duplicate=emitted.some(y=>
      y.q===x.q &&
      y.p===x.p &&
      x.index < y.end &&
      y.index < x.end
    );
    if(duplicate)continue;
    emitted.push(x);
    addSale(world,x.q,x.p,{
      source:x.source,
      evidenceIndex:x.index,
      evidenceEnd:x.end
    });
  }
  return emitted.length>0;
}

function parseDerivedRemainder(text,world){
  const purchases=world.nodes.filter(n=>n.type==='PURCHASE');
  const sales=world.nodes.filter(n=>n.type==='SALE');
  if(!purchases.length||!sales.length)return false;

  let m=text.match(/(?:o\s+)?restante\s+saiu\s+(?:a|por)\s+(\d+)/);
  if(!m)m=text.match(/todo o resto\s+(?:a|por)\s+(\d+)/);
  if(!m)m=text.match(/as demais(?: unidades?)?\s+(?:a|por)\s+(\d+)/);
  if(!m)return false;

  const purchase=purchases.find(p=>Number.isFinite(p.fields?.quantity?.value));
  if(!purchase)return false;
  const total=+purchase.fields.quantity.value;
  const explicit=sales
    .map(s=>s.fields?.quantity?.value)
    .filter(Number.isFinite)
    .reduce((a,b)=>a+b,0);
  const remainder=total-explicit;
  if(!(remainder>0)){
    addIssue(world,{type:'CONSTRAINT_FAILURE',concept:'remainder',total,explicit});
    return false;
  }

  const price=+m[1];
  const q=Derived('purchase.quantity - Σ previous sale.quantity',
    [purchase.id,...sales.map(s=>s.id)],
    {value:remainder,confidence:1,source:'reference resolver'});
  addSale(world,q,price,{source:'derived remainder sale'});
  return true;
}

function parseGlobalFee(text,world){
  if(world.nodes.some(n=>n.type==='FEE'))return;
  const patterns=[
    /(?:taxa|marketplace cobra|paguei|comissao geral|comissao|taxa geral)\s+(\d+)\s*%/,
    /plataforma\s+(?:retem|leva|cobra)\s+(\d+)\s*%/,
    /taxa sobre toda receita\s+(\d+)\s*%/,
    /(\d+)\s*%\s+(?:em tudo|sobre faturamento|de taxa|taxa|de comissao|do faturamento)/
  ];
  for(const re of patterns){
    const m=text.match(re);
    if(m){addFee(world,+m[1],{scope:'ALL_SALES',source:'global fee'});return;}
  }
}

function parseFixed(text,world){
  if(world.nodes.some(n=>n.type==='FIXED_COST'))return;
  let m=text.match(/(?:fixo|custo fixo)\s+(?:rs\s*)?(\d+)/);
  if(!m)m=text.match(/(?:estrutura|aluguel)\s+(?:rs\s*)?(\d+)/);
  if(!m)m=text.match(/(?:tenho\s+)?(\d+)\s+fixo\b/);
  if(!m)m=text.match(/(\d+)\s+de\s+(?:estrutura|fixo)/);
  if(m)addFixed(world,+m[1],{source:'global fixed'});
}

function parseBreakEven(text,world){
  if(goalFromText(text)?.metric!=='breakEvenUnits')return false;

  const first=(patterns)=>{
    for(const re of patterns){
      const m=text.match(re);
      if(m)return +m[1];
    }
    return undefined;
  };

  const fixed=first([
    /(?:custo\s+)?fixo(?:\s+e)?\s+(\d+)/,
    /fixos?\s+somam\s+(\d+)/,
    /despesa fixa\s+(\d+)/,
    /estrutura\s+(\d+)/
  ]);
  const cost=first([
    /produto custa\s+(\d+)/,
    /peca me sai\s+(\d+)/,
    /custo (?:unit|unitario|unidade|por unidade)\s+(\d+)/,
    /\bcusto\s+(\d+)\b/
  ]);
  const price=first([
    /vendi cada unidade\s+(?:a|por)\s+(\d+)/,
    /(?:vendi|vendo)(?:\s+por)?\s+(\d+)/,
    /preco\s+(\d+)/
  ]);
  const fee=first([
    /taxa da plataforma\s+(\d+)\s*%/,
    /(?:taxa|plataforma leva|marketplace|market)\s+(\d+)\s*%/
  ]);
  const returns=first([
    /retorno(?: medio)?\s+(\d+)\s*%/,
    /devolucao(?: media)?\s+(\d+)\s*%/,
    /perdas? por devolucao\s+(\d+)\s*%/
  ]);

  if(!Number.isFinite(fixed)||!Number.isFinite(cost)||!Number.isFinite(price))return false;

  addFixed(world,fixed,{source:'break-even fixed'});
  addPurchase(world,1,cost,{source:'break-even unit cost'});
  addSale(world,1,price,{source:'break-even unit sale'});
  if(Number.isFinite(fee))addFee(world,fee,{scope:'ALL_SALES',source:'break-even fee'});
  if(Number.isFinite(returns)){
    addNode(world,node(nextId(world,'RETURN'),'RETURN',{
      ratePct:Known(returns)
    },{scope:'ALL_SALES'},{source:'break-even returns'}));
  }
  return true;
}

export function parseWorld(input){
  const text=normalizeWorldText(input);
  const flat=text.replace(/\s*\|\s*/g,' ');
  const world=createWorld({raw:String(input),normalized:text});
  const goal=goalFromText(text);
  if(goal)addGoal(world,goal);

  parseExplicitUnknowns(text,world);

  const temporal=parseTemporalMulti(flat,world);
  if(!temporal){
    const channel=parseChannelGroups(text,world) || parseChannels(flat,world);
    const discount=!channel&&parseDiscountScenario(flat,world);
    const returns=!channel&&!discount&&parseReturnScenario(flat,world);
    const markup=!channel&&!discount&&!returns&&parseDerivedMarkup(flat,world);
    const be=!channel&&!discount&&!returns&&!markup&&parseBreakEven(flat,world);

    // Compositional fallback passes: specialized parsers may create only part of
    // the world. Missing event families are then filled independently.
    if(!world.nodes.some(n=>n.type==='PURCHASE'))parseGenericPurchase(text,world);
    if(!world.nodes.some(n=>n.type==='SALE'))parseGenericSales(text,world);
    parseDerivedRemainder(flat,world);
    parseScopedDiscounts(flat,world);
    parseScopedReturns(flat,world);
    parseGlobalFee(flat,world);
    parseFixed(flat,world);
  }

  return {world,normalized:text,goal};
}

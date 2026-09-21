// V3 Hard 6 — FINAL CLEAN HOLDOUT, FROZEN BEFORE FIRST EXECUTION.
// Created after Hard5 reached 1000/1000. No parser/planner change may occur
// between this file's freeze commit and its first execution commit.

function rng(seed=2609203107){
  let x=BigInt(seed)&0xffffffffn;
  return (a,b)=>{
    x=(214013n*x+2531011n)&0xffffffffn;
    return a+Number((x>>16n)%BigInt(b-a+1));
  };
}
const pct=(v,r)=>v*r/100;

export function generateBusinessHard6_1200(){
  const R=rng(),cases=[]; let seq=0;
  const add=(cat,prompt,expected,note='')=>cases.push({
    id:`v3-hard6-${String(++seq).padStart(4,'0')}`,
    prompt,
    tags:['business-hard-6',cat,'final-clean-holdout'],
    note,
    expected
  });

  const pairs=(n,cost,collision=false)=>{
    const a=[];
    for(let i=0;i<n;i++){
      if(collision&&i>0&&i%4===0){
        a.push([...a[i-1]]);
      }else{
        a.push([R(4,70),cost+R(5,65)]);
      }
    }
    return a;
  };
  const render=(a,mode)=>{
    if(mode===0)return a.map(([q,p])=>`${q} x ${p}`).join(' / ');
    if(mode===1)return a.map(([q,p])=>`${q} por ${p}`).join(' + ');
    if(mode===2)return a.map(([q,p])=>`${q} unidades a ${p}`).join('; ');
    return a.map(([q,p])=>`${q} venda a ${p}`).join(', ');
  };
  const sumRev=a=>a.reduce((s,[q,p])=>s+q*p,0);
  const sumQ=a=>a.reduce((s,[q])=>s+q,0);

  // 1) Revenue collections — 120
  const heads=['vendas','lotes','saidas comerciais','estoque vendido em lotes'];
  for(let i=0;i<120;i++){
    const a=pairs(R(2,8),R(3,25),true),rev=sumRev(a);
    add('revenue',
      `${heads[i%4]}: ${render(a,i%4)}. ${i%2?'receita total':'quanto faturei'}?`,
      {status:'resolved',target:'revenue',value:rev,tolerance:.01},
      `${a.length} sale events`);
  }

  // 2) Profit collections — 120
  for(let i=0;i<120;i++){
    const cost=R(4,45),a=pairs(R(2,8),cost,true),units=sumQ(a),rev=sumRev(a),fee=R(0,12),fixed=R(0,1000);
    const base=[
      `comprei ${units} unidades por ${cost} cada`,
      `vendas: ${render(a,(i+1)%4)}`,
      `taxa ${fee}% sobre faturamento`,
      `fixo ${fixed}`
    ];
    if(i%4===1)[base[2],base[3]]=[base[3],base[2]];
    add('profit',`${base.join('. ')}. lucro liquido?`,
      {status:'resolved',target:'netProfit',value:rev-units*cost-pct(rev,fee)-fixed,tolerance:.01});
  }

  // 3) Margin collections — 100
  for(let i=0;i<100;i++){
    const cost=R(4,42),a=pairs(R(2,7),cost,true),units=sumQ(a),rev=sumRev(a),fee=R(0,11),fixed=R(0,850);
    const profit=rev-units*cost-pct(rev,fee)-fixed;
    add('margin',
      `${units} itens custo ${cost}. vendas foram ${render(a,i%4)}. comissao ${fee}% em tudo; estrutura ${fixed}. margem liquida?`,
      {status:'resolved',target:'marginPct',value:profit/rev*100,tolerance:.01});
  }

  // 4) Channel-scoped fees — 100
  const channelSets=[
    ['canal A','canal B','canal C'],
    ['site','marketplace','balcao'],
    ['loja online','app','fisico']
  ];
  const orders=[[0,1,2],[2,0,1],[1,2,0],[2,1,0]];
  for(let i=0;i<100;i++){
    const names=channelSets[i%3],cost=R(5,45),fixed=R(0,850),same=R(12,70);
    const s=names.map((name,j)=>({
      name,q:i%6===0?same:R(8,90),p:cost+R(8,60),
      fee:j===0?R(1,7):j===1?R(5,16):R(0,6)
    }));
    const body=orders[i%4].map(j=>i%2===0
      ? `${s[j].name}: ${s[j].q} x ${s[j].p}, taxa ${s[j].fee}%`
      : `${s[j].name} vendeu ${s[j].q} por ${s[j].p} e cobra ${s[j].fee}%`
    ).join(i%2===0?'; ':'. ');
    const rev=s.reduce((x,v)=>x+v.q*v.p,0),fees=s.reduce((x,v)=>x+pct(v.q*v.p,v.fee),0),units=s.reduce((x,v)=>x+v.q,0);
    add('channels',`${body}. custo por item ${cost}; fixo ${fixed}. resultado liquido?`,
      {status:'resolved',target:'netProfit',value:rev-units*cost-fees-fixed,tolerance:.01});
  }

  // 5) Temporal N-event revenue comparison — 100
  const marks=[['antes','agora'],['mes anterior','mes atual'],['periodo velho','periodo novo']];
  for(let i=0;i<100;i++){
    const n=R(2,8),prev=pairs(n,R(2,12),true),cur=pairs(n,R(2,12),true);
    const pv=sumRev(prev),cv=sumRev(cur),target=cv>=pv?'growthPct':'reductionPct';
    const [m1,m2]=marks[i%3];
    add('temporal',
      `${m1}: ${render(prev,i%4)}. ${m2}: ${render(cur,(i+2)%4)}. variacao percentual do faturamento?`,
      {status:'resolved',target,value:Math.abs(cv-pv)/pv*100,tolerance:.01});
  }

  // 6) Scoped discount — 100
  for(let i=0;i<100;i++){
    const q1=R(8,85),q2=i%3===0?q1:R(8,85),cost=R(5,40),price=cost+R(15,70);
    const disc=[5,10,15,20,25,30][R(0,5)],fee=R(0,10),fixed=R(0,600),units=q1+q2;
    const rev=q1*price+q2*price*(1-disc/100);
    const forms=[
      `comprei ${units} pecas por ${cost}. vendi ${q1} pelo preco ${price}; as outras ${q2} tiveram ${disc}% de desconto sobre ${price}. taxa ${fee}% do faturamento; fixo ${fixed}. lucro?`,
      `${units} itens custo ${cost}. ${q1} sairam a ${price}; ${q2} restantes com desconto de ${disc}%. estrutura ${fixed}; taxa geral ${fee}%. quanto sobra?`,
      `preco tabela ${price}; ${q1} vendas sem desconto e ${q2} com ${disc}% off. custo unitario ${cost}; comissao ${fee}% em tudo; fixo ${fixed}. lucro liquido?`
    ];
    add('discount',forms[i%3],
      {status:'resolved',target:'netProfit',value:rev-units*cost-pct(rev,fee)-fixed,tolerance:.01});
  }

  // 7) Scoped returns — 100
  for(let i=0;i<100;i++){
    const q1=R(12,90),q2=i%4===0?q1:R(20,110),ret=R(1,Math.max(1,Math.floor(q2/5)));
    const cost=R(4,38),p1=cost+R(10,60),p2=cost+R(10,60),fee=R(0,11),fixed=R(0,550);
    const kept=q2-ret,rev=q1*p1+kept*p2,units=q1+kept;
    const forms=[
      `vendi ${q1} itens por ${p1} e ${q2} por ${p2}. do segundo lote, ${ret} foram devolvidos e voltaram ao estoque. custo unitario ${cost}; taxa ${fee}% so no que ficou vendido; fixo ${fixed}. lucro?`,
      `primeiro lote ${q1}x${p1}; segundo ${q2}x${p2}, mas ${ret} foram cancelados e restocados. cada item custa ${cost}; comissao ${fee}% no liquido vendido; estrutura ${fixed}. resultado liquido?`,
      `${q1} vendas a ${p1} + ${q2} vendas a ${p2}; destas ultimas ${ret} foram canceladas e produto voltou ao estoque. custo ${cost}; taxa ${fee}% apenas concluidas; fixo ${fixed}. lucro liquido?`
    ];
    add('returns',forms[i%3],
      {status:'resolved',target:'netProfit',value:rev-units*cost-pct(rev,fee)-fixed,tolerance:.01});
  }

  // 8) Derived remainder with 1..4 explicit sales — 100
  for(let i=0;i<100;i++){
    const total=R(70,240),cost=R(4,34),n=R(1,4);
    let remaining=total,a=[];
    for(let k=0;k<n;k++){
      const max=Math.max(4,remaining-(n-k)*4);
      const q=R(4,max);
      a.push([q,cost+R(7,48)]); remaining-=q;
    }
    if(remaining<=0){remaining=1;a[a.length-1][0]-=1;}
    const rp=cost+R(5,42),rev=sumRev(a)+remaining*rp;
    const explicit=a.map(([q,p],j)=>j===0?`vendi ${q} a ${p}`:`mais ${q} a ${p}`).join('; ');
    if(i%2===0){
      add('remainder',`comprei ${total} pecas por ${cost}. ${explicit}; o restante saiu a ${rp}. faturamento?`,
        {status:'resolved',target:'revenue',value:rev,tolerance:.01});
    }else{
      const fee=R(0,10),fixed=R(0,500);
      add('remainder',`comprei ${total} pecas por ${cost}. ${explicit}; o restante saiu a ${rp}. fixo ${fixed}; taxa ${fee}% sobre faturamento. lucro?`,
        {status:'resolved',target:'netProfit',value:rev-total*cost-pct(rev,fee)-fixed,tolerance:.01});
    }
  }

  // 9) Multi-component markup — 80
  for(let i=0;i<80;i++){
    const base=R(8,70),fr=R(1,15),pack=R(1,8),landed=base+fr+pack,price=landed+R(8,90);
    const forms=[
      `produto custa ${base}; frete unitario ${fr}; embalagem por peca ${pack}; preco de venda ${price}. markup sobre custo completo?`,
      `custo base ${base} + ${fr} de frete por unidade + ${pack} de embalagem. vendo por ${price}. marcacao percentual?`,
      `cobro ${price}; por item pago ${base} no produto, ${fr} no transporte e ${pack} na embalagem. markup real?`
    ];
    add('markup',forms[i%3],
      {status:'resolved',target:'markupPct',value:(price/landed-1)*100,tolerance:.01});
  }

  // 10) Break-even with rotated clauses — 80
  for(let i=0;i<80;i++){
    const cost=R(5,48),fee=R(0,10),ret=R(0,5),fixed=R(400,7000);
    let price=cost+R(15,80);
    while(price-cost-pct(price,fee)-pct(price,ret)<=1)price+=10;
    const contribution=price-cost-pct(price,fee)-pct(price,ret);
    const clauses=[`preco ${price}`,`custo unitario ${cost}`,`taxa ${fee}%`,`devolucao ${ret}%`,`fixo ${fixed}`];
    const shift=R(0,4),rot=clauses.slice(shift).concat(clauses.slice(0,shift));
    add('break-even',`${rot.join('; ')}. ponto de equilibrio em unidades?`,
      {status:'resolved',target:'breakEvenUnits',value:Math.ceil(fixed/contribution),tolerance:0});
  }

  // 11) Event-identity collision stress, revenue and profit — 100
  for(let i=0;i<100;i++){
    const cost=R(4,35),q=R(8,55),p=cost+R(8,55);
    const a=[[q,p],[q,p],[R(5,60),cost+R(6,50)],[q,p]];
    const rev=sumRev(a),units=sumQ(a);
    if(i%2===0){
      add('identity-collision',`vendas: ${render(a,i%4)}. receita total?`,
        {status:'resolved',target:'revenue',value:rev,tolerance:.01},
        'Three distinct events intentionally share identical scalar values.');
    }else{
      const fee=R(0,9),fixed=R(0,400);
      add('identity-collision',`comprei ${units} unidades por ${cost}. vendas: ${render(a,i%4)}. taxa ${fee}% sobre faturamento; fixo ${fixed}. lucro?`,
        {status:'resolved',target:'netProfit',value:rev-units*cost-pct(rev,fee)-fixed,tolerance:.01});
    }
  }

  // 12) Safe refusal — 100
  const bad=[
    'vendas ocorreram em varios precos mas falta a quantidade de cada lote. faturamento?',
    'existe taxa do marketplace e o percentual nao foi informado. lucro?',
    'produto tem frete por unidade desconhecido. markup real?',
    'houve devolucoes mas a quantidade nao foi registrada. lucro liquido?',
    'faltam os dados do periodo anterior. crescimento do faturamento?',
    'preco pode ser 40 ou 55 e nao sabemos qual vale. receita?',
    'custo fixo ainda indefinido. ponto de equilibrio?',
    'algumas vendas tiveram desconto, percentual desconhecido.',
    'um dos canais tem taxa desconhecida. resultado total?',
    'sei o preco, mas nao quantas unidades foram vendidas. faturamento?'
  ];
  for(let i=0;i<100;i++){
    let p=bad[i%10];
    if(i>=10)p=p.replace('40',String(40+i%11)).replace('55',String(55+i%13));
    add('hard-refusal',p,{status:'incomplete'},'Required fact remains unknown.');
  }

  if(cases.length!==1200)throw new Error(`expected 1200 cases, got ${cases.length}`);
  return {
    schemaVersion:1,
    name:'V3 Business Hard 6 — 1200 final clean holdout',
    description:'Frozen after Hard5 tuning and before first execution. Final clean >=95% gate.',
    cases
  };
}

import { makeStarterProject, runVibeCoder } from './vibe_engine.js';

const pick=(arr,i)=>arr[i%arr.length];
const q=s=>`"${s}"`;

function c(id,category,prompt,project,expected){return {id,category,prompt,project,expected};}

export function generateVibeBenchmark500(){
  const cases=[];
  for(let i=1;i<=50;i++){
    const seed=`t${i}`, p=makeStarterProject(seed), sel=`#titulo-${seed}`, value=`Título ${i}`;
    const prompt=pick([
      `mude o texto de ${sel} para ${q(value)}`,
      `altere o conteúdo de ${sel} para ${q(value)}`,
      `troque o texto do elemento ${sel} para ${q(value)}`,
      `defina o texto de ${sel} como ${q(value)}`,
      `coloque o texto ${q(value)} em ${sel}`
    ],i);
    cases.push(c(`text-${i}`,'set_text',prompt,p,{plan:['SET_TEXT'],htmlIncludes:[`id="titulo-${seed}">${value}</h1>`]}));
  }
  for(let i=1;i<=50;i++){
    const seed=`a${i}`, p=makeStarterProject(seed), sel=`#botao-${seed}`, value=`ação-${i}`;
    const prompt=pick([
      `defina o atributo title de ${sel} como ${q(value)}`,
      `altere o atributo title de ${sel} para ${q(value)}`,
      `adicione o atributo title em ${sel} como ${q(value)}`,
      `coloque o atributo title de ${sel} como ${q(value)}`,
      `defina o atributo title no elemento ${sel} para ${q(value)}`
    ],i);
    cases.push(c(`attr-${i}`,'set_attribute',prompt,p,{plan:['SET_ATTRIBUTE'],htmlIncludes:[`id="botao-${seed}" title="${value}"`]}));
  }
  for(let i=1;i<=50;i++){
    const seed=`c${i}`, p=makeStarterProject(seed), sel=`#painel-${seed}`, cls=`classe${i}`;
    const prompt=pick([
      `adicione a classe ${cls} em ${sel}`,
      `coloque a classe ${cls} no elemento ${sel}`,
      `inclua a classe ${cls} em ${sel}`,
      `adicione classe ${cls} ao ${sel}`,
      `coloque classe ${cls} em ${sel}`
    ],i);
    cases.push(c(`class-${i}`,'add_class',prompt,p,{plan:['ADD_CLASS'],htmlIncludes:[`class="painel ${cls}"`]}));
  }
  for(let i=1;i<=50;i++){
    const seed=`v${i}`, p=makeStarterProject(seed), sel=`#painel-${seed}`;
    const hide=i<=25;
    const prompt=hide?pick([`esconda ${sel}`,`oculte o elemento ${sel}`,`esconda o painel ${sel}`,`oculte ${sel} agora`,`esconda o elemento ${sel}`],i):pick([`mostre ${sel}`,`exiba o elemento ${sel}`,`mostre o painel ${sel}`,`exiba ${sel} agora`,`mostre o elemento ${sel}`],i);
    if(!hide) p.html=p.html.replace(`id="painel-${seed}" class="painel"`,`id="painel-${seed}" class="painel" style="display: none"`);
    cases.push(c(`visibility-${i}`,'visibility',prompt,p,{plan:[hide?'HIDE':'SHOW'],htmlIncludes:hide?[`id="painel-${seed}" class="painel" style="display: none"`]:[`id="painel-${seed}" class="painel"`],htmlExcludes:hide?[]:[`display: none`]}));
  }
  for(let i=1;i<=50;i++){
    const seed=`n${i}`, p=makeStarterProject(seed), parent=`#app-${seed}`, id=`novo-${i}`, text=`Item ${i}`;
    const prompt=pick([
      `crie um <p> com id ${id} e texto ${q(text)} dentro de ${parent}`,
      `adicione um <p> com id ${id} e texto ${q(text)} dentro de ${parent}`,
      `insira um <p> com id ${id} e texto ${q(text)} em ${parent}`,
      `crie <p> com id ${id} e texto ${q(text)} em ${parent}`,
      `adicione <p> com id ${id} e texto ${q(text)} dentro de ${parent}`
    ],i);
    cases.push(c(`create-${i}`,'create_element',prompt,p,{plan:['CREATE_ELEMENT'],htmlIncludes:[`<p id="${id}">${text}</p>`]}));
  }
  for(let i=1;i<=50;i++){
    const seed=`r${i}`, p=makeStarterProject(seed), sel=`#status-${seed}`;
    const prompt=pick([
      `remova o elemento ${sel}`,
      `exclua o parágrafo ${sel}`,
      `apague o elemento ${sel}`,
      `remova o paragrafo ${sel}`,
      `exclua o elemento ${sel}`
    ],i);
    cases.push(c(`remove-${i}`,'remove_element',prompt,p,{plan:['REMOVE_ELEMENT'],htmlExcludes:[`id="status-${seed}"`]}));
  }
  for(let i=1;i<=50;i++){
    const seed=`j${i}`, p=makeStarterProject(seed), b=`#botao-${seed}`, t=`#status-${seed}`, text=`Clicado ${i}`;
    const prompt=pick([
      `ao clicar em ${b}, altere o texto de ${t} para ${q(text)}`,
      `ao clicar no ${b}, mude o texto de ${t} para ${q(text)}`,
      `ao clicar em ${b}, troque o conteúdo de ${t} para ${q(text)}`,
      `ao clicar em ${b}, defina o texto de ${t} como ${q(text)}`,
      `ao clicar no botão ${b}, altere o conteúdo de ${t} para ${q(text)}`
    ],i);
    cases.push(c(`clicktext-${i}`,'click_set_text',prompt,p,{plan:['ON_CLICK_SET_TEXT'],jsIncludes:[`querySelector("${b}")`,`querySelector("${t}")`,`textContent = ${JSON.stringify(text)}`]}));
  }
  for(let i=1;i<=50;i++){
    const seed=`g${i}`, p=makeStarterProject(seed), b=`#botao-${seed}`, t=`#painel-${seed}`, cls=`ativo${i}`;
    const prompt=pick([
      `ao clicar em ${b}, alterne a classe ${cls} em ${t}`,
      `ao clicar no ${b}, altere a classe ${cls} em ${t}`,
      `ao clicar em ${b}, toggle a classe ${cls} em ${t}`,
      `ao clicar no botão ${b}, alterne a classe ${cls} em ${t}`,
      `ao clicar em ${b}, alterne classe ${cls} no ${t}`
    ],i);
    cases.push(c(`toggle-${i}`,'click_toggle_class',prompt,p,{plan:['ON_CLICK_TOGGLE_CLASS'],jsIncludes:[`querySelector("${b}")`,`querySelector("${t}")`,`classList.toggle(${JSON.stringify(cls)})`]}));
  }
  const cssPairs=[['color','red'],['background','black'],['font-size','18px'],['padding','24px'],['border-radius','12px']];
  for(let i=1;i<=50;i++){
    const seed=`s${i}`, p=makeStarterProject(seed), sel=`#titulo-${seed}`, [prop,val]=pick(cssPairs,i);
    const prompt=pick([
      `no CSS, defina ${prop} de ${sel} para ${val}`,
      `no estilo, altere ${prop} de ${sel} para ${val}`,
      `ajuste no CSS a propriedade ${prop} de ${sel} para ${val}`,
      `mude no estilo ${prop} de ${sel} para ${val}`,
      `defina no CSS ${prop} de ${sel} como ${val}`
    ],i);
    cases.push(c(`css-${i}`,'css_rule',prompt,p,{plan:['SET_CSS_RULE'],cssIncludes:[`${sel} { ${prop}: ${val}; }`]}));
  }
  for(let i=1;i<=50;i++){
    const seed=`m${i}`, p=makeStarterProject(seed), title=`#titulo-${seed}`, panel=`#painel-${seed}`, value=`Composto ${i}`, cls=`modo${i}`;
    const prompt=pick([
      `mude o texto de ${title} para ${q(value)}; depois adicione a classe ${cls} em ${panel}`,
      `altere o conteúdo de ${title} para ${q(value)}; em seguida esconda ${panel}`,
      `defina o texto de ${title} como ${q(value)}; depois defina o atributo title de ${panel} como ${q(`painel-${i}`)}`,
      `troque o texto do elemento ${title} para ${q(value)}; depois mostre ${panel}`,
      `coloque o texto ${q(value)} em ${title}; em seguida adicione a classe ${cls} em ${panel}`
    ],i);
    if(prompt.includes('mostre')) p.html=p.html.replace(`id="painel-${seed}" class="painel"`,`id="painel-${seed}" class="painel" style="display: none"`);
    const second=prompt.includes('adicione a classe')?'ADD_CLASS':prompt.includes('esconda')?'HIDE':prompt.includes('atributo')?'SET_ATTRIBUTE':'SHOW';
    const exp={plan:['SET_TEXT',second],htmlIncludes:[`id="titulo-${seed}">${value}</h1>`]};
    if(second==='ADD_CLASS') exp.htmlIncludes.push(`class="painel ${cls}"`);
    if(second==='HIDE') exp.htmlIncludes.push('display: none');
    if(second==='SET_ATTRIBUTE') exp.htmlIncludes.push(`title="painel-${i}"`);
    if(second==='SHOW') exp.htmlExcludes=['display: none'];
    cases.push(c(`multi-${i}`,'composite',prompt,p,exp));
  }
  return {name:'VibeCoder HTML+JS+CSS 500',version:1,cases};
}

function includesAll(text,arr=[]){return arr.every(x=>text.includes(x));}
function excludesAll(text,arr=[]){return arr.every(x=>!text.includes(x));}
export function evaluateVibeCase(test){
  const started=performance.now();
  const result=runVibeCoder(test.prompt,test.project);
  const actualPlan=result.plan.map(x=>x.expert);
  const checks=[
    {name:'ok',pass:result.ok===true,expected:true,actual:result.ok},
    {name:'plan',pass:JSON.stringify(actualPlan)===JSON.stringify(test.expected.plan),expected:test.expected.plan,actual:actualPlan},
    {name:'htmlIncludes',pass:includesAll(result.project.html,test.expected.htmlIncludes),expected:test.expected.htmlIncludes||[],actual:result.project.html},
    {name:'htmlExcludes',pass:excludesAll(result.project.html,test.expected.htmlExcludes),expected:test.expected.htmlExcludes||[],actual:result.project.html},
    {name:'jsIncludes',pass:includesAll(result.project.js,test.expected.jsIncludes),expected:test.expected.jsIncludes||[],actual:result.project.js},
    {name:'cssIncludes',pass:includesAll(result.project.css,test.expected.cssIncludes),expected:test.expected.cssIncludes||[],actual:result.project.css}
  ];
  return {id:test.id,category:test.category,prompt:test.prompt,pass:checks.every(x=>x.pass),durationMs:performance.now()-started,checks,result};
}

export function runVibeBenchmark500(){
  const doc=generateVibeBenchmark500(); const started=performance.now(); const results=doc.cases.map(evaluateVibeCase); const totalDurationMs=performance.now()-started;
  const passed=results.filter(x=>x.pass).length;
  const byCategory={}; for(const r of results){const x=byCategory[r.category]??={total:0,passed:0};x.total++;if(r.pass)x.passed++;}
  return {name:doc.name,total:results.length,passed,failed:results.length-passed,passRate:passed/results.length,totalDurationMs,byCategory,results};
}

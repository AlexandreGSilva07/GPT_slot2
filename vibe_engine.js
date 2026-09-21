export const VIBE_ENGINE_VERSION = '4.0.0';

const clone = p => ({ html: String(p?.html ?? ''), js: String(p?.js ?? ''), css: String(p?.css ?? '') });
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g,' ').trim();
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function selectorFrom(text, nth=0) {
  return [...String(text).matchAll(/#[A-Za-z_][\w-]*/g)][nth]?.[0] ?? null;
}
function quoted(text) { return [...String(text).matchAll(/["“”']([^"“”']+)["“”']/g)].map(m=>m[1]); }
function cssEscapeValue(v){ return String(v).replace(/\\/g,'\\\\').replace(/`/g,'\\`'); }
function jsString(v){ return JSON.stringify(String(v)); }

function openingTagRegex(selector) {
  if (!selector?.startsWith('#')) throw new Error(`Seletor não suportado: ${selector}`);
  const id = escRe(selector.slice(1));
  return new RegExp(`<([a-zA-Z][\\w:-]*)([^>]*\\bid=["']${id}["'][^>]*)>`, 'i');
}
function fullElementRegex(selector) {
  if (!selector?.startsWith('#')) throw new Error(`Seletor não suportado: ${selector}`);
  const id = escRe(selector.slice(1));
  return new RegExp(`<([a-zA-Z][\\w:-]*)([^>]*\\bid=["']${id}["'][^>]*)>([\\s\\S]*?)<\\/\\1>`, 'i');
}
function hasElement(html, selector){ return openingTagRegex(selector).test(html); }

function replaceOpeningTag(html, selector, mutator) {
  const re = openingTagRegex(selector);
  const m = html.match(re);
  if (!m) throw new Error(`Elemento ${selector} não encontrado`);
  const next = mutator({tag:m[1], attrs:m[2]});
  return html.replace(re, `<${next.tag}${next.attrs}>`);
}
function setText(html, selector, value) {
  const re = fullElementRegex(selector); const m = html.match(re);
  if (!m) throw new Error(`Elemento ${selector} não encontrado`);
  return html.replace(re, `<${m[1]}${m[2]}>${value}</${m[1]}>`);
}
function setAttr(html, selector, name, value) {
  return replaceOpeningTag(html, selector, ({tag,attrs}) => {
    const are = new RegExp(`\\s${escRe(name)}=(?:"[^"]*"|'[^']*')`, 'i');
    if (are.test(attrs)) attrs = attrs.replace(are, ` ${name}="${value}"`);
    else attrs += ` ${name}="${value}"`;
    return {tag,attrs};
  });
}
function classTokens(attrs){ const m=attrs.match(/\sclass=(?:"([^"]*)"|'([^']*)')/i); return {m, value:(m?.[1]??m?.[2]??'').split(/\s+/).filter(Boolean)}; }
function setClasses(html, selector, fn){
  return replaceOpeningTag(html, selector, ({tag,attrs})=>{
    const {m,value}=classTokens(attrs); const next=[...new Set(fn(value))];
    if(m) attrs=attrs.replace(m[0], next.length?` class="${next.join(' ')}"`: '');
    else if(next.length) attrs+=` class="${next.join(' ')}"`;
    return {tag,attrs};
  });
}
function addClass(html, sel, c){ return setClasses(html,sel,x=>[...x,c]); }
function removeClass(html, sel, c){ return setClasses(html,sel,x=>x.filter(v=>v!==c)); }
function setInlineDisplay(html, sel, hidden){
  return replaceOpeningTag(html,sel,({tag,attrs})=>{
    const m=attrs.match(/\sstyle=(?:"([^"]*)"|'([^']*)')/i); let style=(m?.[1]??m?.[2]??'').trim();
    style=style.replace(/(?:^|;)\s*display\s*:[^;]*/ig,'').replace(/^;+|;+$/g,'').trim();
    if(hidden) style=(style?style+'; ':'')+'display: none';
    if(m) attrs=attrs.replace(m[0], style?` style="${style}"`:''); else if(style) attrs+=` style="${style}"`;
    return {tag,attrs};
  });
}
function removeElement(html, selector){ const re=fullElementRegex(selector); if(!re.test(html)) throw new Error(`Elemento ${selector} não encontrado`); return html.replace(re,''); }
function createElement(html,{tag,id,text,parent}){
  const re=fullElementRegex(parent); const m=html.match(re); if(!m) throw new Error(`Container ${parent} não encontrado`);
  const child=`<${tag} id="${id}">${text}</${tag}>`;
  return html.replace(re, `<${m[1]}${m[2]}>${m[3]}${child}</${m[1]}>`);
}
function appendJS(js, code){ return `${js.trim()}${js.trim()?'\n\n':''}${code.trim()}\n`; }
function upsertCss(css, selector, property, value){
  const re=new RegExp(`${escRe(selector)}\\s*\\{([^}]*)\\}`,'i'); const m=css.match(re);
  if(m){ let body=m[1].trim(); const pre=new RegExp(`${escRe(property)}\\s*:[^;]+;?`,'i'); body=pre.test(body)?body.replace(pre,`${property}: ${value};`):`${body}${body&& !body.endsWith(';')?';':''} ${property}: ${value};`; return css.replace(re,`${selector} { ${body.trim()} }`); }
  return `${css.trim()}${css.trim()?'\n':''}${selector} { ${property}: ${value}; }\n`;
}

function op(id, family, confidence, args, apply){ return {id,family,confidence,args,apply}; }

function parseSetText(segment){
  const n=norm(segment); if(!/(texto|conteudo)/.test(n) || !/(mude|altere|troque|defina|coloque)/.test(n) || /ao clicar/.test(n)) return null;
  const s=selectorFrom(segment), q=quoted(segment); if(!s||!q.length) return null;
  return op('SET_TEXT','html',0.96,{selector:s,text:q[q.length-1]},p=>({...p,html:setText(p.html,s,q[q.length-1])}));
}
function parseSetAttr(segment){
  const n=norm(segment); if(!/atributo/.test(n) || !/(defina|altere|adicione|coloque)/.test(n)) return null;
  const s=selectorFrom(segment), q=quoted(segment); const am=segment.match(/atributo\s+([\w:-]+)/i); if(!s||!am||!q.length) return null;
  return op('SET_ATTRIBUTE','html',0.96,{selector:s,name:am[1],value:q[q.length-1]},p=>({...p,html:setAttr(p.html,s,am[1],q[q.length-1])}));
}
function parseAddClass(segment){
  const n=norm(segment); if(!/(adicione|coloque|inclua).*(classe)/.test(n) || /ao clicar/.test(n)) return null;
  const s=selectorFrom(segment); const m=segment.match(/classe\s+([\w-]+)/i); if(!s||!m) return null;
  return op('ADD_CLASS','html',0.94,{selector:s,className:m[1]},p=>({...p,html:addClass(p.html,s,m[1])}));
}
function parseRemoveClass(segment){
  const n=norm(segment); if(!/(remova|retire).*(classe)/.test(n)) return null;
  const s=selectorFrom(segment); const m=segment.match(/classe\s+([\w-]+)/i); if(!s||!m) return null;
  return op('REMOVE_CLASS','html',0.94,{selector:s,className:m[1]},p=>({...p,html:removeClass(p.html,s,m[1])}));
}
function parseHide(segment){ const n=norm(segment); if(!/(esconda|oculte)/.test(n)||/ao clicar/.test(n))return null; const s=selectorFrom(segment); if(!s)return null; return op('HIDE','html',0.95,{selector:s},p=>({...p,html:setInlineDisplay(p.html,s,true)})); }
function parseShow(segment){ const n=norm(segment); if(!/(mostre|exiba)/.test(n)||/ao clicar/.test(n))return null; const s=selectorFrom(segment); if(!s)return null; return op('SHOW','html',0.95,{selector:s},p=>({...p,html:setInlineDisplay(p.html,s,false)})); }
function parseCreate(segment){
  const n=norm(segment); if(!/(crie|adicione|insira)/.test(n)||!/(dentro|em)/.test(n))return null;
  const tag=segment.match(/<([a-zA-Z][\w-]*)>/)?.[1]; const id=segment.match(/\bid\s+([\w-]+)/i)?.[1]; const parent=selectorFrom(segment); const q=quoted(segment); if(!tag||!id||!parent)return null;
  const text=q[0]??''; return op('CREATE_ELEMENT','html',0.97,{tag,id,text,parent},p=>({...p,html:createElement(p.html,{tag,id,text,parent})}));
}
function parseRemoveElement(segment){ const n=norm(segment); if(!/(remova|exclua|apague).*(elemento|botao|div|paragrafo|item)/.test(n))return null; const s=selectorFrom(segment); if(!s)return null; return op('REMOVE_ELEMENT','html',0.93,{selector:s},p=>({...p,html:removeElement(p.html,s)})); }
function parseClickSetText(segment){
  const n=norm(segment); if(!/ao clicar/.test(n)||!/(texto|conteudo)/.test(n)||!/(mude|altere|troque|defina)/.test(n))return null;
  const b=selectorFrom(segment,0), t=selectorFrom(segment,1), q=quoted(segment); if(!b||!t||!q.length)return null;
  const code=`document.querySelector(${jsString(b)})?.addEventListener('click', () => {\n  const target = document.querySelector(${jsString(t)});\n  if (target) target.textContent = ${jsString(q[q.length-1])};\n});`;
  return op('ON_CLICK_SET_TEXT','javascript',0.98,{button:b,target:t,text:q[q.length-1]},p=>({...p,js:appendJS(p.js,code)}));
}
function parseClickToggleClass(segment){
  const n=norm(segment); if(!/ao clicar/.test(n)||!/(alterne|toggle|altere).*(classe)/.test(n))return null;
  const b=selectorFrom(segment,0), t=selectorFrom(segment,1); const m=segment.match(/classe\s+([\w-]+)/i); if(!b||!t||!m)return null;
  const code=`document.querySelector(${jsString(b)})?.addEventListener('click', () => {\n  document.querySelector(${jsString(t)})?.classList.toggle(${jsString(m[1])});\n});`;
  return op('ON_CLICK_TOGGLE_CLASS','javascript',0.98,{button:b,target:t,className:m[1]},p=>({...p,js:appendJS(p.js,code)}));
}
function parseCssRule(segment){
  const n=norm(segment); if(!/(css|estilo)/.test(n)||!/(defina|ajuste|mude|altere)/.test(n))return null;
  const s=selectorFrom(segment); const m=segment.match(/(?:propriedade\s+)?([a-zA-Z-]+)\s+(?:de\s+)?#[\w-]+\s+(?:para|como)\s+["']?([^"']+?)["']?(?:\s+(?:no css|no estilo)|$)/i); if(!s||!m)return null;
  const property=m[1], value=m[2].trim(); return op('SET_CSS_RULE','css',0.95,{selector:s,property,value},p=>({...p,css:upsertCss(p.css,s,property,value)}));
}

const parsers=[parseClickSetText,parseClickToggleClass,parseSetAttr,parseSetText,parseRemoveClass,parseAddClass,parseHide,parseShow,parseRemoveElement,parseCreate,parseCssRule];

function splitPrompt(prompt){
  return String(prompt).split(/\s*(?:;|\bdepois\b|\bem seguida\b)\s*/i).map(s=>s.trim()).filter(Boolean);
}
function candidatesFor(segment){ return parsers.map(fn=>{try{return fn(segment)}catch{return null}}).filter(Boolean).sort((a,b)=>b.confidence-a.confidence); }
function validateProject(p){
  const issues=[];
  if(!/<html\b/i.test(p.html)) issues.push('HTML_ROOT_MISSING');
  if((p.html.match(/<script\b/gi)||[]).length !== (p.html.match(/<\/script>/gi)||[]).length) issues.push('UNBALANCED_SCRIPT_TAG');
  if((p.html.match(/<style\b/gi)||[]).length !== (p.html.match(/<\/style>/gi)||[]).length) issues.push('UNBALANCED_STYLE_TAG');
  return {ok:issues.length===0,issues};
}

export function runVibeCoder(prompt, inputProject){
  const project0=clone(inputProject); let project=clone(inputProject); const segments=splitPrompt(prompt);
  const trace=[]; const plan=[]; let evaluated=0;
  for(const [index,segment] of segments.entries()){
    const candidates=candidatesFor(segment); evaluated+=candidates.length;
    if(!candidates.length){ return {ok:false,version:VIBE_ENGINE_VERSION,prompt,normalized:norm(prompt),inputProject:project0,project,plan,trace,missing:[`Nenhuma microcompetência compatível com: ${segment}`],stats:{segments:segments.length,candidatesEvaluated:evaluated,steps:plan.length}}; }
    let accepted=null; let lastError=null;
    for(const candidate of candidates){
      try{
        const next=candidate.apply(clone(project)); const valid=validateProject(next);
        trace.push({segment:index+1,candidate:candidate.id,confidence:candidate.confidence,accepted:valid.ok,issues:valid.issues});
        if(valid.ok){ accepted=candidate; project=next; break; }
      }catch(error){ lastError=String(error.message||error); trace.push({segment:index+1,candidate:candidate.id,confidence:candidate.confidence,accepted:false,error:lastError}); }
    }
    if(!accepted){ return {ok:false,version:VIBE_ENGINE_VERSION,prompt,normalized:norm(prompt),inputProject:project0,project,plan,trace,missing:[lastError||`Todos os candidatos falharam no segmento ${index+1}`],stats:{segments:segments.length,candidatesEvaluated:evaluated,steps:plan.length}}; }
    plan.push({step:plan.length+1,expert:accepted.id,family:accepted.family,args:accepted.args});
  }
  return {ok:true,version:VIBE_ENGINE_VERSION,prompt,normalized:norm(prompt),inputProject:project0,project,plan,trace,expertSignature:plan.map(x=>x.expert).join(' -> '),missing:[],stats:{segments:segments.length,candidatesEvaluated:evaluated,steps:plan.length}};
}

export function composeSrcdoc(project){
  const p=clone(project);
  const cssTag=`<style>\n${p.css}\n</style>`;
  const jsTag=`<script>\n${p.js.replace(/<\/script/gi,'<\\/script')}\n<\/script>`;
  let html=p.html;
  html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,`${cssTag}\n</head>`):cssTag+html;
  html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,`${jsTag}\n</body>`):html+jsTag;
  return html;
}

export function makeStarterProject(seed='demo'){
  return {
    html:`<!doctype html>\n<html lang="pt-BR">\n<head><meta charset="utf-8"><title>Projeto ${seed}</title></head>\n<body>\n  <main id="app-${seed}">\n    <h1 id="titulo-${seed}">Olá</h1>\n    <p id="status-${seed}">Pronto</p>\n    <button id="botao-${seed}">Ação</button>\n    <div id="painel-${seed}" class="painel">Conteúdo</div>\n  </main>\n</body>\n</html>`,
    js:'',
    css:'.painel { padding: 12px; }\n.ativo { outline: 2px solid currentColor; }\n'
  };
}

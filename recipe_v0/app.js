import {resolveRecipeRequest} from './resolver.js';

const prompt = document.querySelector('#prompt');
const answer = document.querySelector('#answer');
const stateEl = document.querySelector('#state');
const trace = document.querySelector('#trace');

function label(value) {
  if (Array.isArray(value)) return value.map(label).join(', ');
  if (value && typeof value === 'object') return value.aliases?.[0] ?? value.id ?? JSON.stringify(value);
  return value ?? '—';
}

function run() {
  const result = resolveRecipeRequest(prompt.value);

  if (!result.ok) {
    answer.innerHTML = `<p class="ok">Não resolvido</p><p>${result.answer ?? result.missing?.join(', ')}</p>`;
    stateEl.innerHTML = '';
    trace.textContent = JSON.stringify(result.trace ?? result, null, 2);
    return;
  }

  answer.innerHTML = `<h3>${result.title}</h3><p>${result.answer}</p>`;

  const state = result.state;
  const slots = [
    ['intenção', state.intent],
    ['prato', state.dish],
    ['ingrediente principal', state.mainIngredient],
    ['ingrediente secundário', state.secondaryIngredient],
    ['método', state.method],
    ['restrições', state.constraint],
    ['resultado', state.desiredResult],
    ['porções', state.portions],
    ['tempo', state.timeLimit ? state.timeLimit + ' min' : null],
    ['resposta', state.responseAct]
  ];

  stateEl.innerHTML = slots.map(([name,value]) =>
    `<div class="slot"><small>${name}</small><strong>${label(value)}</strong></div>`
  ).join('');

  trace.textContent = JSON.stringify(result.trace, null, 2);
}

document.querySelector('#run').addEventListener('click', run);
run();

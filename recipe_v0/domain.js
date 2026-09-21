import {
  defineVariable,
  defineExpert,
  defineSlot,
  defineConstraint,
  defineFormula,
  defineComposition,
  buildRegistry
} from './schema.js';

const V = (expert, type, id, aliases = [], tags = [], attributes = {}) =>
  defineVariable({id, type, expert, aliases, tags, attributes});

const experts = [
  defineExpert({
    id: 'intent_recipe',
    slotTypes: ['INTENT'],
    keywords: ['quero', 'fazer', 'preparar', 'receita', 'cozinhar'],
    variables: [
      V('intent_recipe','INTENT','SUGGEST',['sugerir','o que posso fazer'],['suggest']),
      V('intent_recipe','INTENT','PREPARE',['fazer','preparar','cozinhar'],['prepare']),
      V('intent_recipe','INTENT','ADAPT',['adaptar','ajustar','mudar'],['adapt']),
      V('intent_recipe','INTENT','SUBSTITUTE',['substituir','trocar ingrediente'],['substitute']),
      V('intent_recipe','INTENT','EXPLAIN',['como fazer','explicar'],['explain'])
    ]
  }),

  defineExpert({
    id: 'dish_hot',
    slotTypes: ['DISH'],
    keywords: ['quente', 'almoço', 'jantar', 'panela', 'frigideira'],
    variables: [
      V('dish_hot','DISH','OMELET',['omelete'],['hot','quick','savory']),
      V('dish_hot','DISH','SOUP',['sopa','caldo'],['hot','wet','savory']),
      V('dish_hot','DISH','PASTA',['massa','macarrao','macarrão'],['hot','boil','savory']),
      V('dish_hot','DISH','RICE_BOWL',['arroz','bowl quente'],['hot','grain','savory']),
      V('dish_hot','DISH','STIR_FRY',['refogado','salteado'],['hot','pan','savory'])
    ]
  }),

  defineExpert({
    id: 'dish_cold',
    slotTypes: ['DISH'],
    keywords: ['frio', 'gelado', 'sem fogo', 'rápido'],
    variables: [
      V('dish_cold','DISH','SALAD',['salada'],['cold','no_cook','savory']),
      V('dish_cold','DISH','SANDWICH',['sanduiche','sanduíche'],['cold','assembly','savory']),
      V('dish_cold','DISH','SMOOTHIE',['vitamina','smoothie'],['cold','blend','sweet']),
      V('dish_cold','DISH','FRUIT_BOWL',['salada de frutas'],['cold','no_cook','sweet']),
      V('dish_cold','DISH','COLD_BOWL',['bowl frio'],['cold','assembly','savory'])
    ]
  }),

  defineExpert({
    id: 'dish_baked',
    slotTypes: ['DISH'],
    keywords: ['forno', 'assar', 'assado'],
    variables: [
      V('dish_baked','DISH','ROASTED_TRAY',['assadeira','legumes assados'],['hot','oven','savory']),
      V('dish_baked','DISH','SAVORY_PIE',['torta salgada'],['hot','oven','savory']),
      V('dish_baked','DISH','BAKED_PASTA',['massa de forno'],['hot','oven','savory']),
      V('dish_baked','DISH','CAKE',['bolo'],['hot','oven','sweet']),
      V('dish_baked','DISH','BAKED_FRUIT',['fruta assada'],['hot','oven','sweet'])
    ]
  }),

  defineExpert({
    id: 'ingredient_protein',
    slotTypes: ['INGREDIENT'],
    keywords: ['proteina', 'proteína', 'carne', 'ovo', 'frango'],
    variables: [
      V('ingredient_protein','INGREDIENT','EGG',['ovo','ovos'],['protein','animal'],{perServing:1.5,unit:'un'}),
      V('ingredient_protein','INGREDIENT','CHICKEN',['frango'],['protein','animal','savory'],{perServing:120,unit:'g'}),
      V('ingredient_protein','INGREDIENT','BEEF',['carne','bovina'],['protein','animal','savory'],{perServing:120,unit:'g'}),
      V('ingredient_protein','INGREDIENT','TUNA',['atum'],['protein','animal','savory'],{perServing:90,unit:'g'}),
      V('ingredient_protein','INGREDIENT','TOFU',['tofu'],['protein','plant','savory'],{perServing:120,unit:'g'}),
      V('ingredient_protein','INGREDIENT','BEANS',['feijao','feijão'],['protein','plant','legume','savory'],{perServing:100,unit:'g'}),
      V('ingredient_protein','INGREDIENT','LENTIL',['lentilha'],['protein','plant','legume','savory'],{perServing:90,unit:'g'}),
      V('ingredient_protein','INGREDIENT','CHICKPEA',['grao de bico','grão-de-bico'],['protein','plant','legume','savory'],{perServing:90,unit:'g'})
    ]
  }),

  defineExpert({
    id: 'ingredient_grain',
    slotTypes: ['INGREDIENT'],
    keywords: ['carboidrato', 'arroz', 'massa', 'grao', 'grão'],
    variables: [
      V('ingredient_grain','INGREDIENT','RICE',['arroz'],['grain','savory'],{perServing:75,unit:'g'}),
      V('ingredient_grain','INGREDIENT','PASTA_DRY',['macarrao','macarrão','massa seca'],['grain','savory'],{perServing:90,unit:'g'}),
      V('ingredient_grain','INGREDIENT','OATS',['aveia'],['grain'],{perServing:45,unit:'g'}),
      V('ingredient_grain','INGREDIENT','COUSCOUS',['cuscuz'],['grain','savory'],{perServing:70,unit:'g'}),
      V('ingredient_grain','INGREDIENT','QUINOA',['quinoa'],['grain','savory'],{perServing:65,unit:'g'}),
      V('ingredient_grain','INGREDIENT','BREAD',['pao','pão'],['grain','assembly'],{perServing:2,unit:'fatias'})
    ]
  }),

  defineExpert({
    id: 'ingredient_vegetable',
    slotTypes: ['INGREDIENT'],
    keywords: ['legume', 'verdura', 'vegetal'],
    variables: [
      V('ingredient_vegetable','INGREDIENT','TOMATO',['tomate'],['vegetable','savory'],{perServing:80,unit:'g'}),
      V('ingredient_vegetable','INGREDIENT','ONION',['cebola'],['vegetable','aromatic','savory'],{perServing:35,unit:'g'}),
      V('ingredient_vegetable','INGREDIENT','CARROT',['cenoura'],['vegetable','savory'],{perServing:70,unit:'g'}),
      V('ingredient_vegetable','INGREDIENT','POTATO',['batata'],['vegetable','starch','savory'],{perServing:150,unit:'g'}),
      V('ingredient_vegetable','INGREDIENT','ZUCCHINI',['abobrinha'],['vegetable','savory'],{perServing:90,unit:'g'}),
      V('ingredient_vegetable','INGREDIENT','BROCCOLI',['brocolis','brócolis'],['vegetable','savory'],{perServing:90,unit:'g'}),
      V('ingredient_vegetable','INGREDIENT','SPINACH',['espinafre'],['vegetable','leaf','savory'],{perServing:55,unit:'g'}),
      V('ingredient_vegetable','INGREDIENT','LETTUCE',['alface'],['vegetable','leaf','cold','savory'],{perServing:50,unit:'g'})
    ]
  }),

  defineExpert({
    id: 'ingredient_fruit',
    slotTypes: ['INGREDIENT'],
    keywords: ['fruta', 'doce', 'banana'],
    variables: [
      V('ingredient_fruit','INGREDIENT','BANANA',['banana'],['fruit','sweet'],{perServing:1,unit:'un'}),
      V('ingredient_fruit','INGREDIENT','APPLE',['maca','maçã'],['fruit','sweet'],{perServing:1,unit:'un'}),
      V('ingredient_fruit','INGREDIENT','STRAWBERRY',['morango'],['fruit','sweet'],{perServing:100,unit:'g'}),
      V('ingredient_fruit','INGREDIENT','MANGO',['manga'],['fruit','sweet'],{perServing:120,unit:'g'}),
      V('ingredient_fruit','INGREDIENT','ORANGE',['laranja'],['fruit','sweet'],{perServing:1,unit:'un'})
    ]
  }),

  defineExpert({
    id: 'ingredient_dairy',
    slotTypes: ['INGREDIENT'],
    keywords: ['leite', 'queijo', 'laticinio', 'laticínio'],
    variables: [
      V('ingredient_dairy','INGREDIENT','MILK',['leite'],['dairy','liquid'],{perServing:160,unit:'ml'}),
      V('ingredient_dairy','INGREDIENT','YOGURT',['iogurte'],['dairy','creamy'],{perServing:120,unit:'g'}),
      V('ingredient_dairy','INGREDIENT','MOZZARELLA',['mucarela','muçarela'],['dairy','cheese','savory'],{perServing:35,unit:'g'}),
      V('ingredient_dairy','INGREDIENT','PARMESAN',['parmesao','parmesão'],['dairy','cheese','savory'],{perServing:20,unit:'g'}),
      V('ingredient_dairy','INGREDIENT','BUTTER',['manteiga'],['dairy','fat'],{perServing:12,unit:'g'})
    ]
  }),

  defineExpert({
    id: 'ingredient_pantry',
    slotTypes: ['INGREDIENT'],
    keywords: ['tempero', 'molho', 'despensa', 'azeite'],
    variables: [
      V('ingredient_pantry','INGREDIENT','OLIVE_OIL',['azeite'],['fat','savory'],{perServing:12,unit:'ml'}),
      V('ingredient_pantry','INGREDIENT','GARLIC',['alho'],['aromatic','savory'],{perServing:0.5,unit:'dente'}),
      V('ingredient_pantry','INGREDIENT','TOMATO_SAUCE',['molho de tomate'],['sauce','savory'],{perServing:90,unit:'ml'}),
      V('ingredient_pantry','INGREDIENT','FLOUR',['farinha'],['flour'],{perServing:60,unit:'g'}),
      V('ingredient_pantry','INGREDIENT','SUGAR',['acucar','açúcar'],['sweetener','sweet'],{perServing:25,unit:'g'}),
      V('ingredient_pantry','INGREDIENT','COCOA',['cacau','chocolate em po','chocolate em pó'],['sweet','cocoa'],{perServing:15,unit:'g'})
    ]
  }),

  defineExpert({
    id: 'method_heat',
    slotTypes: ['METHOD'],
    keywords: ['assar', 'fritar', 'grelhar', 'ferver', 'cozinhar'],
    variables: [
      V('method_heat','METHOD','PAN_FRY',['frigideira','refogar'],['pan','hot','savory']),
      V('method_heat','METHOD','BOIL',['ferver','cozinhar em agua','cozinhar em água'],['boil','wet','hot']),
      V('method_heat','METHOD','BAKE',['assar','forno'],['oven','dry','hot']),
      V('method_heat','METHOD','ROAST',['assar legumes','assar carne'],['oven','dry','hot']),
      V('method_heat','METHOD','STEAM',['vapor','cozinhar no vapor'],['wet','hot']),
      V('method_heat','METHOD','GRILL',['grelhar'],['grill','dry','hot'])
    ]
  }),

  defineExpert({
    id: 'method_no_cook',
    slotTypes: ['METHOD'],
    keywords: ['sem fogo', 'sem forno', 'misturar', 'bater'],
    variables: [
      V('method_no_cook','METHOD','ASSEMBLE',['montar','juntar'],['assembly','cold']),
      V('method_no_cook','METHOD','MIX',['misturar'],['no_cook','cold']),
      V('method_no_cook','METHOD','BLEND',['bater','liquidificador'],['blend','cold']),
      V('method_no_cook','METHOD','TOSS',['envolver','misturar salada'],['no_cook','cold'])
    ]
  }),

  defineExpert({
    id: 'constraint_diet',
    slotTypes: ['CONSTRAINT'],
    keywords: ['sem', 'nao posso','não posso','evitar'],
    variables: [
      V('constraint_diet','CONSTRAINT','NO_DAIRY',['sem leite','sem lactose','sem laticinios','sem laticínios'],['diet']),
      V('constraint_diet','CONSTRAINT','NO_MEAT',['sem carne','vegetariano'],['diet']),
      V('constraint_diet','CONSTRAINT','NO_OVEN',['sem forno','nao quero usar forno','não quero usar forno','nao quero forno','não quero forno'],['equipment']),
      V('constraint_diet','CONSTRAINT','NO_FRIED',['sem fritura','nao fritar','não fritar'],['method']),
      V('constraint_diet','CONSTRAINT','PLANT_ONLY',['vegano','somente vegetal'],['diet'])
    ]
  }),

  defineExpert({
    id: 'result_texture',
    slotTypes: ['RESULT'],
    keywords: ['crocante', 'cremoso', 'macio', 'leve'],
    variables: [
      V('result_texture','RESULT','CREAMY',['cremoso','cremosa'],['texture']),
      V('result_texture','RESULT','CRISPY',['crocante'],['texture']),
      V('result_texture','RESULT','SOFT',['macio','macia'],['texture']),
      V('result_texture','RESULT','LIGHT',['leve'],['texture']),
      V('result_texture','RESULT','GOLDEN',['dourado','dourada'],['texture'])
    ]
  }),

  defineExpert({
    id: 'response_act',
    slotTypes: ['RESPONSE_ACT'],
    keywords: ['sugira', 'explique', 'passo a passo', 'responda'],
    variables: [
      V('response_act','RESPONSE_ACT','SHORT_SUGGESTION',['sugestao curta','sugestão curta'],['short']),
      V('response_act','RESPONSE_ACT','STEP_BY_STEP',['passo a passo'],['steps']),
      V('response_act','RESPONSE_ACT','EXPLAIN_CHOICE',['explique a escolha'],['explain'])
    ]
  })
];

const slots = [
  defineSlot({id:'intent', type:'INTENT', acceptsExperts:['intent_recipe']}),
  defineSlot({id:'dish', type:'DISH', acceptsExperts:['dish_hot','dish_cold','dish_baked']}),
  defineSlot({id:'mainIngredient', type:'INGREDIENT', acceptsExperts:['ingredient_protein','ingredient_grain','ingredient_vegetable','ingredient_fruit','ingredient_dairy','ingredient_pantry']}),
  defineSlot({id:'secondaryIngredient', type:'INGREDIENT', required:false, acceptsExperts:['ingredient_protein','ingredient_grain','ingredient_vegetable','ingredient_fruit','ingredient_dairy','ingredient_pantry']}),
  defineSlot({id:'method', type:'METHOD', acceptsExperts:['method_heat','method_no_cook']}),
  defineSlot({id:'constraint', type:'CONSTRAINT', required:false, multi:true, maxItems:4, acceptsExperts:['constraint_diet']}),
  defineSlot({id:'desiredResult', type:'RESULT', required:false, acceptsExperts:['result_texture']}),
  defineSlot({id:'portions', type:'PARAMETER'}),
  defineSlot({id:'timeLimit', type:'PARAMETER', required:false}),
  defineSlot({id:'responseAct', type:'RESPONSE_ACT', acceptsExperts:['response_act']})
];

const constraints = [
  defineConstraint({
    id:'no-dairy-main',
    when:[{slot:'constraint',op:'in',value:'NO_DAIRY'}],
    targetSlot:'mainIngredient',
    denyTags:['dairy']
  }),
  defineConstraint({
    id:'no-dairy-secondary',
    when:[{slot:'constraint',op:'in',value:'NO_DAIRY'}],
    targetSlot:'secondaryIngredient',
    denyTags:['dairy']
  }),
  defineConstraint({
    id:'plant-main',
    when:[{slot:'constraint',op:'in',value:'PLANT_ONLY'}],
    targetSlot:'mainIngredient',
    denyTags:['animal','dairy']
  }),
  defineConstraint({
    id:'plant-secondary',
    when:[{slot:'constraint',op:'in',value:'PLANT_ONLY'}],
    targetSlot:'secondaryIngredient',
    denyTags:['animal','dairy']
  }),
  defineConstraint({
    id:'no-oven-method',
    when:[{slot:'constraint',op:'in',value:'NO_OVEN'}],
    targetSlot:'method',
    denyTags:['oven']
  }),
  defineConstraint({
    id:'smoothie-method',
    when:[{slot:'dish',op:'eq',value:'SMOOTHIE'}],
    targetSlot:'method',
    allowValues:['BLEND']
  }),
  defineConstraint({
    id:'salad-method',
    when:[{slot:'dish',op:'eq',value:'SALAD'}],
    targetSlot:'method',
    allowValues:['MIX','TOSS','ASSEMBLE']
  })
];

const formulas = [
  defineFormula({
    id:'main-quantity',
    inputs:['mainIngredient','portions'],
    output:'mainQuantity',
    compute: ({mainIngredient, portions}) => {
      const per = mainIngredient?.attributes?.perServing;
      if (!Number.isFinite(per)) return null;
      return {
        value: Math.round(per * Number(portions) * 10) / 10,
        unit: mainIngredient.attributes.unit
      };
    }
  }),
  defineFormula({
    id:'secondary-quantity',
    inputs:['secondaryIngredient','portions'],
    output:'secondaryQuantity',
    compute: ({secondaryIngredient, portions}) => {
      const per = secondaryIngredient?.attributes?.perServing;
      if (!Number.isFinite(per)) return null;
      return {
        value: Math.round(per * Number(portions) * 10) / 10,
        unit: secondaryIngredient.attributes.unit
      };
    }
  })
];

const label = value => value?.aliases?.[0] ?? value?.id ?? String(value ?? '');
const qty = q => q ? `${String(q.value).replace('.', ',')} ${q.unit}` : '';

const compositions = [
  defineComposition({
    id:'recipe-answer',
    slots:['intent','dish','mainIngredient','method','portions','responseAct'],
    formulas:['main-quantity','secondary-quantity'],
    output: state => ({
      type:'recipe',
      title:`${label(state.dish)} com ${label(state.mainIngredient)}`,
      summary:`Para ${state.portions} porções: use ${qty(state.mainQuantity)} de ${label(state.mainIngredient)}${state.secondaryIngredient ? ` e ${qty(state.secondaryQuantity)} de ${label(state.secondaryIngredient)}` : ''}. Método: ${label(state.method)}.`,
      state
    })
  })
];

export const recipeRegistry = buildRegistry({
  slots,
  experts,
  constraints,
  formulas,
  compositions
});

export {slots, experts, constraints, formulas, compositions};

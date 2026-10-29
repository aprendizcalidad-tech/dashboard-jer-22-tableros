import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARDS, MONTHS, boardSources } from '../js/catalog.js';
import { numeric, getView, chartData, filtersFor } from '../js/data.js';

test('existen 22 pestañas numeradas y la región sin hoja se omite',()=>{
  assert.deepEqual(BOARDS.map(x=>x.id),Array.from({length:22},(_,i)=>i+1));
  assert.deepEqual(boardSources(BOARDS[9],'amz'),[]);
  assert.deepEqual(boardSources(BOARDS[16],'boy'),['POLIZAS']);
});
test('Mínimos crea una pareja por categoría sin mezclar registros',()=>{
  const b=BOARDS[2],source={headers:['CATEGORIA','MES VERIFICADO','MINIMOS CONTRACTUALES','CUMPLIMIENTO','% CUMPLIMIENTO'],rows:[
    ['MUNICIPIOS','FEBRERO',2,2,1],['PDV','ENERO',12,10,.83],['MUNICIPIOS','ENERO',2,1,.5]
  ]};
  const municipios=getView(source,b.sections[0].boy,'boy');
  const pdv=getView(source,b.sections[1].boy,'boy');
  assert.equal(municipios.rows.length,2);
  assert.deepEqual(municipios.rows.map(x=>x[1]),['ENERO','FEBRERO']);
  assert.equal(pdv.rows.length,1);
  assert.deepEqual(chartData(pdv).series[0].values,[12]);
});
test('las UAD filtran registros locales y las hojas sin ZONA se rotulan como regionales',()=>{
  const spec=BOARDS[3].sections[0].boy;
  const source={headers:['ZONA','MES VERIFICADO','CARNET','PERSONAL','CUMPLIMIENTO'],rows:[['TUNJA','ENERO',5,10,.5],['DUITAMA','ENERO',8,10,.8]]};
  assert.deepEqual(getView(source,spec,'boy','TUNJA').rows,[['TUNJA','ENERO',5,10,.5]]);
  const sales={headers:['MES','2025','2026','CUMPLIMIENTO'],rows:[['ENERO',3,4,1.3]]};
  assert.equal(getView(sales,BOARDS[1].sections[0].boy,'boy','TUNJA').regionalTotal,true);
  const amazon={headers:source.headers,rows:[['AMAZONAS','ENERO',42,101,.4158]]};
  const regional=getView(amazon,BOARDS[3].sections[0].amz,'amz','LETICIA');
  assert.equal(regional.rows.length,1);
  assert.equal(regional.regionalTotal,true);
});
test('valores faltantes no se convierten en cero y -1 se conserva',()=>{
  assert.equal(numeric(null),null);assert.equal(numeric('#DIV/0!'),null);
  assert.equal(numeric(-1),-1);assert.equal(numeric('$ 37.188.853,00'),37188853);
  const spec=BOARDS[7].sections[0].amz;
  const view=getView({headers:['MES','FECHA EFECTIVA DE PAGO','FECHA LIMITE DE PAGO','EFECTIVIDAD'],rows:[['ENERO','2026-02-06','2026-02-05',-1],['FEBRERO',null,null,100]]},spec,'amz');
  assert.deepEqual(chartData(view).series[0].values,[-1,100]);
});
test('una configuración individual reemplaza solo sus campos propios',()=>{
  const global={months:MONTHS,region:'both',zone:'ALL',obligation:'ALL'};
  const one=filtersFor(global,{region:'amz',months:['MARZO']});
  assert.deepEqual(one,{months:['MARZO'],region:'amz',zone:'ALL',obligation:'ALL'});
});
test('los reportes CNJSA tienen gráfica de presencia, no de número de radicado',()=>{
  const sec=BOARDS[18].sections[0];
  const view=getView({headers:['MES','207 · DERECHOS'],rows:[['ENERO',10130],['FEBRERO',null]]},sec.boy,'boy');
  assert.deepEqual(chartData(view).series[0].values,[1,null]);
});

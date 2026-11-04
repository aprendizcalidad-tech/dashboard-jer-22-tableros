import { CONFIG } from './config.js';
import { BOARDS, MONTHS, REGIONS, UADS, OBLIGATIONS } from './catalog.js';
import { chartData, filtersFor, format, getView, isConfigured, normalize, numeric, requestAppsScript } from './data.js';
import { renderChart, renderTable } from './charts.js';
import { createReport } from './pdf.js';
import { salesIndicators, sectionMetric } from './metrics.js';
import { initAuth, currentUser, token, login, register, resetPassword, logout } from './auth.js';

const $=id=>document.getElementById(id);
const STORE='jer_dashboard_overrides_v1';
const state={board:1,availableYears:[],global:{months:MONTHS.slice(),years:null,region:'both',zone:'ALL',obligation:'ALL'},overrides:{},response:null,epoch:0};
try {state.overrides=JSON.parse(localStorage.getItem(STORE) || '{}') || {};} catch (_) {}

function message(text='',error=false) { $('status').textContent=text;$('status').classList.toggle('error',error); }
function authMessage(text='',error=false) { $('auth-status').textContent=text;$('auth-status').classList.toggle('error',error); }
function buttonDisabled(disabled) {for(const id of ['refresh','pdf-current','pdf-summary','pdf-all']) $(id).disabled=disabled;}
function elt(tag,className,text) {const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function effective(boardId=state.board) {return filtersFor(state.global,state.overrides[boardId]);}
function selectedRegions(filters) {
  const all=filters.region==='both'?['boy','amz']:[filters.region];
  return all.filter(r=>filters.zone==='ALL'||UADS[r].includes(filters.zone));
}
function preset(key) {
  if(key==='ALL')return MONTHS.slice();
  if(/^Q[1-4]$/.test(key))return MONTHS.slice((+key[1]-1)*3,(+key[1])*3);
  if(key==='H1')return MONTHS.slice(0,6);
  if(key==='H2')return MONTHS.slice(6);
  return null;
}
function monthButtons(root,selected,onClick) {
  root.replaceChildren();
  MONTHS.forEach(m=>{
    const b=elt('button',`month-chip ${selected.includes(m)?'active':''}`,m.slice(0,3));
    b.type='button';b.title=m;b.setAttribute('aria-pressed',selected.includes(m));
    b.addEventListener('click',()=>onClick(m));root.append(b);
  });
}
function renderMonths() {
  monthButtons($('month-chips'),state.global.months,m=>{
    const set=new Set(state.global.months);
    if(set.has(m) && set.size===1)return;
    set.has(m)?set.delete(m):set.add(m);
    state.global.months=MONTHS.filter(x=>set.has(x));$('period').value='CUSTOM';renderMonths();
  });
}
function yearButtons(root,selected,onClick,showAll=false) {
  root.replaceChildren();
  if(showAll){
    const all=elt('button',`month-chip ${selected.length?'':'active'}`,'Todos');
    all.type='button';all.setAttribute('aria-pressed',!selected.length);
    all.addEventListener('click',()=>onClick(null));root.append(all);
  }
  state.availableYears.forEach(year=>{
    const active=selected.includes(year);
    const b=elt('button',`month-chip ${active?'active':''}`,String(year));
    b.type='button';b.setAttribute('aria-pressed',active);
    b.addEventListener('click',()=>onClick(year));root.append(b);
  });
}
function renderYears() {
  yearButtons($('year-chips'),state.global.years||[],year=>{
    if(year===null)state.global.years=[];
    else {
      const set=new Set(state.global.years||[]);
      if(set.has(year)&&set.size===1)return;
      set.has(year)?set.delete(year):set.add(year);
      state.global.years=[...set].sort((a,b)=>a-b);
    }
    renderYears();
  },true);
}
function fillZone(select,region,includeInherit=false) {
  const previous=select.value;
  select.replaceChildren();
  if(includeInherit)select.add(new Option('Heredar UAD','INHERIT'));
  select.add(new Option('Todas las UAD','ALL'));
  (region==='both'?[...UADS.boy,...UADS.amz]:UADS[region]||[...UADS.boy,...UADS.amz]).forEach(z=>select.add(new Option(z,z)));
  if([...select.options].some(o=>o.value===previous))select.value=previous;
  else select.value=includeInherit?'INHERIT':'ALL';
}
function setupSelects() {
  for(const [key,title] of OBLIGATIONS) {
    $('obligation').add(new Option(title,key));
  }
  fillZone($('zone'),'both');fillZone($('override-zone'),'both',true);renderMonths();
  renderYears();
  $('period').addEventListener('change',()=>{state.global.months=preset($('period').value)||state.global.months;renderMonths();});
  $('region').addEventListener('change',()=>fillZone($('zone'),$('region').value));
  $('override-region').addEventListener('change',()=>fillZone($('override-zone'),$('override-region').value==='INHERIT'?$('region').value:$('override-region').value,true));
  $('override-period').addEventListener('change',()=>{
    $('override-months').hidden=$('override-period').value!=='CUSTOM';
    renderOverrideMonths();
  });
  $('override-year-mode').addEventListener('change',renderOverrideYears);
  $('global-filters').addEventListener('submit',e=>{
    e.preventDefault();if(state.global.years===null)return message('Espera a que carguen los años disponibles.',true);
    state.global.region=$('region').value;state.global.zone=$('zone').value;
    state.global.obligation=$('obligation').value;
    renderNav();loadBoard();
  });
}
function visibleBoards() {
  return BOARDS.filter(b=>{
    const obligation=state.overrides[b.id]?.obligation ?? state.global.obligation;
    return obligation==='ALL'||obligation===b.obligation;
  });
}
function renderNav() {
  const list=visibleBoards();
  if(!list.some(b=>b.id===state.board))state.board=list[0]?.id || 1;
  const nav=$('board-nav');nav.replaceChildren();
  list.forEach(b=>{
    const btn=elt('button',b.id===state.board?'active':'',`${b.id}. ${b.title}`);
    btn.type='button';btn.setAttribute('aria-current',b.id===state.board?'page':'false');
    btn.addEventListener('click',()=>{state.board=b.id;renderNav();loadBoard();});nav.append(btn);
  });
  const board=BOARDS.find(b=>b.id===state.board);
  $('board-index').textContent=`TABLERO ${String(board.id).padStart(2,'0')} / 22`;
  $('board-title').textContent=board.title;
  $('board-subtitle').textContent=state.overrides[board.id]?'Configuración individual activa para esta pestaña.':'Aplicando filtros globales.';
}
function selectOverride() {
  delete state.draftMonths;
  delete state.draftYears;
  const o=state.overrides[state.board] || {};
  const board=BOARDS.find(b=>b.id===state.board);
  const select=$('override-obligation');
  select.replaceChildren(new Option('Heredar obligación','INHERIT'),new Option('Todas las obligaciones','ALL'));
  select.add(new Option(OBLIGATIONS.find(x=>x[0]===board.obligation)?.[1] || board.title,board.obligation));
  $('override-region').value=o.region??'INHERIT';
  fillZone($('override-zone'),o.region??state.global.region,true);
  $('override-zone').value=o.zone??'INHERIT';
  $('override-obligation').value=o.obligation??'INHERIT';
  $('override-year-mode').value=Object.hasOwn(o,'years')?(o.years.length?'CUSTOM':'ALL'):'INHERIT';
  renderOverrideYears();
  $('override-period').value=o.months?'CUSTOM':'INHERIT';
  $('override-months').hidden=!o.months;
  renderOverrideMonths();$('override-dialog').showModal();
}
function renderOverrideYears() {
  const custom=$('override-year-mode').value==='CUSTOM';
  $('override-years').hidden=!custom;
  if(!custom)return;
  const selected=state.draftYears || (state.overrides[state.board]?.years?.length?state.overrides[state.board].years:null)
    || (state.global.years?.length?state.global.years:null) || state.availableYears.slice(-1);
  yearButtons($('override-years'),selected,year=>{
    const set=new Set(state.draftYears || selected);
    if(set.has(year)&&set.size===1)return;
    set.has(year)?set.delete(year):set.add(year);
    state.draftYears=[...set].sort((a,b)=>a-b);renderOverrideYears();
  });
}
function renderOverrideMonths() {
  const selected=state.draftMonths || state.overrides[state.board]?.months || state.global.months;
  monthButtons($('override-months'),selected,m=>{
    const set=new Set(state.draftMonths || selected);
    if(set.has(m)&&set.size===1)return;
    set.has(m)?set.delete(m):set.add(m);
    state.draftMonths=MONTHS.filter(x=>set.has(x));renderOverrideMonths();
  });
}
function saveOverride() {
  const get=id=>$(id).value;
  const o={};
  const pr=get('override-period');
  if(pr!=='INHERIT')o.months=preset(pr)||(state.draftMonths || state.overrides[state.board]?.months || state.global.months);
  const ym=get('override-year-mode');
  if(ym==='ALL')o.years=[];
  if(ym==='CUSTOM')o.years=state.draftYears || (state.overrides[state.board]?.years?.length?state.overrides[state.board].years:null)
    || (state.global.years?.length?state.global.years:null) || state.availableYears.slice(-1);
  if(get('override-region')!=='INHERIT')o.region=get('override-region');
  if(get('override-zone')!=='INHERIT')o.zone=get('override-zone');
  if(get('override-obligation')!=='INHERIT')o.obligation=get('override-obligation');
  if(Object.keys(o).length)state.overrides[state.board]=o;else delete state.overrides[state.board];
  delete state.draftMonths;
  delete state.draftYears;
  localStorage.setItem(STORE,JSON.stringify(state.overrides));
  $('override-dialog').close();renderNav();loadBoard();
}
function setRegionTitle(region) {
  const header=elt('div','region-header');header.append(elt('h3','',REGIONS[region]),elt('span','region-label',region==='boy'?'Primero':'Debajo de Boyacá'));return header;
}
function sectionView(board,section,region,response,filters) {
  const spec=section[region];
  return spec ? getView(response.data?.[region]?.[spec.sheet],spec,region,filters.zone,filters.years) : null;
}
function renderSection(section,view,region,filters) {
  const card=elt('article','topic');
  const header=elt('header');header.append(elt('h4','',region==='amz'&&section.amzTitle?section.amzTitle:section.title),elt('small','',`${REGIONS[region]} · ${view.sheet}`));card.append(header);
  if(view.error){card.append(elt('p','message error',view.error));return card;}
  const pair=elt('div',view.noChart?'pair table-only':'pair');
  const tablePanel=elt('div'),chartPanel=elt('div');
  tablePanel.append(elt('h5','','Tabla'),renderTable(view));
  pair.append(tablePanel);
  if(!view.noChart){chartPanel.append(elt('h5','','Gráfica'),renderChart(view));pair.append(chartPanel);}
  const metric=sectionMetric(view);
  if(metric)card.append(summaryCard(metric.title,metric.value,metric.note));
  card.append(pair);
  if(!view.rows.length)card.append(elt('p','data-note','La hoja existe, pero no contiene registros para estos filtros.'));
  if(view.regionalTotal)card.append(elt('p','data-note','Esta hoja no separa datos por UAD. Se muestra el total regional.'));
  if(view.yearUnavailable)card.append(elt('p','data-note','Esta fuente no identifica el año seleccionado. No se atribuyen sus datos a ese año.'));
  if(view.monthUnfiltered && filters.months.length<12)card.append(elt('p','data-note','Esta hoja no tiene mes. El filtro de meses no modifica sus registros.'));
  if(section.note)card.append(elt('p','topic-note',section.note));
  if(section.provisional)card.append(elt('p','topic-note','Venta por modalidad está ubicada provisionalmente en la pestaña 22, según la última anotación del boceto.'));
  return card;
}
function summaryCard(title,body,note) {
  const card=elt('article','summary-card');card.append(elt('h4','',title));
  if(typeof body==='string')card.append(elt('strong','value',body));else if(body)card.append(body);
  if(note)card.append(elt('p','',note));return card;
}
function overview(region,response,filters) {
  const root=elt('section','region-block');
  const book=response.data?.[region];
  if(!book)return null;
  const chanceName='Ventas Chance',apName=region==='boy'?'Ventas AP':'Ventas';
  const chanceSpec={sheet:chanceName,columns:['MES','2025','2026'],label:'MES',series:['2025','2026']};
  const apSpec={sheet:apName,columns:['MES','2025','2026'],label:'MES',series:['2025','2026']};
  const chance=getView(book[chanceName],chanceSpec,region,filters.zone,filters.years);
  const ap=getView(book[apName],apSpec,region,filters.zone,filters.years);
  const rights=getView(book['Derechos de explotación'],{sheet:'Derechos de explotación',columns:['MES','EFECTIVIDAD'],label:'MES',series:['EFECTIVIDAD']},region,filters.zone,filters.years);
  if(!chance&&!ap&&!rights)return null;
  root.append(setRegionTitle(region));
  const indicators=salesIndicators(book,region,filters);
  if(indicators.length){
    const row=elt('div','year-indicators');
    indicators.forEach(({year,total,compliance,note})=>{
      const tile=elt('article','year-indicator');
      tile.append(elt('h4','',`Ventas ${year} · ${REGIONS[region]}`),elt('strong','',total),
        elt('span','',`Cumplimiento ${year}: ${compliance}`),elt('small','',note));
      row.append(tile);
    });
    root.append(row);
  }
  const grid=elt('div','summary-grid');
  grid.append(summaryCard('Ventas Chance',chance?renderChart(chance):'Sin hoja de origen',`Ventas de ${chance?.series?.join(' y ')||'los años elegidos'}.`));
  grid.append(summaryCard(region==='amz'?'Ventas Amazonas':'Ventas apuestas permanentes',ap?renderChart(ap):'Sin hoja de origen',region==='amz'?'Ventas de Amazonas según los años seleccionados.':`Ventas de ${ap?.series?.join(' y ')||'los años elegidos'}.`));
  const comparison=chance?.series?.filter(x=>/^\d{4}$/.test(x)).sort((a,b)=>Number(a)-Number(b))||[];
  const prior=comparison.at(-2),latest=comparison.at(-1);
  const priorIdx=chance?.headers.indexOf(prior),latestIdx=chance?.headers.indexOf(latest);
  const valid=prior&&latest?chance.rows.map(r=>[numeric(r[priorIdx]),numeric(r[latestIdx])]).filter(([a,b])=>a!==null&&b!==null&&a!==0):[];
  const base=valid.reduce((t,r)=>t+r[0],0),actual=valid.reduce((t,r)=>t+r[1],0);
  const ratio=base?`${new Intl.NumberFormat('es-CO',{maximumFractionDigits:1}).format(actual/base*100)} %`:'Sin comparativo';
  grid.append(summaryCard('Cumplimiento Chance del período',ratio,prior&&latest?`Ventas ${latest} ÷ ventas ${prior} de los meses elegidos.`:'Elige al menos dos años con ventas para calcular la comparación.'));
  const rightsRows=rights?.rows.filter(r=>r[1]!==null && r[1]!==undefined)||[];
  const last=rights?.yearUnavailable?null:rightsRows.at(-1);
  grid.append(summaryCard('Efectividad derechos de explotación',last?format(last[1]):'Sin dato',rights?.yearUnavailable?'La fuente no identifica el año seleccionado.':last?`Último mes con registro: ${last[0]}. Valor literal del Excel.`:'No hay valor para los meses elegidos.'));
  if(region==='boy') {
    if(book['REQUERIMIENTOS'])grid.append(summaryCard('Requerimientos · respuestas %','Sin fórmula definida','La hoja no incluye estado de respuesta ni total esperado.'));
    if(book['CAPACITACIONES '])grid.append(summaryCard('Capacitación %','Sin meta definida','La hoja no incluye una meta para calcular este porcentaje.'));
  }
  root.append(grid);return root;
}
function renderBoard(board,response,filters) {
  const container=$('dashboard');container.replaceChildren();
  let shown=0;
  for(const region of selectedRegions(filters)) {
    if(!response.data?.[region])continue;
    if(board.kind==='overview') {const el=overview(region,response,filters);if(el){container.append(el);shown++;}continue;}
    const cards=board.sections.map(section=>({section,view:sectionView(board,section,region,response,filters)})).filter(x=>x.view);
    if(!cards.length)continue;
    const block=elt('section','region-block');block.append(setRegionTitle(region));
    for(const {section,view} of cards)block.append(renderSection(section,view,region,filters));
    container.append(block);shown++;
  }
  if(!shown)container.append(elt('div','empty-region','No hay hojas de esta región para el tablero o la UAD elegida.'));
  if(response.missing?.length)container.append(elt('p','data-note',`Hojas faltantes: ${response.missing.join(' · ')}`));
  $('connection').textContent=`Conectado · ${response.updatedAt || 'ahora'}`;
}
async function fetchBoard(boardId,filters) {
  return requestAppsScript(CONFIG.appsScriptUrl,{action:'board',board:boardId,filters,idToken:await token()});
}
async function initializeYears() {
  const epoch=state.epoch;
  message('Buscando los años disponibles…');buttonDisabled(true);
  try {
    const result=await requestAppsScript(CONFIG.appsScriptUrl,{action:'years',idToken:await token()});
    if(epoch!==state.epoch || !currentUser())return;
    state.availableYears=result.years.filter(y=>Number.isInteger(y)).sort((a,b)=>a-b);
    if(state.global.years===null)state.global.years=state.availableYears.length?state.availableYears.slice(-1):[];
    else if(state.global.years.length){
      state.global.years=state.global.years.filter(y=>state.availableYears.includes(y));
      if(!state.global.years.length && state.availableYears.length)state.global.years=state.availableYears.slice(-1);
    }
    renderYears();await loadBoard();
  }catch(error){if(epoch===state.epoch)message(error.message,true);}
  finally{if(epoch===state.epoch)buttonDisabled(false);}
}
async function loadBoard() {
  const board=BOARDS.find(b=>b.id===state.board),filters=effective();
  const epoch=++state.epoch;
  $('dashboard').replaceChildren();buttonDisabled(true);message('Consultando los dos libros…');
  try {
    const result=await fetchBoard(board.id,filters);
    if(epoch!==state.epoch || !currentUser())return;
    state.response=result;renderBoard(board,result,filters);message('');
  }catch(error) {
    if(epoch!==state.epoch)return;
    state.response=null;$('connection').textContent='Sin conexión';message(error.message,true);
  }finally {if(epoch===state.epoch)buttonDisabled(false);}
}
async function exportReport(all=false,mode='full') {
  if(!window.jspdf?.jsPDF){message('No cargó jsPDF. Comprueba la conexión y vuelve a intentar.',true);return;}
  buttonDisabled(true);
  try {
    const boards=all?visibleBoards():[BOARDS.find(b=>b.id===state.board)];
    const results=[];
    for(let i=0;i<boards.length;i++) {
      message(`Preparando PDF: tablero ${i+1} de ${boards.length}…`);
      const b=boards[i];
      const filters=effective(b.id);
      const response=!all&&state.response?state.response:await fetchBoard(b.id,filters);
      results.push({board:b,response,filters});
    }
    await createReport(results,{mode});
    message(`PDF ${mode==='summary'?'resumido':all?'completo':'de la pestaña'} generado.`);
  } catch(error) {message('No se pudo descargar el PDF: '+error.message,true);}
  finally {buttonDisabled(false);}
}
function bindAuthForms() {
  $('login-form').addEventListener('submit',async e=>{
    e.preventDefault();authMessage('Ingresando…');
    try {await login($('login-email').value.trim(),$('login-password').value);$('login-password').value='';}
    catch(error){authMessage(error.message,true);}
  });
  $('register-form').addEventListener('submit',async e=>{
    e.preventDefault();
    try {await register($('register-email').value.trim(),$('register-password').value);$('register-password').value='';authMessage('Cuenta creada. Revisa tu correo, confirma la dirección y luego inicia sesión.');}
    catch(error){authMessage(error.message,true);}
  });
  $('reset-password').addEventListener('click',async()=>{
    const email=$('login-email').value.trim();if(!email)return authMessage('Escribe tu correo en el campo de ingreso.',true);
    try{await resetPassword(email);authMessage('Si la cuenta existe, recibirás un correo para restablecer la contraseña.');}catch(error){authMessage(error.message,true);}
  });
  $('logout').addEventListener('click',()=>logout());
}
async function start() {
  setupSelects();bindAuthForms();
  $('refresh').addEventListener('click',initializeYears);
  $('pdf-current').addEventListener('click',()=>exportReport(false));
  $('pdf-summary').addEventListener('click',()=>exportReport(true,'summary'));
  $('pdf-all').addEventListener('click',()=>exportReport(true));
  $('individual-settings').addEventListener('click',selectOverride);
  $('close-dialog').addEventListener('click',()=>{$('override-dialog').close();delete state.draftMonths;delete state.draftYears;});
  $('override-form').addEventListener('submit',e=>{e.preventDefault();saveOverride();});
  $('clear-override').addEventListener('click',()=>{
    delete state.overrides[state.board];delete state.draftMonths;delete state.draftYears;localStorage.setItem(STORE,JSON.stringify(state.overrides));
    $('override-dialog').close();renderNav();loadBoard();
  });
  if(!isConfigured(CONFIG)){$('setup').hidden=false;return;}
  try {
    await initAuth((user,info)=>{
      state.epoch++;state.response=null;$('dashboard').replaceChildren();
      $('login-screen').hidden=!!user;$('workspace').hidden=!user;$('top-actions').hidden=!user;
      if(user){$('signed-user').textContent=user.email;renderNav();initializeYears();}
      else if(info)authMessage(info,true);
    });
  } catch(error){$('login-screen').hidden=false;authMessage(error.message,true);}
}
start();

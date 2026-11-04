import { MONTHS } from './catalog.js';

export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');
}
export function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim() || /^#|^NA$|^N\/A$/i.test(value.trim())) return null;
  let v = value.trim().replace(/[^0-9,.\-]/g,'');
  if (!v || v === '-') return null;
  if (v.includes(',') && v.includes('.')) v = v.lastIndexOf(',') > v.lastIndexOf('.') ? v.replace(/\./g,'').replace(',','.') : v.replace(/,/g,'');
  else if (v.includes(',')) v = /,\d{1,2}$/.test(v) ? v.replace(',','.') : v.replace(/,/g,'');
  else if (/^\-?\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g,'');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export function format(value) {
  if (value === null || value === undefined || value === '' || /^#/.test(String(value))) return 'Sin dato';
  if (typeof value === 'number') return new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(value);
  return String(value);
}
export function percentValue(value) {
  if(typeof value==='string' && value.includes('%'))return numeric(value);
  const n=numeric(value);
  return n===null?null:Math.abs(n)<=1?n*100:n;
}
function statusPercentage(value) {
  if(typeof value!=='number' && !/^\s*\d+(?:[.,]\d+)?\s*$/.test(String(value??'')))return null;
  const n=numeric(value);
  return n!==null && n>=0 && n<=1?n*100:null;
}
export function formatCell(value,header,view) {
  if(!view?.percentColumns?.includes(header))return format(value);
  if(typeof value==='string' && value.includes('%'))return value;
  const n=view.status?statusPercentage(value):percentValue(value);
  return n===null?format(value):`${format(n)} %`;
}
export function monthOf(value) {
  const s = normalize(value);
  const parts=s.split(/[^A-Z]+/);
  return MONTHS.findIndex(m=>parts.includes(m));
}
export function filtersFor(globalFilters, override = {}) {
  return {
    months: override.months?.length ? override.months : globalFilters.months,
    years: Object.hasOwn(override,'years') ? override.years : (globalFilters.years ?? []),
    region: override.region ?? globalFilters.region,
    zone: override.zone ?? globalFilters.zone,
    obligation: override.obligation ?? globalFilters.obligation
  };
}
export function getView(dataset, spec, region, zone='ALL', years=[]) {
  if (!spec || !dataset) return null;
  const isYear=h=>/^(19|20)\d{2}$/.test(String(h).trim());
  const annual=dataset.headers.filter(h=>isYear(h) && (!years.length || years.includes(Number(h)))).sort((a,b)=>Number(a)-Number(b));
  const annualSpec=spec.columns.some(isYear);
  const expand=list=>{
    let inserted=false;
    return list.flatMap(h=>{
      if(!isYear(h))return [h];
      if(inserted)return [];
      inserted=true;
      return annual;
    });
  };
  // Las columnas de cumplimiento del libro no identifican a cuál año pertenecen.
  const sourceColumns=annualSpec && years.length
    ? spec.columns.filter(h=>!normalize(h).startsWith('CUMPLIMIENTO')) : spec.columns;
  const columns=spec.allColumns?dataset.headers.slice():annualSpec?expand(sourceColumns):sourceColumns;
  const selectedSeries=annualSpec?expand(spec.series):spec.series;
  const offset = spec.columnOffset || 0;
  const headers = dataset.headers || [];
  const index = key => headers.findIndex((h,i)=>i >= offset && normalize(h) === normalize(key));
  const idx = spec.allColumns ? columns.map((_,i)=>i) : columns.map(index);
  if (idx.some(i=>i < 0)) return { error:`Faltan columnas en «${spec.sheet}»: ${columns.filter((_,i)=>idx[i]<0).join(', ')}`, headers:[],rows:[] };
  const whereIdx = spec.where ? index(spec.where[0]) : -1;
  const zoneIdx = spec.zone ? index(spec.zone) : -1;
  const rows = (dataset.rows || []).filter(row => {
    if (whereIdx >= 0 && normalize(row[whereIdx]) !== normalize(spec.where[1])) return false;
    if (zone !== 'ALL' && zoneIdx >= 0) {
      const cell = normalize(row[zoneIdx]);
      const all = cell === 'TODAS' || (region === 'amz' && cell === 'AMAZONAS');
      if (!all && cell !== normalize(zone)) return false;
    }
    return idx.some(i=>row[i] !== null && row[i] !== '');
  }).map(row=>idx.map(i=>row[i]));
  const labelIdx = columns.indexOf(spec.label);
  if (labelIdx >= 0 && spec.label.match(/MES/)) {
    rows.sort((a,b)=>monthOf(a[labelIdx])-monthOf(b[labelIdx]));
  }
  const aggregateOnly = zone !== 'ALL' && zoneIdx >= 0 && rows.length>0 && rows.every(row=>{
    const z=normalize(row[columns.indexOf(spec.zone)]);
    return z==='TODAS' || z==='AMAZONAS';
  });
  return { headers:columns,rows,series:selectedSeries,label:spec.label,status:!!spec.status,
    percentColumns:spec.percentColumns||[],chartType:spec.chartType,totalColumn:spec.totalColumn,
    categoryColumn:spec.categoryColumn,secondarySeries:spec.secondarySeries,
    noChart:!!spec.noChart,metric:spec.metric,
    regionalTotal:(zone !== 'ALL' && zoneIdx < 0) || aggregateOnly,
    monthUnfiltered:dataset.monthFilterable===false,
    yearUnavailable:years.length>0 && (dataset.yearFilterable===false || (annualSpec && !annual.length)),
    region, sheet:spec.sheet };
}
export function chartData(view) {
  if (!view || !view.rows?.length) return {labels:[],series:[]};
  const labelIndex = view.headers.indexOf(view.label);
  const zoneIndex = view.headers.indexOf('ZONA');
  const categoryIndex = view.categoryColumn ? view.headers.indexOf(view.categoryColumn) : -1;
  const labels = view.rows.map((r,i)=>{
    const label = labelIndex >= 0 ? format(r[labelIndex]) : `Registro ${i+1}`;
    const zone = zoneIndex >= 0 && zoneIndex !== labelIndex ? ` · ${format(r[zoneIndex])}` : '';
    const category = categoryIndex >= 0 ? ` · ${format(r[categoryIndex])}` : '';
    return label + zone + category;
  });
  const series = (view.series || []).map((name,i)=>{
    const index = view.headers.indexOf(name);
    return {name,color:['#5348e5','#1590b8','#ef9b22','#23a782','#a464ce'][i%5],
      values:view.rows.map(row=>{
        if(view.percentColumns?.includes(name)) {
          const number=view.status?statusPercentage(row[index]):percentValue(row[index]);
          if(number!==null)return number;
        }
        if(!view.status)return numeric(row[index]);
        const val=normalize(row[index]);
        if(!val || val==='NA' || val==='N/A')return null;
        if(val==='NO')return 0;
        return 1; // Se grafica presencia/estado, no la magnitud de un número de radicado.
      })};
  });
  return { labels,series,type:view.chartType,secondarySeries:view.secondarySeries };
}

export function isConfigured(config) {
  return !!(config.appsScriptUrl?.startsWith('https://script.google.com/macros/s/') && config.appsScriptUrl.endsWith('/exec') &&
    ['apiKey','authDomain','projectId','appId'].every(k=>config.firebase?.[k] && !config.firebase[k].includes('PEGA_AQUI')));
}

// El POST en un iframe evita depender de CORS de ContentService de Apps Script.
// El único control real de acceso se ejecuta en Apps Script.
export function requestAppsScript(url, payload, timeoutMs=60000) {
  return new Promise((resolve,reject)=>{
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) return reject(new Error('Configura una URL válida de Apps Script terminada en /exec.'));
    const nonce = crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.name = `jer_response_${nonce}`;
    frame.hidden = true;
    frame.title = 'Respuesta de datos';
    const form = document.createElement('form');
    form.method='POST'; form.action=url; form.target=frame.name; form.hidden=true;
    for (const [name,value] of Object.entries({payload:JSON.stringify(payload),nonce,parentOrigin:location.origin})) {
      const input=document.createElement('input');input.name=name;input.value=value;form.append(input);
    }
    let settled=false;
    const timer=setTimeout(()=>finish(new Error('Apps Script no respondió. Revisa la implementación y el origen permitido.')),timeoutMs);
    function finish(error,result) {
      if (settled) return; settled=true;clearTimeout(timer);
      window.removeEventListener('message',onMessage);form.remove();frame.remove();
      if(error)reject(error);else resolve(result);
    }
    function onMessage(e) {
      const trustedOrigin=/^https:\/\/(?:[a-z0-9-]+\.)*googleusercontent\.com$/.test(e.origin) || e.origin==='https://script.google.com';
      // HtmlService puede envolver su HTML en un iframe interno de googleusercontent.com.
      let trustedWindow=false,current=e.source;
      try {for(let depth=0;depth<4 && current;depth++){if(current===frame.contentWindow){trustedWindow=true;break;}current=current.parent;}} catch (_) {}
      if (!trustedOrigin || !trustedWindow) return;
      if(e.data?.type !== 'jer-dashboard-response' || e.data.nonce !== nonce) return;
      if (!e.data.result?.ok) return finish(new Error(e.data.result?.error || 'No se pudieron obtener datos.'));
      finish(null,e.data.result);
    }
    window.addEventListener('message',onMessage);
    document.body.append(frame,form);
    form.submit();
  });
}

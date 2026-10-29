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
export function monthOf(value) {
  const s = normalize(value);
  return MONTHS.indexOf(s);
}
export function filtersFor(globalFilters, override = {}) {
  return {
    months: override.months?.length ? override.months : globalFilters.months,
    region: override.region ?? globalFilters.region,
    zone: override.zone ?? globalFilters.zone,
    obligation: override.obligation ?? globalFilters.obligation
  };
}
export function getView(dataset, spec, region, zone='ALL') {
  if (!spec || !dataset) return null;
  const offset = spec.columnOffset || 0;
  const headers = dataset.headers || [];
  const index = key => headers.findIndex((h,i)=>i >= offset && normalize(h) === normalize(key));
  const idx = spec.columns.map(index);
  if (idx.some(i=>i < 0)) return { error:`Faltan columnas en «${spec.sheet}»: ${spec.columns.filter((_,i)=>idx[i]<0).join(', ')}`, headers:[],rows:[] };
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
  const labelIdx = spec.columns.indexOf(spec.label);
  if (labelIdx >= 0 && spec.label.match(/MES/)) {
    rows.sort((a,b)=>monthOf(a[labelIdx])-monthOf(b[labelIdx]));
  }
  const aggregateOnly = zone !== 'ALL' && zoneIdx >= 0 && rows.length>0 && rows.every(row=>{
    const z=normalize(row[spec.columns.indexOf(spec.zone)]);
    return z==='TODAS' || z==='AMAZONAS';
  });
  return { headers:spec.columns,rows,series:spec.series,label:spec.label,status:!!spec.status,
    regionalTotal:(zone !== 'ALL' && zoneIdx < 0) || aggregateOnly,
    monthUnfiltered:dataset.monthFilterable===false, region, sheet:spec.sheet };
}
export function chartData(view) {
  if (!view || !view.rows?.length) return {labels:[],series:[]};
  const labelIndex = view.headers.indexOf(view.label);
  const zoneIndex = view.headers.indexOf('ZONA');
  const labels = view.rows.map((r,i)=>{
    const label = labelIndex >= 0 ? format(r[labelIndex]) : `Registro ${i+1}`;
    const zone = zoneIndex >= 0 && zoneIndex !== labelIndex ? ` · ${format(r[zoneIndex])}` : '';
    return label + zone;
  });
  const series = (view.series || []).map((name,i)=>{
    const index = view.headers.indexOf(name);
    return {name,color:['#5348e5','#1590b8','#ef9b22','#23a782','#a464ce'][i%5],
      values:view.rows.map(row=>{
        if(!view.status)return numeric(row[index]);
        const val=normalize(row[index]);
        if(!val || val==='NA' || val==='N/A')return null;
        if(val==='NO')return 0;
        return 1; // Se grafica presencia/estado, no la magnitud de un número de radicado.
      })};
  });
  return { labels,series };
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

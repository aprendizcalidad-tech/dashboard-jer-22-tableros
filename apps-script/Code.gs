/**
 * JER - servicio de datos para GitHub Pages.
 * El servicio se ejecuta como propietario de ambos Sheets, pero no entrega datos
 * hasta comprobar el token Firebase y el correo en AUTHORIZED_EMAILS.
 * Copia TODO este archivo a un proyecto independiente de Apps Script.
 */
const BOARD_SHEETS = {
  1:{boy:['Ventas Chance','Ventas AP','Derechos de explotación','REQUERIMIENTOS','CAPACITACIONES '],amz:['Ventas Chance','Ventas','Derechos de explotación']},
  2:{boy:['Ventas AP','Ventas Chance'],amz:['Ventas','Ventas Chance']},
  3:{boy:['Minimos'],amz:['Minimos']},
  4:{boy:['Carnetizacion'],amz:['Carnetizacion']},
  5:{boy:['Premios dem 20 dias','Premios sup 700'],amz:['Premios dem 20 dias','Premios sup 700']},
  6:{boy:['Premios Caducos Chance','Premios Caducos Raspas'],amz:['Premios Caducos Chance','Premios Caducos Raspas']},
  7:{boy:['Fiscalizacion'],amz:['Fiscalizacion']},
  8:{boy:['Derechos de explotación'],amz:['Derechos de explotación']},
  9:{boy:['Formularios zona'],amz:['Formularios zona']},
  10:{boy:['Formularios Empresa'],amz:[]},
  11:{boy:['RUES','Camaras de comercio','Servidor'],amz:['RUES','Camaras de comercio','Servidor']},
  12:{boy:['Licencias','PARAFISCALES','JUEGO ILEGAL'],amz:['Licencias','JUEGO ILEGAL']},
  13:{boy:['PQR','ALBUM'],amz:['PQR','ALBUM']},
  14:{boy:['SARLAFT'],amz:[]},
  15:{boy:['OFICIOS CONCEDENTES','REQUERIMIENTOS'],amz:[]},
  16:{boy:['MENORES'],amz:['Discapacidad','DIRECTIVOS']},
  17:{boy:['POLIZAS'],amz:['POLIZAS']},
  18:{boy:['AUTORIZACIONES'],amz:['AUTORIZACIONES']},
  19:{boy:['REPORTES CNJSA'],amz:['REPORTES CNJSA']},
  20:{boy:['VERIFICACIÓN IAS'],amz:[]},
  21:{boy:['INFORME SECOP'],amz:[]},
  22:{boy:['CAPACITACIONES ','VENTA POR MODALIDAD'],amz:['VENTA POR MODALIUDAD']}
};
const MONTHS = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const UADS = {boy:['CHIQUINQUIRA','DUITAMA','GARAGOA','MONIQUIRA','PUERTO BOYACA','SOATA','SOGAMOSO','TUNJA'],amz:['LETICIA']};

function doGet() {
  return HtmlService.createHtmlOutput('<h2>Servicio del dashboard JER</h2><p>Los datos requieren una solicitud autenticada.</p>');
}
function doPost(e) {
  const params = e && e.parameter || {};
  const nonce = String(params.nonce || '').replace(/[^A-Za-z0-9-]/g,'').slice(0,100);
  const parentOrigin = String(params.parentOrigin || '');
  let result;
  try {
    if (!nonce || !validOrigin_(parentOrigin) || !allowedOrigin_(parentOrigin)) throw error_('Origen o solicitud no autorizados.');
    const req = JSON.parse(String(params.payload || '{}'));
    if (req.action !== 'board' || !BOARD_SHEETS[Number(req.board)]) throw error_('Tablero no válido.');
    const user = lookupUser_(String(req.idToken || ''));
    if (!user.emailVerified || user.disabled || !authorizedEmail_(user.email)) throw error_('Tu correo no está autorizado o verificado.');
    const filters = validateFilters_(req.filters || {});
    const data = {};
    const missing = [];
    const requestedRegions = filters.region === 'both' ? ['boy','amz'] : [filters.region];
    requestedRegions.forEach(function(region) {
      if (filters.zone !== 'ALL' && UADS[region].indexOf(filters.zone) < 0) return;
      const id = prop_(region === 'boy' ? 'SPREADSHEET_ID_BOYACA' : 'SPREADSHEET_ID_AMAZONAS');
      if (!id) throw error_('Falta configurar el ID del libro de ' + region + '.');
      const book = SpreadsheetApp.openById(id);
      data[region] = {};
      BOARD_SHEETS[Number(req.board)][region].forEach(function(name) {
        const sheet = book.getSheetByName(name);
        if (!sheet) {missing.push(region + ': ' + name);return;}
        data[region][name] = readSheet_(sheet, name, filters);
      });
    });
    result = {ok:true,board:Number(req.board),data:data,missing:missing,filters:filters,
      updatedAt:Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss')};
  } catch (err) {
    result = {ok:false,error:String(err && err.message || err)};
  }
  return response_(nonce,parentOrigin,result);
}
function validateFilters_(raw) {
  const region = ['both','boy','amz'].indexOf(raw.region) >= 0 ? raw.region : 'both';
  const incoming = Array.isArray(raw.months) ? raw.months.map(normalize_) : MONTHS;
  const months = MONTHS.filter(function(x){return incoming.indexOf(x)>=0;});
  if (!months.length) throw error_('Selecciona al menos un mes.');
  const zone = normalize_(raw.zone || 'ALL');
  if (zone !== 'ALL' && UADS.boy.concat(UADS.amz).indexOf(zone) < 0) throw error_('UAD no válida.');
  return {region:region,months:months,zone:zone};
}
function readSheet_(sheet,name,filters) {
  if (!sheet.getLastRow()) return {headers:[],rows:[]};
  const height = Math.min(sheet.getLastRow(),3000);
  const width = Math.min(sheet.getLastColumn(),32);
  const values = sheet.getRange(1,1,height,width).getValues();
  let start = 1;
  let headers;
  if (name === 'POLIZAS') {headers = values[1].map(String);start=2;}
  else if (name === 'REPORTES CNJSA') {
    headers = values[0].map(function(code,i){return i === 0 ? 'MES' : String(code || '').trim() + ' · ' + String((values[1] || [])[i] || '').trim();});
    start=2;
  } else headers = values[0].map(function(v){return String(v == null ? '' : v).trim();});
  const mesIndex = headers.findIndex(function(h){return /^MES(?:\s|$)/.test(normalize_(h));});
  const zoneIndex = headers.findIndex(function(h){return normalize_(h)==='ZONA';});
  const dateIndex = name === 'RUES' ? 0 : -1;
  const rows = values.slice(start).filter(function(row){
    if (!row.some(function(v){return v !== '' && v !== null;})) return false;
    if (mesIndex >= 0 && filters.months.indexOf(normalize_(row[mesIndex])) < 0) return false;
    if (dateIndex >= 0) {
      const date = row[dateIndex] instanceof Date ? row[dateIndex] : new Date(row[dateIndex]);
      if (isNaN(date.getTime()) || filters.months.indexOf(MONTHS[date.getMonth()]) < 0) return false;
    }
    if (filters.zone !== 'ALL' && zoneIndex >= 0) {
      const z = normalize_(row[zoneIndex]);
      if (z !== filters.zone && z !== 'TODAS' && z !== 'AMAZONAS') return false;
    }
    return true;
  }).map(function(row){return row.map(clean_);});
  return {headers:headers,rows:rows,monthFilterable:mesIndex>=0 || dateIndex>=0};
}
function lookupUser_(idToken) {
  if (idToken.length < 100) throw error_('Inicia sesión en Firebase.');
  const key=prop_('FIREBASE_API_KEY'),project=prop_('FIREBASE_PROJECT_ID');
  if (!key || !project) throw error_('Falta configurar Firebase en Apps Script.');
  const url='https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(key);
  const response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:idToken}),muteHttpExceptions:true});
  let body={};try{body=JSON.parse(response.getContentText());}catch(_){}
  if(response.getResponseCode()!==200 || !body.users || body.users.length!==1) throw error_('Sesión inválida o vencida.');
  // Se inspecciona el JWT únicamente DESPUÉS de que Google confirmó el token.
  const parts=idToken.split('.');
  if(parts.length!==3)throw error_('Token inválido.');
  const claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
  if (claims.aud!==project || claims.iss!=='https://securetoken.google.com/'+project ||
      claims.sub!==body.users[0].localId || Number(claims.exp)*1000<Date.now()) throw error_('Token de otro proyecto o vencido.');
  return body.users[0];
}
function authorizedEmail_(email) {
  const list=prop_('AUTHORIZED_EMAILS').split(/[;,\n]/).map(function(x){return x.trim().toLowerCase();}).filter(Boolean);
  return list.indexOf(String(email || '').trim().toLowerCase())>=0;
}
function allowedOrigin_(origin) {
  return prop_('ALLOWED_ORIGINS').split(/[;,\n]/).map(function(x){return x.trim().replace(/\/$/,'');}).indexOf(origin)>=0;
}
function validOrigin_(origin) {
  return /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
}
function response_(nonce,origin,result) {
  const target=validOrigin_(origin) ? origin : 'https://invalid.invalid';
  const json=JSON.stringify({type:'jer-dashboard-response',nonce:nonce,result:result})
    .replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')
    .replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>window.top.postMessage('+json+','+JSON.stringify(target)+');</script>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function clean_(v) {
  if(v instanceof Date) return Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd');
  if(v === '' || v === undefined || /^#(?:DIV\/0!|REF!|VALUE!|N\/A)/.test(String(v))) return null;
  return v;
}
function normalize_(v) {return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');}
function prop_(key) {return String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();}
function error_(text) {return new Error(text);}

/** Ejecutar desde el editor para comprobar IDs y nombres de los libros sin publicar datos. */
function probarConexion() {
  ['SPREADSHEET_ID_BOYACA','SPREADSHEET_ID_AMAZONAS','FIREBASE_API_KEY','FIREBASE_PROJECT_ID','AUTHORIZED_EMAILS','ALLOWED_ORIGINS'].forEach(function(k){
    if(!prop_(k))throw error_('Falta la propiedad '+k);
  });
  ['boy','amz'].forEach(function(region){
    const book=SpreadsheetApp.openById(prop_(region==='boy'?'SPREADSHEET_ID_BOYACA':'SPREADSHEET_ID_AMAZONAS'));
    const expected=[...new Set(Object.keys(BOARD_SHEETS).reduce(function(arr,n){return arr.concat(BOARD_SHEETS[n][region]);},[]))];
    Logger.log('%s: %s. Hojas esperadas: %s. Faltantes: %s',region,book.getName(),expected.length,
      JSON.stringify(expected.filter(function(x){return !book.getSheetByName(x);}))); 
  });
}

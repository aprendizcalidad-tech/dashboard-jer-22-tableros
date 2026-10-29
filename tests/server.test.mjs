import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
const jwt=()=>{
  const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
  const body=Buffer.from(JSON.stringify({aud:'jer-test',iss:'https://securetoken.google.com/jer-test',sub:'uid-1',exp:Date.now()/1000+3600,padding:'x'.repeat(50)})).toString('base64url');
  return `${head}.${body}.signature`;
};
function mockServer({emails='validado@jer.test',origin='https://jer.github.io'}={}) {
  let opens=0;
  const sheets={Minimos:{values:[['CATEGORIA','MES VERIFICADO','MINIMOS CONTRACTUALES','CUMPLIMIENTO','% CUMPLIMIENTO'],['MUNICIPIOS','ENERO',10,9,.9],['PDV','FEBRERO',12,12,1]]}};
  const context={Date,JSON,Error,Set,Array,String,Number,Object,Math,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>({SPREADSHEET_ID_BOYACA:'boy-id',SPREADSHEET_ID_AMAZONAS:'amz-id',FIREBASE_API_KEY:'public-key',FIREBASE_PROJECT_ID:'jer-test',AUTHORIZED_EMAILS:emails,ALLOWED_ORIGINS:origin})[k]})},
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({users:[{localId:'uid-1',email:'validado@jer.test',emailVerified:true,disabled:false}]})})},
    SpreadsheetApp:{openById:()=>{opens++;return{getSheetByName:name=>sheets[name]?{
      getLastRow:()=>sheets[name].values.length,getLastColumn:()=>sheets[name].values[0].length,
      getRange:()=>({getValues:()=>sheets[name].values})}:null};}},
    Utilities:{base64DecodeWebSafe:part=>Buffer.from(part,'base64url'),newBlob:bytes=>({getDataAsString:()=>Buffer.from(bytes).toString()}),formatDate:()=> '2026-10-29 10:00:00'},
    Session:{getScriptTimeZone:()=> 'America/Bogota'},
    HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this;}})}
  };
  vm.createContext(context);vm.runInContext(code,context);
  return {context,opens:()=>opens};
}
function ask(server,token,filters={months:['ENERO'],region:'both',zone:'ALL'}) {
  const e={parameter:{nonce:'nonce-1',parentOrigin:'https://jer.github.io',payload:JSON.stringify({action:'board',board:3,idToken:token,filters})}};
  const html=server.context.doPost(e).html;
  const payload=html.match(/postMessage\((\{.*\}),"https:\/\/jer\.github\.io"\)/);
  assert.ok(payload,'respuesta segura hacia el origen permitido');
  return JSON.parse(payload[1]).result;
}
test('el servidor rechaza correo no autorizado antes de abrir cualquier libro',()=>{
  const server=mockServer({emails:'otra@jer.test'});
  assert.equal(ask(server,jwt()).ok,false);assert.equal(server.opens(),0);
});
test('el servidor rechaza token ausente antes de abrir cualquier libro',()=>{
  const server=mockServer();
  assert.equal(ask(server,'').ok,false);assert.equal(server.opens(),0);
});
test('un usuario autorizado lee ambos libros y solo el mes pedido',()=>{
  const server=mockServer();const result=ask(server,jwt());
  assert.equal(result.ok,true);assert.equal(server.opens(),2);
  assert.equal(result.data.boy.Minimos.rows.length,1);
  assert.equal(result.data.amz.Minimos.rows.length,1);
  assert.equal(result.data.boy.Minimos.rows[0][1],'ENERO');
});
test('UAD de Boyacá no abre el libro Amazonas',()=>{
  const server=mockServer();const result=ask(server,jwt(),{months:['ENERO'],region:'both',zone:'TUNJA'});
  assert.equal(result.ok,true);assert.equal(server.opens(),1);
  assert.equal(result.data.amz,undefined);
});

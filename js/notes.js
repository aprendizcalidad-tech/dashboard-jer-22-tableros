import { CONFIG } from './config.js';
import { requestAppsScript } from './data.js';
import { token } from './auth.js';

let notes=[],uid='',epoch=0,revision=0,placing=false;
const $=id=>document.getElementById(id);
const storageKey=()=>`jer_notes_session_${uid}`;
const status=(message,error=false)=>{const el=$('notes-status');el.textContent=message;el.classList.toggle('error',error);};
function checkpoint(){revision++;try{sessionStorage.setItem(storageKey(),JSON.stringify({dirty:true,notes}));}catch(_){}status('Cambios de esta sesión pendientes de guardar en la cuenta.');}
function anchorFor(note){return [...$('dashboard').querySelectorAll('[data-note-anchor]')].find(el=>
  Number(el.dataset.board)===note.board && el.dataset.region===note.region && el.dataset.noteAnchor===note.target);}
function anchorAt(x,y){return [...$('dashboard').querySelectorAll('[data-note-anchor]')]
  .filter(el=>{const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;})
  .sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];}
function areaAt(anchor,x,y){
  const el=[...anchor.querySelectorAll('[data-note-area]')].find(el=>{const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});
  return {area:el?.dataset.noteArea||'other',subsection:el?.dataset.noteSubsection||''};
}
function position(note,anchor,x,y){
  const rect=anchor.getBoundingClientRect();
  note.board=Number(anchor.dataset.board);note.region=anchor.dataset.region;note.target=anchor.dataset.noteAnchor;
  note.x=(x-rect.left)/Math.max(1,rect.width);note.y=(y-rect.top)/Math.max(1,rect.height);
  Object.assign(note,areaAt(anchor,x,y));
}
function createElement(note,anchor){
  const el=document.createElement('article');el.className='floating-note';el.dataset.noteId=note.id;
  const head=document.createElement('div');head.className='floating-note-head';
  const label=document.createElement('strong');label.textContent='✎ Nota';
  const close=document.createElement('button');close.type='button';close.className='floating-note-close';close.textContent='×';close.title='Quitar nota';close.setAttribute('aria-label','Quitar nota');
  close.addEventListener('click',()=>{notes=notes.filter(n=>n.id!==note.id);el.remove();checkpoint();});
  head.append(label,close);
  const input=document.createElement('textarea');input.maxLength=600;input.rows=5;input.placeholder='Escribe tu observación…';input.value=note.text;
  input.setAttribute('aria-label','Contenido de la nota');input.addEventListener('input',()=>{note.text=input.value;checkpoint();});
  el.append(head,input);anchor.append(el);
  el.style.left=`${note.x*100}%`;el.style.top=`${note.y*100}%`;
  head.addEventListener('pointerdown',event=>{
    if(event.target===close || event.button!==0)return;
    event.preventDefault();head.setPointerCapture(event.pointerId);
    const initial=el.getBoundingClientRect(),dx=event.clientX-initial.left,dy=event.clientY-initial.top;
    const move=e=>{const rect=anchor.getBoundingClientRect();el.style.left=`${e.clientX-dx-rect.left}px`;el.style.top=`${e.clientY-dy-rect.top}px`;};
    const done=e=>{
      head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',done);head.removeEventListener('pointercancel',done);
      el.style.pointerEvents='none';const next=anchorAt(e.clientX,e.clientY)||anchor;el.style.pointerEvents='';
      position(note,next,e.clientX-dx,e.clientY-dy);
      if(next!==anchor)next.append(el);
      el.style.left=`${note.x*100}%`;el.style.top=`${note.y*100}%`;checkpoint();
    };
    head.addEventListener('pointermove',move);head.addEventListener('pointerup',done);head.addEventListener('pointercancel',done);
  });
  return el;
}
export function showNotes(board){
  document.querySelectorAll('.floating-note').forEach(el=>el.remove());
  for(const note of notes.filter(n=>n.board===board)){
    const anchor=anchorFor(note);if(anchor)createElement(note,anchor);
  }
}
export function reportNotes(){return notes.filter(n=>n.text.trim()).map(n=>({...n}));}
export function resetNotes(){epoch++;revision=0;uid='';notes=[];placing=false;status('');$('add-note').classList.remove('active');}
export async function loadNotes(user,board){
  const current=++epoch;uid=user.uid;notes=[];
  $('add-note').disabled=true;$('save-notes').disabled=true;
  let draft=null;try{const saved=JSON.parse(sessionStorage.getItem(storageKey()));draft=saved?.dirty&&Array.isArray(saved.notes)?saved.notes:null;}catch(_){}
  try{
    const result=await requestAppsScript(CONFIG.appsScriptUrl,{action:'notes',idToken:await token()});
    if(current!==epoch)return;
    notes=Array.isArray(draft)?draft:(result.notes||[]);
    status(Array.isArray(draft)?'Notas de esta sesión recuperadas.':'Notas guardadas en tu cuenta cargadas.');
    showNotes(board());
  }catch(error){if(current!==epoch)return;notes=Array.isArray(draft)?draft:[];showNotes(board());status('No se pudieron cargar las notas guardadas: '+error.message,true);}
  finally{if(current===epoch){$('add-note').disabled=false;$('save-notes').disabled=false;}}
}
export function bindNotes(board){
  $('add-note').addEventListener('click',()=>{placing=!placing;$('add-note').classList.toggle('active',placing);
    status(placing?'Haz clic sobre la tabla, gráfica o zona donde quieres colocar la nota.':'');});
  $('dashboard').addEventListener('click',event=>{
    if(!placing || event.target.closest('.floating-note'))return;
    const anchor=anchorAt(event.clientX,event.clientY);if(!anchor)return;
    const note={id:crypto.randomUUID(),board:board(),region:anchor.dataset.region,target:anchor.dataset.noteAnchor,area:'other',x:0,y:0,text:''};
    position(note,anchor,event.clientX,event.clientY);notes.push(note);placing=false;$('add-note').classList.remove('active');
    createElement(note,anchor).querySelector('textarea').focus();checkpoint();
  });
  $('save-notes').addEventListener('click',async()=>{
    const button=$('save-notes');button.disabled=true;status('Guardando notas en tu cuenta…');
    const started=revision,owner=uid,snapshot=reportNotes();
    try{
      const result=await requestAppsScript(CONFIG.appsScriptUrl,{action:'saveNotes',notes:snapshot,idToken:await token()});
      if(owner!==uid)return;
      if(started===revision){notes=result.notes;try{sessionStorage.removeItem(storageKey());}catch(_){}showNotes(board());status('Notas guardadas. Volverán a aparecer al iniciar sesión.');}
      else status('Se guardó la versión anterior. Guarda otra vez para incluir los cambios más recientes.');
    }catch(error){status('No se pudieron guardar las notas: '+error.message,true);}finally{button.disabled=false;}
  });
}

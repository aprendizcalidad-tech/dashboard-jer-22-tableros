import test from 'node:test';
import assert from 'node:assert/strict';
import { createReport } from '../js/pdf.js';
import { BOARDS, MONTHS } from '../js/catalog.js';

test('el informe incluye ambos bloques y pagina filas largas sin descartarlas',async()=>{
  const saved=[];
  class FakePdf {
    constructor(){this.pages=1;this.current=1;this.internal={pageSize:{getWidth:()=>842,getHeight:()=>595}};this.drawn=[];}
    addPage(){this.pages++;this.current=this.pages;}
    deletePage(n){this.pages--;this.current=Math.max(1,this.current-1);}
    getNumberOfPages(){return this.pages;}
    setPage(n){this.current=n;}
    setFont(){}setFontSize(){}setTextColor(){}setFillColor(){}rect(){}
    text(value){this.drawn.push(value);}
    splitTextToSize(value,width){const s=String(value);const max=Math.max(1,Math.floor(width/5));return s.match(new RegExp(`.{1,${max}}`,'g'))||[''];}
    save(filename){saved.push({filename,pages:this.pages,drawn:this.drawn});}
  }
  globalThis.window={jspdf:{jsPDF:FakePdf}};
  const data={headers:['ZONA','MES VERIFICADO','CARNET','PERSONAL','CUMPLIMIENTO'],
    rows:Array.from({length:40},(_,i)=>['TUNJA',MONTHS[i%12],i,100,.5]),monthFilterable:true};
  const response={data:{boy:{Carnetizacion:data},amz:{Carnetizacion:data}}};
  await createReport([{board:BOARDS[3],response,filters:{region:'both',zone:'ALL',months:MONTHS}}]);
  assert.equal(saved.length,1);assert.ok(saved[0].pages>2);
  assert.ok(saved[0].drawn.some(x=>String(x).includes('Boyacá')));
  assert.ok(saved[0].drawn.some(x=>String(x).includes('Amazonas')));
});

import { REGIONS, UADS } from './catalog.js';
import { chartData, format, getView, numeric } from './data.js';

const PALETTE=['#5348e5','#1590b8','#ef9b22','#23a782','#a464ce'];
function pdfText(value) {return String(value??'').replace(/[\u2011\u2013\u2014]/g,'-');}
function color(doc,hex,kind='fill') {
  const rgb=hex.replace('#','').match(/.{2}/g).map(x=>parseInt(x,16));
  if(kind==='text')doc.setTextColor(...rgb);else doc.setFillColor(...rgb);
}
function pageHeader(doc,board,region,filters,continued=false) {
  const width=doc.internal.pageSize.getWidth();
  color(doc,'#111b35');doc.rect(0,0,width,68,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(255,255,255);
  doc.text(`JER  |  ${board.id}. ${pdfText(board.title)}`,38,32);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`${REGIONS[region]}${continued?' · continuación':''}`,38,49);
  color(doc,'#52627b','text');doc.setFontSize(9);
  const monthText=filters.months.length===12?'Todos los meses':filters.months.join(', ');
  const label=`Período: ${monthText}   |   UAD: ${filters.zone==='ALL'?'Todas':filters.zone}`;
  doc.text(doc.splitTextToSize(pdfText(label),width-76),38,83);
  return 105;
}
function drawChart(doc,view,x,y,w,h) {
  const {labels,series}=chartData(view);
  const values=series.flatMap(s=>s.values).filter(v=>v!==null);
  if(!values.length){color(doc,'#738098','text');doc.setFontSize(10);doc.text('Todavía no hay valores para graficar.',x+14,y+35);return;}
  const shown=Math.min(labels.length,14),min=Math.min(0,...values),max=Math.max(1,...values),span=max-min||1;
  const plotTop=y+16,plotBottom=y+h-28,plotH=plotBottom-plotTop;
  color(doc,'#e8ecf3');for(let i=0;i<4;i++)doc.rect(x+35,plotTop+plotH*i/3,w-46,.6,'F');
  const center=x+35+(w-47)/shown/2,group=(w-47)/shown;
  for(let i=0;i<shown;i++) {
    for(let j=0;j<series.length;j++) {
      const v=series[j].values[i];if(v===null)continue;
      const bw=Math.max(2,Math.min(11,(group-5)/series.length));
      const xx=center+i*group-bw*series.length/2+j*bw;
      const yVal=plotBottom-(v-min)/span*plotH,yZero=plotBottom-(0-min)/span*plotH;
      color(doc,PALETTE[j%PALETTE.length]);doc.rect(xx,Math.min(yVal,yZero),bw-1,Math.max(1,Math.abs(yVal-yZero)),'F');
    }
    color(doc,'#66758d','text');doc.setFontSize(6.5);
    const label=pdfText(labels[i]).slice(0,10);doc.text(label,center+i*group,plotBottom+12,{align:'center'});
  }
  color(doc,'#66758d','text');doc.setFontSize(8);
  series.forEach((s,i)=>{const xx=x+i*145;color(doc,PALETTE[i%PALETTE.length]);doc.rect(xx,y+h+1,8,8,'F');color(doc,'#56637a','text');doc.text(pdfText(s.name).slice(0,21),xx+12,y+h+8);});
  if(labels.length>shown){doc.text(`Primeros ${shown} registros graficados. La tabla incluye todos.`,x,y+h+23);}
}
function drawTable(doc,board,region,filters,view,startY) {
  const left=38,right=doc.internal.pageSize.getWidth()-38,pageBottom=doc.internal.pageSize.getHeight()-40;
  const n=view.headers.length,w=(right-left)/n;
  const drawHead=y=>{
    color(doc,'#edf0f8');doc.rect(left,y,right-left,27,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7.3);color(doc,'#31415e','text');
    view.headers.forEach((h,i)=>doc.text(doc.splitTextToSize(pdfText(h),w-11).slice(0,2),left+i*w+5,y+10));
    return y+30;
  };
  let y=drawHead(startY);
  if(!view.rows.length){color(doc,'#77849b','text');doc.text('La hoja existe, pero no hay registros para los filtros elegidos.',left,y+12);return;}
  for(const row of view.rows) {
    const lines=row.map(v=>doc.splitTextToSize(pdfText(format(v)),w-12));
    let offset=0,remaining=Math.max(1,...lines.map(x=>x.length));
    while(remaining>0) {
      let fits=Math.floor((pageBottom-y-8)/9.5);
      if(fits<2){doc.addPage();y=pageHeader(doc,board,region,filters,true);y=drawHead(y);fits=Math.floor((pageBottom-y-8)/9.5);}
      const count=Math.max(1,Math.min(remaining,fits)),height=count*9.5+8;
      if(offset%2===0){color(doc,'#f8f9fc');doc.rect(left,y,right-left,height,'F');}
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);color(doc,'#26334a','text');
      lines.forEach((ls,i)=>{
        const chunk=ls.slice(offset,offset+count);
        chunk.forEach((line,j)=>doc.text(pdfText(line),left+i*w+5,y+11+j*9.5));
      });
      y+=height;offset+=count;remaining-=count;
    }
  }
}
function addSection(doc,board,region,filters,section,view) {
  doc.addPage();let y=pageHeader(doc,board,region,filters);
  color(doc,'#26334a','text');doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(pdfText(section.title),38,y);y+=17;
  doc.setFont('helvetica','normal');doc.setFontSize(8);color(doc,'#8290a3','text');doc.text(`Fuente: ${pdfText(view.sheet)}`,38,y);y+=10;
  if(view.error){doc.text(pdfText(view.error),38,y+20);return;}
  drawChart(doc,view,38,y,doc.internal.pageSize.getWidth()-76,155);y+=186;
  if(view.regionalTotal){color(doc,'#66758d','text');doc.text('La fuente no desglosa esta cifra por UAD: se muestra el total regional.',38,y);y+=15;}
  if(view.monthUnfiltered && filters.months.length<12){color(doc,'#66758d','text');doc.text('La fuente no tiene mes: el filtro de meses no aplica.',38,y);y+=15;}
  if(section.note){doc.text(doc.splitTextToSize(pdfText(section.note),doc.internal.pageSize.getWidth()-76),38,y);y+=17;}
  drawTable(doc,board,region,filters,view,y);
}
function addOverview(doc,board,region,filters,response) {
  const sources=response.data?.[region]||{};
  const main=[['Ventas Chance','Ventas Chance'],['Ventas apuestas permanentes',region==='boy'?'Ventas AP':'Ventas']];
  for(const [title,sheet] of main) {
    if(!sources[sheet])continue;
    const view=getView(sources[sheet],{sheet,columns:['MES','2025','2026'],label:'MES',series:['2025','2026']},region,filters.zone);
    addSection(doc,board,region,filters,{title},view);
  }
  doc.addPage();let y=pageHeader(doc,board,region,filters);
  color(doc,'#26334a','text');doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Indicadores del resumen',38,y);y+=30;
  const chance=sources['Ventas Chance'];
  const view=chance?getView(chance,{sheet:'Ventas Chance',columns:['MES','2025','2026'],label:'MES',series:['2025','2026']},region,filters.zone):null;
  const pairs=view?.rows.map(r=>[numeric(r[1]),numeric(r[2])]).filter(x=>x[0]!==null&&x[1]!==null&&x[0]!==0)||[];
  const base=pairs.reduce((v,x)=>v+x[0],0),actual=pairs.reduce((v,x)=>v+x[1],0);
  const rights=sources['Derechos de explotación'];
  const rv=rights?getView(rights,{sheet:'Derechos de explotación',columns:['MES','EFECTIVIDAD'],label:'MES',series:['EFECTIVIDAD']},region,filters.zone):null;
  const last=rv?.rows.filter(r=>r[1]!==null).at(-1);
  const facts=[['Cumplimiento Chance del período',base?`${(actual/base*100).toFixed(1)} %`:'Sin dato'],
    ['Efectividad derechos de explotación',last?`${format(last[1])} (${last[0]})`:'Sin dato']];
  if(region==='boy')facts.push(['Requerimientos · respuestas %','Sin fórmula definida'],['Capacitación %','Sin meta definida']);
  facts.forEach(([label,value])=>{doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(pdfText(label),38,y);doc.setFont('helvetica','normal');doc.text(pdfText(value),400,y);y+=28;});
}
export async function createReport(entries) {
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4',compress:true});
  let pages=0;
  for(const {board,response,filters} of entries) {
    for(const region of (filters.region==='both'?['boy','amz']:[filters.region])) {
      if(filters.zone!=='ALL' && !UADS[region].includes(filters.zone))continue;
      if(!response.data?.[region])continue;
      if(board.kind==='overview'){addOverview(doc,board,region,filters,response);pages++;continue;}
      for(const section of board.sections) {
        const spec=section[region];if(!spec)continue;
        const view=getView(response.data[region][spec.sheet],spec,region,filters.zone);
        if(!view)continue;
        addSection(doc,board,region,filters,section,view);pages++;
      }
    }
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(!pages)throw new Error('No hay información para incluir en el informe.');
  doc.deletePage(1); // La primera hoja automática de jsPDF está vacía.
  const count=doc.getNumberOfPages();
  for(let i=1;i<=count;i++){
    doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);color(doc,'#748198','text');
    doc.text(`${i} / ${count}`,doc.internal.pageSize.getWidth()-38,doc.internal.pageSize.getHeight()-18,{align:'right'});
  }
  doc.save(`Informe_JER_${entries.length===1?'tablero_'+entries[0].board.id:'22_tableros'}.pdf`);
}

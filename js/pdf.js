import { REGIONS, UADS } from './catalog.js';
import { chartData, format, formatCell, getView, numeric } from './data.js';
import { salesIndicators, sectionMetric } from './metrics.js';

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
  const years=filters.years?.length?filters.years.join(', '):'Todos';
  const label=`Años: ${years}   |   Período: ${monthText}   |   UAD: ${filters.zone==='ALL'?'Todas':filters.zone}`;
  doc.text(doc.splitTextToSize(pdfText(label),width-76),38,83);
  return 105;
}
function drawStackedChart(doc,view,x,y,w) {
  const {labels,series}=chartData(view),totalIndex=view.headers.indexOf(view.totalColumn);
  const shown=Math.min(labels.length,5),group=w/shown,barWidth=38;
  const sums=view.rows.slice(0,shown).map(row=>series.reduce((sum,s)=>sum+Math.max(0,numeric(row[view.headers.indexOf(s.name)])||0),0));
  const max=Math.max(1,...sums),plotTop=y+55,plotBottom=y+160;
  color(doc,'#e8ecf3');for(let k=0;k<4;k++)doc.rect(x,plotBottom-(plotBottom-plotTop)*k/3,w,.6,'F');
  view.rows.slice(0,shown).forEach((row,i)=>{
    const center=x+(i+.5)*group;let bottom=plotBottom;
    series.forEach((s,j)=>{
      const amount=Math.max(0,numeric(row[view.headers.indexOf(s.name)])||0);
      const height=amount/max*(plotBottom-plotTop);
      if(height){color(doc,PALETTE[j%PALETTE.length]);doc.rect(center-barWidth/2,bottom-height,barWidth,height,'F');bottom-=height;}
    });
    doc.setFont('helvetica','bold');doc.setFontSize(9);color(doc,'#26334a','text');
    doc.text(doc.splitTextToSize(pdfText(format(row[totalIndex])),group-8),center,y+17,{align:'center'});
    doc.setFontSize(8);doc.text(pdfText(labels[i]),center,plotBottom+15,{align:'center'});
    series.forEach((s,j)=>{
      color(doc,PALETTE[j%PALETTE.length]);doc.rect(center-group/2+4,plotBottom+32+j*31,7,7,'F');
      color(doc,'#26334a','text');doc.setFontSize(7);
      doc.text(pdfText(s.name),center-group/2+14,plotBottom+39+j*31);
      doc.setFont('helvetica','bold');doc.setFontSize(8);
      doc.text(doc.splitTextToSize(pdfText(format(row[view.headers.indexOf(s.name)])),group-12),center,plotBottom+52+j*31,{align:'center'});
    });
  });
  if(labels.length>shown){color(doc,'#65738b','text');doc.setFontSize(8);doc.text(`Primeros ${shown} registros graficados; la tabla contiene todos.`,x,plotBottom+106);}
  return 274;
}
function drawChart(doc,view,x,y,w,h) {
  if(view.chartType==='stacked')return drawStackedChart(doc,view,x,y,w);
  const {labels,series}=chartData(view);
  const values=series.flatMap(s=>s.values).filter(v=>v!==null);
  if(!values.length){color(doc,'#738098','text');doc.setFontSize(10);doc.text('Todavía no hay valores para graficar.',x+14,y+35);return h;}
  // Menos grupos por página dan un espacio propio y legible a cada valor.
  const maxBars=Math.max(2,Math.floor((w-47)/(series.length*58)));
  const shown=Math.min(labels.length,14,maxBars);
  const group=(w-47)/shown,slot=group/series.length;
  const entries=[];let maxLines=1;
  doc.setFont('helvetica','bold');doc.setFontSize(8);
  for(let i=0;i<shown;i++)for(let j=0;j<series.length;j++){
    if(series[j].values[i]===null)continue;
    const raw=view.rows[i][view.headers.indexOf(series[j].name)];
    const modality=view.categoryColumn?format(view.rows[i][view.headers.indexOf(view.categoryColumn)]):null;
    const lines=[...(modality?doc.splitTextToSize(pdfText(modality),slot-14):[]),...doc.splitTextToSize(pdfText(formatCell(raw,series[j].name,view)),slot-14)];
    maxLines=Math.max(maxLines,lines.length);
    entries.push({i,j,lines});
  }
  const chartHeight=176+maxLines*10;
  const plotTop=y+20,plotBottom=y+125,plotH=plotBottom-plotTop;
  color(doc,'#e8ecf3');for(let i=0;i<4;i++)doc.rect(x+35,plotTop+plotH*i/3,w-46,.6,'F');
  const mainValues=series.filter(s=>s.name!==view.secondarySeries).flatMap(s=>s.values).filter(v=>v!==null);
  const mainMin=Math.min(0,...mainValues),mainMax=Math.max(1,...mainValues),mainSpan=mainMax-mainMin||1;
  const secondaryMax=view.secondarySeries?Math.max(100,...series.filter(s=>s.name===view.secondarySeries).flatMap(s=>s.values).filter(v=>v!==null)):null;
  if(secondaryMax!==null){color(doc,'#1590b8','text');doc.setFontSize(8);doc.text('Participación (%): escala derecha',x+w-180,y+11);}
  for(let i=0;i<shown;i++) {
    for(let j=0;j<series.length;j++) {
      const v=series[j].values[i];if(v===null)continue;
      const bw=Math.max(3,Math.min(20,slot*.42));
      const barCenter=x+35+i*group+(j+.5)*slot,xx=barCenter-bw/2;
      const yVal=series[j].name===view.secondarySeries?plotBottom-v/secondaryMax*plotH:plotBottom-(v-mainMin)/mainSpan*plotH;
      const yZero=series[j].name===view.secondarySeries?plotBottom:plotBottom-(0-mainMin)/mainSpan*plotH;
      color(doc,PALETTE[j%PALETTE.length]);doc.rect(xx,Math.min(yVal,yZero),bw,Math.max(1,Math.abs(yVal-yZero)),'F');
    }
  }
  // Cada barra tiene una columna de valor completa, debajo del área de barras.
  entries.forEach(({i,j,lines})=>{
    const center=x+35+i*group+(j+.5)*slot;
    color(doc,'#ffffff');doc.rect(center-slot/2+3,y+136,slot-6,lines.length*10+10,'F');
    color(doc,'#26334a','text');doc.setFont('helvetica','bold');doc.setFontSize(8);
    lines.forEach((line,k)=>doc.text(line,center,y+149+k*10,{align:'center'}));
  });
  color(doc,'#66758d','text');doc.setFont('helvetica','normal');doc.setFontSize(7);
  for(let i=0;i<shown;i++){
    const axis=view.categoryColumn?format(view.rows[i][view.headers.indexOf(view.label)]):labels[i];
    doc.text(doc.splitTextToSize(pdfText(axis),group-8),x+35+(i+.5)*group,y+161+maxLines*10,{align:'center'});
  }
  color(doc,'#66758d','text');doc.setFontSize(8);
  series.forEach((s,i)=>{const xx=x+i*145;color(doc,PALETTE[i%PALETTE.length]);doc.rect(xx,y+chartHeight+1,8,8,'F');color(doc,'#56637a','text');doc.text(pdfText(s.name).slice(0,21),xx+12,y+chartHeight+8);});
  if(labels.length>shown){doc.text(`Primeros ${shown} registros graficados. La tabla incluye todos.`,x,y+chartHeight+23);}
  return chartHeight;
}
function drawTable(doc,board,region,filters,view,startY) {
  if(view.headers.length>8){
    const fixed=view.headers[0],step=6;
    for(let start=1;start<view.headers.length;start+=step){
      if(start>1){doc.addPage();startY=pageHeader(doc,board,region,filters,true);}
      const indices=[0,...Array.from({length:Math.min(step,view.headers.length-start)},(_,i)=>start+i)];
      const part={...view,headers:indices.map(i=>view.headers[i]),rows:view.rows.map(row=>indices.map(i=>row[i]))};
      doc.setFont('helvetica','normal');doc.setFontSize(8);color(doc,'#66758d','text');
      doc.text(`${pdfText(fixed)} y columnas ${start+1}-${Math.min(view.headers.length,start+step)} de ${view.headers.length}`,38,startY);
      drawTable(doc,board,region,filters,part,startY+14);
    }
    return;
  }
  const left=38,right=doc.internal.pageSize.getWidth()-38,pageBottom=doc.internal.pageSize.getHeight()-40;
  const n=view.headers.length,w=(right-left)/n;
  const drawHead=y=>{
    const headings=view.headers.map(h=>doc.splitTextToSize(pdfText(h),w-11));
    const headHeight=Math.max(27,Math.max(1,...headings.map(lines=>lines.length))*8+12);
    color(doc,'#edf0f8');doc.rect(left,y,right-left,headHeight,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7.3);color(doc,'#31415e','text');
    headings.forEach((lines,i)=>doc.text(lines,left+i*w+5,y+10));
    return y+headHeight+3;
  };
  let y=drawHead(startY);
  if(!view.rows.length){color(doc,'#77849b','text');doc.text('La hoja existe, pero no hay registros para los filtros elegidos.',left,y+12);return;}
  for(const row of view.rows) {
    const lines=row.map((v,i)=>doc.splitTextToSize(pdfText(formatCell(v,view.headers[i],view)),w-12));
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
  color(doc,'#26334a','text');doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(pdfText(region==='amz'&&section.amzTitle?section.amzTitle:section.title),38,y);y+=17;
  doc.setFont('helvetica','normal');doc.setFontSize(8);color(doc,'#8290a3','text');doc.text(`Fuente: ${pdfText(view.sheet)}`,38,y);y+=10;
  if(view.error){doc.text(pdfText(view.error),38,y+20);return;}
  if(!view.noChart){const chartHeight=drawChart(doc,view,38,y,doc.internal.pageSize.getWidth()-76,155);y+=chartHeight+31;}
  const metric=sectionMetric(view);
  if(metric){doc.setFont('helvetica','bold');doc.setFontSize(10);color(doc,'#26334a','text');doc.text(`${pdfText(metric.title)}: ${pdfText(metric.value)}`,38,y);y+=18;}
  if(view.regionalTotal){color(doc,'#66758d','text');doc.text('La fuente no desglosa esta cifra por UAD: se muestra el total regional.',38,y);y+=15;}
  if(view.yearUnavailable){color(doc,'#66758d','text');doc.text('La fuente no identifica el año seleccionado; no se atribuyen sus datos a ese año.',38,y);y+=15;}
  if(view.monthUnfiltered && filters.months.length<12){color(doc,'#66758d','text');doc.text('La fuente no tiene mes: el filtro de meses no aplica.',38,y);y+=15;}
  if(section.note){doc.text(doc.splitTextToSize(pdfText(section.note),doc.internal.pageSize.getWidth()-76),38,y);y+=17;}
  drawTable(doc,board,region,filters,view,y);
}
function addOverview(doc,board,region,filters,response) {
  const sources=response.data?.[region]||{};
  const main=[['Ventas Chance','Ventas Chance'],[region==='boy'?'Ventas apuestas permanentes':'Ventas Amazonas',region==='boy'?'Ventas AP':'Ventas']];
  for(const [title,sheet] of main) {
    if(!sources[sheet])continue;
    const view=getView(sources[sheet],{sheet,columns:['MES','2025','2026'],label:'MES',series:['2025','2026']},region,filters.zone,filters.years);
    addSection(doc,board,region,filters,{title},view);
  }
  doc.addPage();let y=pageHeader(doc,board,region,filters);
  color(doc,'#26334a','text');doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Indicadores del resumen',38,y);y+=30;
  const chance=sources['Ventas Chance'];
  const view=chance?getView(chance,{sheet:'Ventas Chance',columns:['MES','2025','2026'],label:'MES',series:['2025','2026']},region,filters.zone,filters.years):null;
  const selected=view?.series.filter(x=>/^\d{4}$/.test(x)).sort((a,b)=>Number(a)-Number(b))||[];
  const prior=selected.at(-2),latest=selected.at(-1);
  const priorIdx=view?.headers.indexOf(prior),latestIdx=view?.headers.indexOf(latest);
  const pairs=prior&&latest?view.rows.map(r=>[numeric(r[priorIdx]),numeric(r[latestIdx])]).filter(x=>x[0]!==null&&x[1]!==null&&x[0]!==0):[];
  const base=pairs.reduce((v,x)=>v+x[0],0),actual=pairs.reduce((v,x)=>v+x[1],0);
  const rights=sources['Derechos de explotación'];
  const rv=rights?getView(rights,{sheet:'Derechos de explotación',columns:['MES','EFECTIVIDAD'],label:'MES',series:['EFECTIVIDAD']},region,filters.zone,filters.years):null;
  const last=rv?.rows.filter(r=>r[1]!==null).at(-1);
  const facts=[['Cumplimiento Chance del período',base?`${(actual/base*100).toFixed(1)} %`:'Sin comparativo'],
    ['Efectividad derechos de explotación',last?`${format(last[1])} (${last[0]})`:'Sin dato']];
  salesIndicators(sources,region,filters).forEach(({year,total,compliance})=>facts.push([`Ventas ${year}: ${total}`,`Cumplimiento ${year}: ${compliance}`]));
  if(region==='boy')facts.push(['Requerimientos · respuestas %','Sin fórmula definida'],['Capacitación %','Sin meta definida']);
  facts.forEach(([label,value])=>{doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(pdfText(label),38,y);doc.setFont('helvetica','normal');doc.text(pdfText(value),400,y);y+=28;});
}
function sectionSummary(view) {
  const labelIndex=view.headers.indexOf(view.label);
  const period=row=>labelIndex<0?'último registro':format(row[labelIndex]);
  const metric=sectionMetric(view);
  const result=[];
  if(view.chartType==='stacked' && view.totalColumn){
    const amount=name=>{
      const index=view.headers.indexOf(name);
      const values=view.rows.map(row=>numeric(row[index])).filter(value=>value!==null);
      return values.length?format(values.reduce((sum,value)=>sum+value,0)):null;
    };
    const total=amount(view.totalColumn);
    if(total)result.push(`En ${view.rows.length} registros, los premios caducos sumaron ${total}. ${view.series.map(name=>`${name}: ${amount(name)??'sin dato'}`).join('; ')}.`);
    return result;
  }
  if(metric)result.push(`${metric.title}: ${metric.value}.`);
  if(view.categoryColumn){
    const last=view.rows.at(-1),latest=view.rows.filter(row=>row[labelIndex]===last[labelIndex]);
    const categoryIndex=view.headers.indexOf(view.categoryColumn);
    const names=view.series.filter(name=>name!=='VENTA TOTAL');
    const totalIndex=view.headers.indexOf('VENTA TOTAL');
    if(totalIndex>=0)result.push(`En ${period(last)}, la venta total registrada fue ${format(last[totalIndex])}.`);
    latest.forEach(row=>result.push(`${format(row[categoryIndex])}: ${names.map(name=>`${name} ${formatCell(row[view.headers.indexOf(name)],name,view)}`).join('; ')}.`));
    return result;
  }
  if(view.noChart || !view.series.length){
    const last=view.rows.at(-1);
    const fields=view.headers.map((name,index)=>({name,value:last[index]}))
      .filter(({name,value},index)=>index!==labelIndex && value!==null && value!==undefined && value!=='').slice(0,2);
    result.push(`${view.rows.length} registros consultados. Último: ${period(last)}${fields.length?`; ${fields.map(({name,value})=>`${name}: ${format(value)}`).join('; ')}`:''}.`);
    return result;
  }
  for(const name of view.series){
    const index=view.headers.indexOf(name);
    if(index<0)continue;
    const valid=view.rows.filter(row=>row[index]!==null && row[index]!==undefined && row[index]!=='');
    if(!valid.length)continue;
    const last=valid.at(-1);
    if(view.status){
      result.push(`${name}: información en ${valid.length} de ${view.rows.length} registros; último dato en ${period(last)} (${formatCell(last[index],name,view)}).`);
      continue;
    }
    const flow=/^(?:202\d|PREMIOS PAGADOS|PREMIOS MAYORES|VALOR PREMIOS|DEMORADOS|PQR$|CAPACITACIONES$|INDUCCIONES$|REALIZADAS POR LA COORDINACIÓN|COMPRA$|CONSUMO |VERIFICACIONES$|# VISITAS$)/i.test(name);
    const values=valid.map(row=>numeric(row[index])).filter(value=>value!==null);
    const total=flow && values.length?`Total del período: ${format(values.reduce((sum,value)=>sum+value,0))}. `:'';
    result.push(`${name}: ${total}Último valor ${formatCell(last[index],name,view)} en ${period(last)}.`);
  }
  if(!result.length)result.push(`${view.rows.length} registros disponibles, sin cifras numéricas en las columnas de la gráfica.`);
  return result;
}
function compactReport(doc,entries) {
  const bottom=doc.internal.pageSize.getHeight()-42,width=doc.internal.pageSize.getWidth()-76;
  let y=0,pages=0;
  const newPage=()=>{
    doc.addPage();pages++;y=113;
    const pageWidth=doc.internal.pageSize.getWidth();
    color(doc,'#111b35');doc.rect(0,0,pageWidth,89,'F');
    color(doc,'#6259e8');doc.rect(0,89,pageWidth,5,'F');doc.rect(38,25,40,40,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(255,255,255);
    doc.text('JER',47,50);
    doc.setFontSize(17);doc.text('Informe de gestión · Resumen',91,43);
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Indicadores y cifras principales de los filtros consultados',91,62);
    doc.text(`${entries.length} tableros seleccionados`,pageWidth-38,61,{align:'right'});
  };
  const line=(value,{bold=false,size=9,indent=0,space=4,variant='detail'}={})=>{
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
    const box=variant==='board'||variant==='filter'||variant==='metric'||variant==='section'||variant==='empty';
    const padding=box?variant==='board'?11:8:0;
    const text=doc.splitTextToSize(pdfText(value),width-indent-(box?26:0));
    const height=Math.max(1,text.length)*(size+3)+space+padding;
    if(!pages || y+height>bottom)newPage();
    if(box){
      const fill={board:'#eae9fc',filter:'#f3f5fa',metric:'#edf7fc',section:'#f3f2fc',empty:'#fff5e7'}[variant];
      const accent={board:'#5348e5',filter:'#9ba8bb',metric:'#1590b8',section:'#a8a1ef',empty:'#e9a236'}[variant];
      color(doc,fill);doc.rect(38+indent,y-4,width-indent,height-3,'F');
      color(doc,accent);doc.rect(38+indent,y-4,4,height-3,'F');
    }
    color(doc,variant==='empty'?'#875827':variant==='filter'?'#64718a':'#26334a','text');
    doc.setFont('helvetica',bold||variant==='board'||variant==='section'||variant==='metric'?'bold':'normal');doc.setFontSize(size);
    doc.text(text,38+indent+(box?14:0),y+(box?size+1:0));y+=height+3;
  };
  let omitted=0,yearless=0,issues=0,reported=0;
  for(const {board,response,filters} of entries){
    for(const region of (filters.region==='both'?['boy','amz']:[filters.region])){
      if(filters.zone!=='ALL' && !UADS[region].includes(filters.zone))continue;
      const book=response.data?.[region];if(!book){issues++;continue;}
      const sections=[];
      if(board.kind==='overview'){
        const indicators=salesIndicators(book,region,filters);
        const salesSheet=region==='boy'?'Ventas AP':'Ventas';
        const sales=book[salesSheet];
        const salesView=sales?getView(sales,{sheet:salesSheet,columns:['MES','2025','2026'],label:'MES',series:['2025','2026']},region,filters.zone,filters.years):null;
        indicators.forEach(({year,total,compliance})=>{
          const index=salesView?.headers.indexOf(year)??-1;
          if(index<0 || !salesView.rows.some(row=>numeric(row[index])!==null))return;
          sections.push({title:`Ventas ${year}`,facts:[`Total del período: ${total}. ${compliance==='Sin comparativo'?'No hay un año anterior comparable.':`Cumplimiento frente al año anterior: ${compliance}.`}`]});
        });
        const chance=book['Ventas Chance'];
        if(chance){
          const cv=getView(chance,{sheet:'Ventas Chance',columns:['MES','2025','2026'],label:'MES',series:['2025','2026']},region,filters.zone,filters.years);
          if(cv?.rows.length && !cv.yearUnavailable)sections.push({title:'Ventas Chance',facts:sectionSummary(cv)});
        }
        const rights=book['Derechos de explotación'];
        if(rights){
          const rv=getView(rights,{sheet:'Derechos de explotación',columns:['MES','EFECTIVIDAD'],label:'MES',series:['EFECTIVIDAD']},region,filters.zone,filters.years);
          if(rv?.rows.length && !rv.yearUnavailable)sections.push({title:'Derechos de explotación',facts:sectionSummary(rv)});
        }
        if(!sections.length)omitted++;
      } else for(const section of board.sections){
        const spec=section[region];if(!spec)continue;
        const title=region==='amz'&&section.amzTitle?section.amzTitle:section.title;
        const view=getView(book[spec.sheet],spec,region,filters.zone,filters.years);
        if(!view || view.error){issues++;continue;}
        if(view.yearUnavailable){yearless++;continue;}
        if(!view.rows.length){omitted++;continue;}
        sections.push({title,facts:sectionSummary(view)});
      }
      if(!sections.length)continue;
      line(`${board.id}. ${board.title} · ${REGIONS[region]}`,{variant:'board',size:12,space:7});
      line(`Años: ${filters.years?.length?filters.years.join(', '):'Todos'} · Meses: ${filters.months?.length===12?'Todos':filters.months?.join(', ')||'Todos'} · UAD: ${filters.zone==='ALL'?'Todas':filters.zone}`,{variant:'filter',size:8,space:7});
      sections.forEach(({title,facts})=>{
        reported++;
        line(title,{variant:'section',size:9,indent:12});
        facts.forEach(fact=>line(fact,{indent:22,size:8}));
      });
      y+=7;
    }
  }
  if(!reported)line('No hay cifras verificables para los filtros elegidos. Prueba otro año o período.',{variant:'metric',size:10});
  if(omitted || yearless || issues){
    line('Alcance de los datos',{variant:'board',size:11});
    if(omitted)line(`${omitted} secciones sin registros en los filtros elegidos; se omitieron para mantener breve el informe.`,{size:8,indent:12});
    if(yearless)line(`${yearless} secciones no identifican el año en el origen y no se atribuyeron al año seleccionado.`,{size:8,indent:12});
    if(issues)line(`${issues} secciones no pudieron leerse o no tienen fuente disponible; revisa el origen de datos.`,{size:8,indent:12});
  }
  return pages;
}
function addMissingSummary(doc,notes,available,entries) {
  const first=entries[0];doc.addPage();
  let y=pageHeader(doc,first.board,first.filters.region==='amz'?'amz':'boy',first.filters);
  doc.setFont('helvetica','bold');doc.setFontSize(15);color(doc,'#26334a','text');doc.text('Estado de los datos consultados',38,y);y+=24;
  const bottom=doc.internal.pageSize.getHeight()-40;
  for(const [title,items] of [['Información disponible',available],['Sin registros para los filtros',notes]]){
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(title,38,y);y+=17;
    for(const item of items){
      doc.setFont('helvetica','normal');doc.setFontSize(8);
      const lines=doc.splitTextToSize(pdfText(item),doc.internal.pageSize.getWidth()-76);
      if(y+lines.length*11>bottom){doc.addPage();y=pageHeader(doc,first.board,first.filters.region==='amz'?'amz':'boy',first.filters,true);}
      doc.text(lines,38,y);y+=lines.length*11+3;
    }
    y+=8;
  }
}
export async function createReport(entries,{mode='full'}={}) {
  if(!entries.length)throw new Error('No hay tableros para incluir en el informe.');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4',compress:true});
  let pages=0;
  const missing=[],available=[];
  if(mode==='summary')pages=compactReport(doc,entries);
  else{
  for(const {board,response,filters} of entries) {
    for(const region of (filters.region==='both'?['boy','amz']:[filters.region])) {
      if(filters.zone!=='ALL' && !UADS[region].includes(filters.zone))continue;
      if(!response.data?.[region]){missing.push(`${board.title} · ${REGIONS[region]}: fuente no disponible.`);continue;}
      if(board.kind==='overview'){addOverview(doc,board,region,filters,response);pages++;continue;}
      for(const section of board.sections) {
        const spec=section[region];if(!spec)continue;
        const view=getView(response.data[region][spec.sheet],spec,region,filters.zone,filters.years);
        if(!view || view.error || !view.rows.length){missing.push(`${board.title} · ${REGIONS[region]} · ${section.title}: ${view?.error||'sin registros para los filtros elegidos'}.`);continue;}
        available.push(`${board.title} · ${REGIONS[region]} · ${section.title}: ${view.rows.length} registros.`);
        addSection(doc,board,region,filters,section,view);pages++;
      }
    }
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(missing.length){addMissingSummary(doc,missing,available,entries);pages++;}
  }
  if(!pages)throw new Error('No hay información para incluir en el informe.');
  doc.deletePage(1); // La primera hoja automática de jsPDF está vacía.
  const count=doc.getNumberOfPages();
  for(let i=1;i<=count;i++){
    doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);color(doc,'#748198','text');
    doc.text(`${i} / ${count}`,doc.internal.pageSize.getWidth()-38,doc.internal.pageSize.getHeight()-18,{align:'right'});
  }
  doc.save(`Informe_JER_${mode==='summary'?'resumido_':''}${entries.length===1?'tablero_'+entries[0].board.id:'22_tableros'}.pdf`);
}

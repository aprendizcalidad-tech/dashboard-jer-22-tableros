import { chartData, format, formatCell, numeric } from './data.js';

const NS='http://www.w3.org/2000/svg';
function el(tag,attrs={},value) {
  const node=document.createElementNS(NS,tag);
  for (const [k,v] of Object.entries(attrs)) node.setAttribute(k,String(v));
  if(value !== undefined) node.textContent=value;
  return node;
}
function labelLines(value) {
  const chars=Array.from(value),lines=[];
  for(let i=0;i<chars.length;i+=24)lines.push(chars.slice(i,i+24).join(''));
  return lines.length?lines:[''];
}
function renderStackedChart(view) {
  const {labels,series}=chartData(view);
  const wrap=document.createElement('div');wrap.className='chart-scroll';
  const totalIndex=view.headers.indexOf(view.totalColumn);
  const usable=view.rows.some(row=>series.some(s=>numeric(row[view.headers.indexOf(s.name)])!==null));
  if(!usable){wrap.classList.add('empty-chart');wrap.textContent='Todavía no hay valores para graficar.';return wrap;}
  const left=72,slot=230,top=65,bottom=245,width=Math.max(560,left+labels.length*slot+30),height=430;
  const max=Math.max(1,...view.rows.map(row=>series.reduce((sum,s)=>sum+Math.max(0,numeric(row[view.headers.indexOf(s.name)])||0),0)));
  const svg=el('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':'Premios caducos: una barra por período, dividida entre ADRES y Lotería de Boyacá'});
  svg.style.height=`${height}px`;
  for(let t=0;t<=4;t++){
    const yy=bottom-(bottom-top)*t/4;
    svg.append(el('line',{x1:left-8,y1:yy,x2:width-15,y2:yy,stroke:'#e8ecf3'}));
    svg.append(el('text',{x:left-12,y:yy+4,'text-anchor':'end',fill:'#77849a','font-size':10},format(max*t/4)));
  }
  view.rows.forEach((row,i)=>{
    const center=left+i*slot+slot/2,bw=58;
    let base=bottom;
    series.forEach(s=>{
      const raw=row[view.headers.indexOf(s.name)],amount=Math.max(0,numeric(raw)||0);
      if(amount>0){
        const barHeight=amount/max*(bottom-top);
        const bar=el('rect',{x:center-bw/2,y:base-barHeight,width:bw,height:barHeight,fill:s.color});
        bar.append(el('title',{},`${s.name}: ${format(raw)}`));svg.append(bar);
        base-=barHeight;
      }
    });
    const total=row[totalIndex],totalText=format(total);
    const badge=el('g',{'aria-label':`Premios caducos ${labels[i]}: ${totalText}`});
    const totalLines=labelLines(totalText),badgeHeight=totalLines.length*17+12;
    badge.append(el('rect',{x:center-90,y:Math.max(8,base-badgeHeight-8),width:180,height:badgeHeight,rx:6,fill:'#fff',stroke:'#dbe3ef'}));
    const totalLabel=el('text',{x:center,y:Math.max(8,base-badgeHeight-8)+20,'text-anchor':'middle',fill:'#17243b','font-size':13,'font-weight':700});
    totalLines.forEach((line,k)=>totalLabel.append(el('tspan',{x:center,dy:k?17:0},line)));
    badge.append(totalLabel);svg.append(badge);
    svg.append(el('text',{x:center,y:bottom+22,'text-anchor':'middle',fill:'#34425a','font-size':12,'font-weight':700},labels[i]));
    series.forEach((s,j)=>{
      const raw=row[view.headers.indexOf(s.name)],yy=bottom+47+j*70;
      svg.append(el('rect',{x:center-96,y:yy-11,width:9,height:9,fill:s.color,rx:2}));
      svg.append(el('text',{x:center-82,y:yy-2,fill:'#46546e','font-size':11},s.name));
      const amount=labelLines(format(raw));
      const value=el('text',{x:center,y:yy+19,'text-anchor':'middle',fill:'#17243b','font-size':13,'font-weight':700});
      amount.forEach((line,k)=>value.append(el('tspan',{x:center,dy:k?17:0},line)));
      svg.append(value);
    });
  });
  wrap.append(svg);
  const legend=document.createElement('div');legend.className='legend';
  series.forEach(s=>{const item=document.createElement('span'),dot=document.createElement('i');dot.style.background=s.color;item.append(dot,document.createTextNode(s.name));legend.append(item);});
  const panel=document.createElement('div');panel.className='chart-with-legend';panel.append(wrap,legend);return panel;
}
export function renderChart(view) {
  if(view.chartType==='stacked')return renderStackedChart(view);
  const {labels,series}=chartData(view);
  const wrap=document.createElement('div');wrap.className='chart-scroll';
  const has=series.some(s=>s.values.some(v=>v !== null));
  if(!has) {wrap.classList.add('empty-chart');wrap.textContent='Todavía no hay valores para graficar.';return wrap;}
  // La etiqueta toma el dato original de la tabla. En las series de estado,
  // el 0/1 de chartData es solo una coordenada para dibujar la barra.
  const valueLabel=(row,index)=>formatCell(row[view.headers.indexOf(series[index].name)],series[index].name,view);
  let longestLine=1,maxLines=1;
  const valueLabels=view.rows.map((row,i)=>series.map((s,j)=>{
    if(s.values[i]===null)return null;
    const full=valueLabel(row,j);
    const category=view.categoryColumn?format(row[view.headers.indexOf(view.categoryColumn)]):null;
    const lines=[...(category?labelLines(category):[]),...labelLines(full)];
    maxLines=Math.max(maxLines,lines.length);
    for(const line of lines)longestLine=Math.max(longestLine,Array.from(line).length);
    return {full,lines,category};
  }));
  const slotWidth=Math.max(78,longestLine*8.2+34);
  const left=84,right=view.secondarySeries?85:20,groupWidth=series.length*slotWidth;
  const badgeHeight=maxLines*17+12;
  const top=badgeHeight+20,bottom=top+170;
  const width=Math.max(560,left+labels.length*groupWidth+right),height=bottom+badgeHeight+47;
  const all=series.filter(s=>s.name!==view.secondarySeries).flatMap(s=>s.values).filter(v=>v!==null);
  const min=Math.min(0,...all),max=Math.max(1,...all);
  const span=max-min || 1;
  const y=value=>bottom-(value-min)/span*(bottom-top);
  const secondaryMax=view.secondarySeries?Math.max(100,...series.filter(s=>s.name===view.secondarySeries).flatMap(s=>s.values).filter(v=>v!==null)):null;
  const ySecondary=value=>bottom-value/secondaryMax*(bottom-top);
  const svg=el('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':`Gráfica: ${series.map(s=>s.name).join(', ')}`});
  svg.style.height=`${height}px`;
  for(let i=0;i<5;i++) {
    const yy=top+(bottom-top)*i/4;
    svg.append(el('line',{x1:74,y1:yy,x2:width-12,y2:yy,stroke:'#e8ecf3'}));
    svg.append(el('text',{x:68,y:yy+4,'text-anchor':'end',fill:'#77849a','font-size':11},format(max-span*i/4)));
    if(secondaryMax!==null)svg.append(el('text',{x:width-74,y:yy+4,fill:'#1490b8','font-size':11},`${format(secondaryMax*(4-i)/4)} %`));
  }
  if(secondaryMax!==null)svg.append(el('text',{x:width-80,y:top-14,fill:'#1490b8','font-size':11},'Participación (%)'));
  const gap=(width-left-right)/labels.length;
  const slot=gap/series.length;
  const badges=[];
  labels.forEach((label,i)=>{
    const cx=left+i*gap+gap/2;
    series.forEach((s,j)=>{
      const v=s.values[i];if(v===null)return;
      const barCenter=left+i*gap+(j+.5)*slot;
      const bw=Math.min(32,slot*.42),x=barCenter-bw/2;
      const zero=s.name===view.secondarySeries?ySecondary(0):y(0);
      const val=s.name===view.secondarySeries?ySecondary(v):y(v);
      const bar=el('rect',{x,y:Math.min(zero,val),width:bw,height:Math.max(2,Math.abs(zero-val)),rx:3,fill:s.color});
      const {full,lines,category}=valueLabels[i][j];
      bar.append(el('title',{},`${s.name}: ${full}`));
      svg.append(bar);
      const ownHeight=lines.length*17+12;
      const ownWidth=Math.max(34,...lines.map(line=>Array.from(line).length*8.2+20));
      const boxY=v<0?Math.max(zero,val)+8:Math.min(zero,val)-ownHeight-8;
      const badge=el('g',{'aria-label':`${category?category+' · ':''}${s.name}: ${full}`});
      badge.append(el('rect',{x:barCenter-ownWidth/2,y:boxY,width:ownWidth,height:ownHeight,rx:6,fill:'#fff',stroke:'#dbe3ef'}));
      const value=el('text',{x:barCenter,y:boxY+20,'text-anchor':'middle',fill:'#17243b','font-size':13,'font-weight':700});
      lines.forEach((line,k)=>value.append(el('tspan',{x:barCenter,dy:k?17:0},line)));
      badge.append(value);
      badge.append(el('title',{},`${category?category+' · ':''}${s.name}: ${full}`));
      badges.push(badge);
    });
    const axisLabel=view.categoryColumn?format(view.rows[i][view.headers.indexOf(view.label)]):label;
    const axisLines=labelLines(axisLabel);
    const text=el('text',{x:cx,y:bottom+badgeHeight+28,'text-anchor':'middle',fill:'#64718a','font-size':11});
    axisLines.forEach((line,k)=>text.append(el('tspan',{x:cx,dy:k?14:0},line)));svg.append(text);
  });
  // Todas las etiquetas se pintan al final, por encima de cualquier barra.
  svg.append(...badges);
  wrap.append(svg);
  const legend=document.createElement('div');legend.className='legend';
  series.forEach(s=>{const item=document.createElement('span'),dot=document.createElement('i');dot.style.background=s.color;item.append(dot,document.createTextNode(s.name));legend.append(item);});
  const panel=document.createElement('div');panel.className='chart-with-legend';panel.append(wrap,legend);return panel;
}

export function renderTable(view) {
  const scroll=document.createElement('div');scroll.className='table-scroll';
  const table=document.createElement('table');
  const thead=table.createTHead(),tr=thead.insertRow();
  view.headers.forEach(h=>{const th=document.createElement('th');th.textContent=h;tr.append(th);});
  const tbody=table.createTBody();
  view.rows.forEach(row=>{
    const tr=tbody.insertRow();row.forEach((value,i)=>{const td=tr.insertCell();td.textContent=formatCell(value,view.headers[i],view);td.title=td.textContent;});
  });
  scroll.append(table);return scroll;
}

import { chartData, format } from './data.js';

const NS='http://www.w3.org/2000/svg';
function el(tag,attrs={},value) {
  const node=document.createElementNS(NS,tag);
  for (const [k,v] of Object.entries(attrs)) node.setAttribute(k,String(v));
  if(value !== undefined) node.textContent=value;
  return node;
}
export function renderChart(view) {
  const {labels,series}=chartData(view);
  const wrap=document.createElement('div');wrap.className='chart-scroll';
  const has=series.some(s=>s.values.some(v=>v !== null));
  if(!has) {wrap.classList.add('empty-chart');wrap.textContent='Todavía no hay valores para graficar.';return wrap;}
  const width=Math.max(560,labels.length*64+115),height=260,top=20,bottom=205;
  const all=series.flatMap(s=>s.values).filter(v=>v!==null);
  const min=Math.min(0,...all),max=Math.max(1,...all);
  const span=max-min || 1;
  const y=value=>bottom-(value-min)/span*(bottom-top);
  const svg=el('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':`Gráfica: ${series.map(s=>s.name).join(', ')}`});
  for(let i=0;i<5;i++) {
    const yy=top+(bottom-top)*i/4;
    svg.append(el('line',{x1:74,y1:yy,x2:width-12,y2:yy,stroke:'#e8ecf3'}));
    svg.append(el('text',{x:68,y:yy+4,'text-anchor':'end',fill:'#77849a','font-size':11},format(max-span*i/4)));
  }
  const gap=Math.max(54,(width-100)/labels.length);
  labels.forEach((label,i)=>{
    const cx=88+i*gap+gap/2;
    series.forEach((s,j)=>{
      const v=s.values[i];if(v===null)return;
      const bw=Math.max(5,Math.min(21,(gap-10)/series.length)),x=cx-(bw*series.length)/2+j*bw;
      const zero=y(0),val=y(v);
      svg.append(el('rect',{x,y:Math.min(zero,val),width:bw-2,height:Math.max(2,Math.abs(zero-val)),rx:2,fill:s.color}));
    });
    const short=label.length>17?label.slice(0,15)+'…':label;
    svg.append(el('text',{x:cx,y:232,'text-anchor':'middle',fill:'#64718a','font-size':10},short));
  });
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
    const tr=tbody.insertRow();row.forEach(value=>{const td=tr.insertCell();td.textContent=format(value);td.title=td.textContent;});
  });
  scroll.append(table);return scroll;
}

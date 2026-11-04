import { MONTHS } from './catalog.js';
import { format, getView, monthOf, numeric } from './data.js';

export function sectionMetric(view) {
  if(!view?.metric)return null;
  if(view.metric==='requerimientos')return {
    title:'Requerimientos del período',value:format(view.rows.length),
    note:'Cantidad de registros de los meses y años seleccionados.'
  };
  if(view.metric==='pqr'){
    const index=view.headers.indexOf('PQR');
    const numbers=view.rows.map(row=>numeric(row[index]));
    const total=numbers.some(n=>n!==null)?numbers.reduce((sum,n)=>sum+(n||0),0):view.rows.length;
    return {title:'Total de PQR consultadas',value:format(total),note:'Total de los registros incluidos en los filtros.'};
  }
  if(view.metric==='stock'){
    const monthIndex=view.headers.indexOf('MES'),stockIndex=view.headers.indexOf('INVENTARIO BODEGA');
    const latest=Math.max(-1,...view.rows.map(row=>monthOf(row[monthIndex])));
    const records=view.rows.filter(row=>monthOf(row[monthIndex])===latest);
    const total=records.reduce((sum,row)=>sum+(numeric(row[stockIndex])||0),0);
    return {title:'Saldo de formularios',value:records.length?format(total):'Sin dato',
      note:latest>=0?`Inventario del último mes disponible: ${MONTHS[latest]}.`:'No hay inventario para los filtros elegidos.'};
  }
  return null;
}

export function salesIndicators(book,region,filters) {
  const sheet=region==='boy'?'Ventas AP':'Ventas';
  const source=book?.[sheet];
  if(!source)return [];
  const view=getView(source,{sheet,columns:['MES','2025','2026'],label:'MES',series:['2025','2026']},region,filters.zone,filters.years);
  if(!view || view.yearUnavailable)return [];
  const years=view.series.filter(y=>/^\d{4}$/.test(y)).sort((a,b)=>Number(a)-Number(b));
  return years.map((year,i)=>{
    const index=view.headers.indexOf(year),previous=years[i-1],previousIndex=view.headers.indexOf(previous);
    const total=view.rows.reduce((sum,row)=>sum+(numeric(row[index])||0),0);
    const comparable=previous?view.rows.map(row=>[numeric(row[previousIndex]),numeric(row[index])]).filter(([a,b])=>a!==null&&b!==null&&a!==0):[];
    const base=comparable.reduce((sum,[a])=>sum+a,0),actual=comparable.reduce((sum,[,b])=>sum+b,0);
    const compliance=base?`${format(actual/base*100)} %`:'Sin comparativo';
    return {year,total:format(total),compliance,previous,
      note:previous?`Cumplimiento frente a ${previous} en meses con datos de ambos años.`:'Sin año anterior seleccionado para comparar.'};
  });
}

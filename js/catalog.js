export const MONTHS = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
export const REGIONS = { boy: 'Boyacá', amz: 'Amazonas' };
export const UADS = { boy: ['CHIQUINQUIRA','DUITAMA','GARAGOA','MONIQUIRA','PUERTO BOYACA','SOATA','SOGAMOSO','TUNJA'], amz: ['LETICIA'] };
export const OBLIGATIONS = [
  ['comercial','Ventas y comercial'],['cobertura','Cobertura y personal'],
  ['premios','Premios'],['fiscal','Fiscalización y pagos'],
  ['insumos','Insumos y formularios'],['operacion','Operación y servicio'],
  ['legal','Legal y reportes'],['sarlaft','SARLAFT y controles'],
  ['formacion','Formación']
];
const s = (sheet, columns, label, series, extra = {}) => ({ sheet, columns, label, series, ...extra });
const p = (id, title, boy, amz, extra = {}) => ({ id, title, boy, amz, ...extra });
const salesCols = ['MES','2025','2026','CUMPLIMIENTO'];
const min = (category) => s('Minimos',['CATEGORIA','MES VERIFICADO','MINIMOS CONTRACTUALES','CUMPLIMIENTO','% CUMPLIMIENTO'],'MES VERIFICADO',['MINIMOS CONTRACTUALES','CUMPLIMIENTO'],{where:['CATEGORIA',category]});
const fzBoy = (name, fields) => s('Formularios zona',['ZONA','MES',...fields],'MES',fields,{zone:'ZONA'});
const fzAmz = (fields) => s('Formularios zona',['ZONA','MES',...fields],'MES',fields,{zone:'ZONA'});
const cnjsa = (name, column) => p(`reporte-${name}`,name,s('REPORTES CNJSA',['MES',column],'MES',[column],{status:true,headerRow:2}),s('REPORTES CNJSA',['MES',column],'MES',[column],{status:true,headerRow:2}));

// Cada sección es una pareja autónoma tabla + gráfica. Las hojas faltantes se omiten por región.
export const BOARDS = [
  {id:1,title:'Resumen comercial y contractual',obligation:'comercial',kind:'overview',sections:[]},
  {id:2,title:'Ventas comparativas',obligation:'comercial',sections:[
    p('ventas-ap','Apuestas permanentes',s('Ventas AP',salesCols,'MES',['2025','2026']),s('Ventas',['MES','2025','2026','CUMPLIMIENTO RASPA Y CHANCE'],'MES',['2025','2026'])),
    p('ventas-chance','Chance',s('Ventas Chance',['MES','2025','2026','CUMPLIMIENTO CHANCE'],'MES',['2025','2026']),s('Ventas Chance',['MES','2025','2026','CUMPLIMIEN CHANCE'],'MES',['2025','2026']))
  ]},
  {id:3,title:'Mínimos contractuales',obligation:'cobertura',sections:['MUNICIPIOS','PDV','FUERZA DE VENTA','TERMINALES'].map((c,i)=>p(`min-${i}`,c,min(c),min(c)))},
  {id:4,title:'Carnetización',obligation:'cobertura',sections:[p('carnets','Personal carnetizado',s('Carnetizacion',['ZONA','MES VERIFICADO','CARNET','PERSONAL','CUMPLIMIENTO'],'MES VERIFICADO',['CARNET','PERSONAL'],{zone:'ZONA'}),s('Carnetizacion',['ZONA','MES VERIFICADO','CARNET','PERSONAL','CUMPLIMIENTO'],'MES VERIFICADO',['CARNET','PERSONAL'],{zone:'ZONA'}))]},
  {id:5,title:'Pago de premios',obligation:'premios',sections:[
    p('demorados','Premios demorados más de 20 días',s('Premios dem 20 dias',['MES','PREMIOS PAGADOS','DEMORADOS + DE 20 DÍAS EN COBRAR','CUMPLIMIENTO'],'MES',['PREMIOS PAGADOS','DEMORADOS + DE 20 DÍAS EN COBRAR']),s('Premios dem 20 dias',['MES VERIFICADO','PREMIOS PAGADOS','DEMORADOS + DE 20 DÍAS EN COBRAR','CUMPLIMIENTO'],'MES VERIFICADO',['PREMIOS PAGADOS','DEMORADOS + DE 20 DÍAS EN COBRAR'])),
    p('mayores','Premios mayores',s('Premios sup 700',['MES','PREMIOS PAGADOS','VALOR PREMIOS','PREMIOS MAYORES','VALOR PREMIOS MAYORES','% PARTICIPACIÓN CANT','% PARTICIPACIÓN VALOR'],'MES',['PREMIOS PAGADOS','PREMIOS MAYORES']),s('Premios sup 700',['MES','PREMIOS PAGADOS','VALOR PREMIOS','PREMIOS MAYORES','VALOR PREMIOS MAYORES','% PARTICIPACIÓN CANT','% PARTICIPACIÓN VALOR'],'MES',['PREMIOS PAGADOS','PREMIOS MAYORES']))
  ]},
  {id:6,title:'Premios caducos',obligation:'premios',sections:['Chance','Raspas'].map(x=>p(`caducos-${x}`,`Caducos ${x}`,s(`Premios Caducos ${x}`,['MES','VALOR PREMIOS CADUCOS','ADRES (75%)','LOTRÍA DE BOYACÁ (25%)','CUMPLIMIENTO'],'MES',['VALOR PREMIOS CADUCOS','ADRES (75%)','LOTRÍA DE BOYACÁ (25%)']),s(`Premios Caducos ${x}`,['MES','VALOR PREMIOS CADUCOS','ADRES (75%)','LOTRÍA DE BOYACÁ (25%)','CUMPLIMIENTO'],'MES',['VALOR PREMIOS CADUCOS','ADRES (75%)','LOTRÍA DE BOYACÁ (25%)'])))},
  {id:7,title:'Fiscalizaciones',obligation:'fiscal',sections:[p('fiscalizacion','Fiscalización por UAD',s('Fiscalizacion',['ZONA','MES','CUMPLIMIENTO'],'MES',['CUMPLIMIENTO'],{zone:'ZONA'}),s('Fiscalizacion',['ZONA','MES','CUMPLIMIENTO'],'MES',['CUMPLIMIENTO'],{zone:'ZONA'}))]},
  {id:8,title:'Derechos de explotación',obligation:'fiscal',sections:[p('derechos','Pago de derechos de explotación',s('Derechos de explotación',['MES','FECHA EFECTIVA DE PAGO','FECHA LIMITE DE PAGO','EFECTIVIDAD'],'MES',['EFECTIVIDAD']),s('Derechos de explotación',['MES','FECHA EFECTIVA DE PAGO','FECHA LIMITE DE PAGO','EFECTIVIDAD'],'MES',['EFECTIVIDAD']),{note:'Los valores de efectividad se muestran tal como están en el libro (incluidos -1 y 100).'})]},
  {id:9,title:'Inventario por UAD',obligation:'insumos',sections:[
    p('bon','Formularios BON',fzBoy('BON',['CONSUMO BON','INVENTARIO  BON','ENVIO BON','TOT BON']),fzAmz(['CONSUMO BON','BON','ENVIO BON','TOT BON'])),
    p('android','Formularios Android',fzBoy('Android',['CONSUMO ANDROID','INVENTARIO  ANDROID','ENVIO ANDROID','TOT ANDROID']),fzAmz(['CONSUMO ANDROID','ANDROID','ENVIO ANDROID','TOT ANDROID'])),
    p('rollos','Rollos Boyacá',fzBoy('Rollos',['CONSUMO ROLLOS BOYACA','INVENTARIO ROLLOS BOYACA','ENVIO ROLLOS BOYACA','TOT ROLLOS BOYACA']),null)
  ]},
  {id:10,title:'Compra y saldo de formularios',obligation:'insumos',sections:['BON','ANDROID','ROLLO BOYACÁ'].map((x,i)=>p(`compra-${i}`,x,s('Formularios Empresa',['MES','TIPO DE PAPELRIA','COMPRA','INVENTARIO BODEGA'],'MES',['COMPRA','INVENTARIO BODEGA'],{where:['TIPO DE PAPELRIA',x]}),null))},
  {id:11,title:'RUES, cámaras y servidor',obligation:'legal',sections:[
    p('rues','RUES',s('RUES',['FECHA','DEPARTAMENTO','PAGO'],'FECHA',['PAGO'],{status:true}),s('RUES',['FECHA','DEPARTAMENTO','PAGO'],'FECHA',['PAGO'],{status:true})),
    p('camaras','Cámaras de comercio',s('Camaras de comercio',['ZONA','MES','CUMPLIMIENTO'],'MES',['CUMPLIMIENTO'],{zone:'ZONA'}),s('Camaras de comercio',['ZONA','MES','CUMPLIMIENTO'],'MES',['CUMPLIMIENTO'],{zone:'ZONA'})),
    p('servidor','Mantenimiento del servidor',s('Servidor',['MES','MANTENIMIENTO'],'MES',['MANTENIMIENTO'],{status:true}),s('Servidor',['MES','MANTENIMIENTO'],'MES',['MANTENIMIENTO'],{status:true}))
  ]},
  {id:12,title:'Licencias, parafiscales y juego ilegal',obligation:'legal',sections:[
    p('licencias','Licencias de funcionamiento',s('Licencias',['MES VERIFICADO','MINIMOS CONTRACTUALES','CAMBIOS','CUMPLIMIENTO','% CUMPLIMIENTO'],'MES VERIFICADO',['MINIMOS CONTRACTUALES','CUMPLIMIENTO']),s('Licencias',['MES VERIFICADO','MINIMOS CONTRACTUALES','CAMBIOS','CUMPLIMIENTO','% CUMPLIMIENTO'],'MES VERIFICADO',['MINIMOS CONTRACTUALES','CUMPLIMIENTO'])),
    p('parafiscales','Parafiscales',s('PARAFISCALES',['MES VERIFICADO','RADICADO'],'MES VERIFICADO',['RADICADO'],{status:true}),null),
    p('ilegal','Juego ilegal',s('JUEGO ILEGAL',['MES REPORTADO','ZONA','RADICADO'],'MES REPORTADO',['RADICADO'],{zone:'ZONA',status:true}),s('JUEGO ILEGAL',['MES VERIFICADO','ZONA','RADICADO'],'MES VERIFICADO',['RADICADO'],{zone:'ZONA',status:true}))
  ]},
  {id:13,title:'PQR y álbum',obligation:'operacion',sections:[
    p('pqr','PQR',s('PQR',['ZONA','MES VERIFICADO','PQR'],'MES VERIFICADO',['PQR'],{zone:'ZONA'}),s('PQR',['ZONA','MES VERIFICADO','PQR'],'MES VERIFICADO',['PQR'],{zone:'ZONA'})),
    p('album','Cobertura de visitas a PDV',s('ALBUM',['MES','ZONA','PDV','VERIFICACIONES','COVERTURA'],'MES',['PDV','VERIFICACIONES'],{zone:'ZONA',regionalZone:true}),s('ALBUM',['MES','ZONA','PDV','# VISITAS','COVERTURA'],'MES',['PDV','# VISITAS'],{zone:'ZONA',regionalZone:true}))
  ]},
  {id:14,title:'Controles SARLAFT',obligation:'sarlaft',sections:[p('sarlaft','Verificaciones SARLAFT',s('SARLAFT',['MES VERIFICADO','AUSENCIA OPERACIONES GIROS','AUSENCIA OPERACIONES CHANCE','PREMIOS MAYORES'],'MES VERIFICADO',['AUSENCIA OPERACIONES GIROS','AUSENCIA OPERACIONES CHANCE','PREMIOS MAYORES'],{status:true}),null)]},
  {id:15,title:'Oficios y requerimientos',obligation:'sarlaft',sections:[
    p('oficios','Oficios al concedente',s('OFICIOS CONCEDENTES',['INFORME','FECHA PRESENTACIÓN','ENCARGADO','OBSERVACIÓN'],'FECHA PRESENTACIÓN',['INFORME'],{status:true}),null),
    p('requerimientos','Requerimientos',s('REQUERIMIENTOS',['RADICADO','INFORME','FECHA PRESENTACIÓN','ENCARGADO','OBSERVACIÓN'],'FECHA PRESENTACIÓN',['RADICADO'],{status:true}),null)
  ]},
  {id:16,title:'Personal y condiciones',obligation:'cobertura',sections:[
    p('discapacidad','Discapacidad',null,s('Discapacidad',['AÑO','CERTIFICADO FECHA','VENCE','TRABAJADORES','DIS NORMA','DISCA TOTAL'],'CERTIFICADO FECHA',['DIS NORMA','DISCA TOTAL'])),
    p('menores','Menores de edad',s('MENORES',['MES','EMPLEADOS','MENORES 18 AÑOS'],'MES',['EMPLEADOS','MENORES 18 AÑOS']),null),
    p('directivos','Directivos',null,s('DIRECTIVOS',['MUJERES','MEJERES CUMPLEN ANTIGUEDAD','HOMBRES','TOT PER','Cumplimiento'],'TOT PER',['MUJERES','HOMBRES']))
  ]},
  {id:17,title:'Pólizas',obligation:'legal',sections:[
    p('poliza-cumplimiento','Póliza de cumplimiento',s('POLIZAS',['Nro. Poliza','Fecha exp','Fecha ini','Fecha Fin','Valor Asegurado','Valor Cancelado'],'Nro. Poliza',['Valor Asegurado','Valor Cancelado'],{headerRow:2,columnOffset:0}),s('POLIZAS',['Nro. Poliza','Fecha exp','Fecha ini','Fecha Fin','Valor Asegurado','Valor Cancelado'],'Nro. Poliza',['Valor Asegurado','Valor Cancelado'],{headerRow:2,columnOffset:0})),
    p('poliza-social','Póliza de prestaciones sociales',s('POLIZAS',['Nro. Poliza','Fecha exp','Fecha ini','Fecha Fin','Valor Asegurado','Valor Cancelado'],'Nro. Poliza',['Valor Asegurado','Valor Cancelado'],{headerRow:2,columnOffset:6}),s('POLIZAS',['Nro. Poliza','Fecha exp','Fecha ini','Fecha Fin','Valor Asegurado','Valor Cancelado'],'Nro. Poliza',['Valor Asegurado','Valor Cancelado'],{headerRow:2,columnOffset:6}))
  ]},
  {id:18,title:'Resoluciones y autorizaciones',obligation:'legal',sections:[p('autorizaciones','Autorizaciones vigentes e históricas',s('AUTORIZACIONES',['N° de Resolución y fecha de expedición','Fecha de vigencia','Autorización'],'N° de Resolución y fecha de expedición',['Autorización'],{status:true}),s('AUTORIZACIONES',['N° de Resolución y fecha de expedición','Fecha de vigencia','Autorización'],'N° de Resolución y fecha de expedición',['Autorización'],{status:true}))]},
  {id:19,title:'Reportes CNJSA',obligation:'legal',sections:[
    cnjsa('207: Derechos','207 · DERECHOS'),cnjsa('219: Caducos','219 · CADUCOS'),
    ...[['AP01','DERECHOS'],['AP02','ESTADOS FINANCIEROS ANUALES'],['AP03','ESTADOS FINANCIEROS TRIMESTRALES'],['AP05','PREMIOS MAYORES'],['AP06','PREMIOS MENORES'],['AP07','PREMIO NO RECLAMADOS'],['AP08','AGENCIAS'],['AP09','COLABORADORES INDEPENDIENTES'],['AP10','INVENTARIO MAQUINAS'],['AP11','MOVIMIENTO MAQUINAS'],['AP16','RESERVA ACUMULADO']].map(([code,name])=>cnjsa(`${code}: ${name}`,`${code} · ${name}`))
  ]},
  {id:20,title:'Verificación IAS',obligation:'sarlaft',sections:[p('ias','Verificación por responsable',s('VERIFICACIÓN IAS',['MES','JAIME ESPARZA','OMAIRA CRUZ','EDISON LÓPEZ','JER'],'MES',['JAIME ESPARZA','OMAIRA CRUZ','EDISON LÓPEZ','JER'],{status:true}),null)]},
  {id:21,title:'Informe SECOP',obligation:'legal',sections:[p('secop','Cargue y radicado SECOP',s('INFORME SECOP',['MES','FECHA CARGUE','CORREO','RADICADO'],'MES',['RADICADO'],{status:true}),null)]},
  {id:22,title:'Capacitaciones y venta por modalidad',obligation:'formacion',sections:[
    p('capacitaciones','Capacitaciones e inducciones',s('CAPACITACIONES ',['MES','CAPACITACIONES','INDUCCIONES','REALIZADAS POR LA COORDINACIÓN INTERNAS','REALIZADAS POR LA COORDINACIÓN EXTERNAS'],'MES',['CAPACITACIONES','INDUCCIONES']),null),
    p('modalidad','Venta por modalidad',s('VENTA POR MODALIDAD',['MES','MODALIDAD','VENTA TOTAL','VENTA MODALIDAD','PARTICIPACIÓN'],'MES',['VENTA TOTAL','VENTA MODALIDAD']),s('VENTA POR MODALIUDAD',['MES','MODALIDAD','VENTA TOTAL','VENTA MODALIDAD','PARTICIPACIÓN'],'MES',['VENTA TOTAL','VENTA MODALIDAD']),{provisional:true})
  ]}
];

export function boardSources(board, region) {
  if (board.kind === 'overview') return region === 'boy'
    ? ['Ventas Chance','Ventas AP','Derechos de explotación','REQUERIMIENTOS','CAPACITACIONES ']
    : ['Ventas Chance','Ventas','Derechos de explotación'];
  return [...new Set(board.sections.map(x=>x[region]?.sheet).filter(Boolean))];
}

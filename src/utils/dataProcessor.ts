import * as XLSX from 'xlsx';
import { PlanMensualItem, SeguimientoItem, ProjectData } from '../types';

function normalizarTexto(texto: any): string {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extraerOE(texto: string): string {
  const match = texto.match(/(OE\d+)/i);
  return match ? match[1].toUpperCase() : 'SIN_OE';
}

export async function processFiles(
  resumenFile: File,
  planFile: File,
  seguimientoFile: File
): Promise<ProjectData> {
  const resumenBuffer = await resumenFile.arrayBuffer();
  const planBuffer = await planFile.arrayBuffer();
  const seguimientoBuffer = await seguimientoFile.arrayBuffer();

  const wbResumen = XLSX.read(resumenBuffer);
  const wbPlan = XLSX.read(planBuffer);
  const wbSeguimiento = XLSX.read(seguimientoBuffer);

  // 1. Process Planeación
  const sheetPlan = wbPlan.Sheets['Planeación'] || wbPlan.Sheets[wbPlan.SheetNames[0]];
  const dataPlanRaw: any[] = XLSX.utils.sheet_to_json(sheetPlan, { header: 1 });
  
  if (dataPlanRaw.length < 2) throw new Error('El archivo de planeación está vacío o mal formado');

  const headersPlan = dataPlanRaw[0].map((h: any) => String(h || '').trim().toUpperCase().replace(/\n/g, ''));
  const rowsPlan = dataPlanRaw.slice(1);

  const colIdx = {
    detalle: headersPlan.indexOf('DETALLE'),
    aporteEspecie: headersPlan.indexOf('APORTE_ESPECIE'),
    clasificacion: headersPlan.indexOf('CLASIFICACION'),
    grupoResponsable: headersPlan.indexOf('GRUPO_RESPONSABLE'),
  };

  const colsIgnorar = ['DETALLE', 'FECHA_INICIO', 'FECHA_TERMINACION', 'VALOR_TOTAL', 'APORTE_ESPECIE', 'DETALLE_NORM', 'CODIGO_OE', 'CLASIFICACION', 'GRUPO_RESPONSABLE'];
  const mesHeaders = headersPlan.filter((h: string) => h && !colsIgnorar.includes(h) && !h.startsWith('UNNAMED'));

  const planMensual: PlanMensualItem[] = [];
  const mapaEspecie: Record<string, string> = {};
  const mapaClasificacion: Record<string, string> = {};
  const mapaGrupo: Record<string, string> = {};
  const mapaDetalleOriginal: Record<string, string> = {};

  rowsPlan.forEach(row => {
    const detalle = row[colIdx.detalle] || '';
    const detalleNorm = normalizarTexto(detalle);
    if (!detalleNorm) return;

    const codigoOE = extraerOE(detalle);
    const aporteEspecie = String(row[colIdx.aporteEspecie] || '').trim().toUpperCase();
    const clasificacion = String(row[colIdx.clasificacion] || '').trim();
    const grupoResponsable = String(row[colIdx.grupoResponsable] || '').trim();

    mapaEspecie[detalleNorm] = aporteEspecie;
    mapaClasificacion[detalleNorm] = clasificacion;
    mapaGrupo[detalleNorm] = grupoResponsable;
    mapaDetalleOriginal[detalleNorm] = detalle;

    mesHeaders.forEach(mesHeader => {
      const idx = headersPlan.indexOf(mesHeader);
      const valor = parseFloat(row[idx]) || 0;
      
      let mesKey = '';
      const rawHeader = dataPlanRaw[0][idx];
      const mesStr = String(rawHeader || '').toLowerCase().trim();
      
      // 1. Try parsing mmm-yy format (e.g., nov-22, nov-2022)
      const mmmYYMatch = mesStr.match(/^([a-z]{3,4})[-/ ](\d{2,4})$/);
      if (mmmYYMatch) {
        const mmm = mmmYYMatch[1].substring(0, 3);
        let yy = mmmYYMatch[2];
        if (yy.length === 2) yy = `20${yy}`;
        const mesesMap: Record<string, string> = {
          'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
          'jul': '07', 'ago': '08', 'sep': '09', 'set': '09', 'oct': '10', 'nov': '11', 'dic': '12'
        };
        if (mesesMap[mmm]) {
          mesKey = `${yy}-${mesesMap[mmm]}`;
        }
      }

      if (!mesKey) {
        // 2. Try numeric (Excel date code)
        const num = Number(rawHeader);
        if (!isNaN(num) && num > 30000) {
          const d = XLSX.SSF.parse_date_code(num);
          mesKey = `${d.y}-${String(d.m).padStart(2, '0')}`;
        }
      }

      if (!mesKey) {
        // 3. Try parsing as standard date
        const date = new Date(String(rawHeader));
        if (!isNaN(date.getTime())) {
          mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
      }

      if (mesKey) {
        planMensual.push({
          codigoOE,
          aporteEspecie,
          detalleNorm,
          detalle,
          clasificacion,
          grupoResponsable,
          mes: mesKey,
          valorPlaneado: valor
        });
      }
    });
  });

  // 2. Process Seguimiento
  const sheetSeg = wbSeguimiento.Sheets[wbSeguimiento.SheetNames[0]];
  const dataSegRaw: any[] = XLSX.utils.sheet_to_json(sheetSeg);
  
  const seguimiento: SeguimientoItem[] = dataSegRaw.map(row => {
    const rowUpper: any = {};
    Object.keys(row).forEach(k => {
      rowUpper[k.trim().toUpperCase().replace(/\n/g, '')] = row[k];
    });

    const detalle = rowUpper['DETALLE'] || '';
    const detalleNorm = normalizarTexto(detalle);
    const codigoOE = extraerOE(detalle);
    
    let mes = '';
    const fechaRaw = String(rowUpper['FECHA'] || '').trim();
    // Python code uses format='%Y_%m'
    const matchMes = fechaRaw.match(/(\d{4})_(\d{2})/);
    if (matchMes) {
      mes = `${matchMes[1]}-${matchMes[2]}`;
    } else {
      const date = new Date(fechaRaw);
      if (!isNaN(date.getTime())) {
        mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
    }

    return {
      codigoOE,
      aporteEspecie: mapaEspecie[detalleNorm] || 'N',
      detalleNorm,
      detalle: mapaDetalleOriginal[detalleNorm] || detalle,
      clasificacion: mapaClasificacion[detalleNorm] || '',
      grupoResponsable: mapaGrupo[detalleNorm] || '',
      mes,
      valorEjecutado: parseFloat(rowUpper['VALOR_VANESSA']) || 0,
      estado: String(rowUpper['ESTADO'] || '').trim().toUpperCase()
    };
  }).filter(s => s.mes && s.codigoOE);

  // Unique lists for filters
  const oeList = Array.from(new Set(planMensual.map(p => p.codigoOE))).sort();
  const gruposList = Array.from(new Set(planMensual.map(p => p.grupoResponsable).filter(g => g))).sort();
  const clasificacionesList = Array.from(new Set(planMensual.map(p => p.clasificacion).filter(c => c))).sort();
  const detallesList = Array.from(new Set(planMensual.map(p => p.detalle))).sort();

  // Find min and max months
  const allMonthsFound = Array.from(new Set([
    ...planMensual.map(p => p.mes),
    ...seguimiento.map(s => s.mes)
  ])).filter(m => m).sort();

  const minMes = allMonthsFound[0] || '2022-11';
  const maxMes = allMonthsFound[allMonthsFound.length - 1] || '2026-10';

  return {
    planMensual,
    seguimiento,
    oeList,
    gruposList,
    clasificacionesList,
    detallesList,
    minMes,
    maxMes
  };
}

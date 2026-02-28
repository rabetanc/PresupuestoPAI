export interface ProjectData {
  planMensual: PlanMensualItem[];
  seguimiento: SeguimientoItem[];
  resumenFinanciero?: any;
  oeList: string[];
  gruposList: string[];
  clasificacionesList: string[];
  detallesList: string[];
}

export interface PlanMensualItem {
  codigoOE: string;
  aporteEspecie: string;
  detalleNorm: string;
  detalle: string;
  clasificacion: string;
  grupoResponsable: string;
  mes: string; // YYYY-MM
  valorPlaneado: number;
}

export interface SeguimientoItem {
  codigoOE: string;
  aporteEspecie: string;
  detalleNorm: string;
  detalle: string;
  clasificacion: string;
  grupoResponsable: string;
  mes: string; // YYYY-MM
  valorEjecutado: number;
  estado: string;
}

export interface ChartDataPoint {
  mes: string;
  mesTimestamp: number;
  cumPlan: number;
  cumReal: number;
  valorPlaneado: number;
  valorEjecutado: number;
}

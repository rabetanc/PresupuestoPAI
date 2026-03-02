import React, { useState, useMemo, useCallback } from 'react';
import { 
  Upload, 
  BarChart3, 
  FileSpreadsheet, 
  Filter, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ChevronDown,
  Activity,
  Users,
  Layers,
  FileText,
  LayoutDashboard,
  Table as TableIcon,
  Search
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { processFiles } from './utils/dataProcessor';
import { ProjectData, ChartDataPoint, PlanMensualItem, SeguimientoItem } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatMillions = (value: number) => {
  return `$${(value / 1e6).toFixed(0)}M`;
};

export default function App() {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Files state
  const [files, setFiles] = useState<{
    resumen: File | null;
    plan: File | null;
    seguimiento: File | null;
  }>({ resumen: null, plan: null, seguimiento: null });

  // Common filters for all blocks
  const [states, setStates] = useState({
    FINALIZADA: true,
    'EN TRAMITE': true,
    PENDIENTE: false,
    CANCELADA: false,
  });

  // Block-specific selections
  const [oeSelection, setOeSelection] = useState<string>('Todo el presupuesto');
  const [groupSelection, setGroupSelection] = useState<string>('Todos los grupos');
  const [classSelection, setClassSelection] = useState<string>('Todas las clasificaciones');
  const [rubrosSelection, setRubrosSelection] = useState<string[]>(['Todas las actividades']);

  const handleFileUpload = (type: keyof typeof files, file: File) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const handleProcess = async () => {
    if (!files.resumen || !files.plan || !files.seguimiento) {
      setError('Por favor sube los tres archivos requeridos.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await processFiles(files.resumen, files.plan, files.seguimiento);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error al procesar los archivos.');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = useCallback((type: 'oe' | 'group' | 'class' | 'rubros', selection: any) => {
    if (!data) return null;

    let pData = data.planMensual;
    let rData = data.seguimiento;

    // Apply State Filters
    const activeStates = Object.entries(states)
      .filter(([_, active]) => active)
      .map(([state]) => state);
    
    rData = rData.filter(item => {
      const normState = item.estado.includes('TRAMITE') ? 'EN TRAMITE' : item.estado;
      return activeStates.includes(normState) || activeStates.some(s => item.estado.includes(s));
    });

    // Apply Type Selection
    if (type === 'oe') {
      if (selection === 'Especie (S)') {
        pData = pData.filter(p => p.aporteEspecie === 'S');
        rData = rData.filter(r => r.aporteEspecie === 'S');
      } else if (selection === 'Financiado SGR (N)') {
        pData = pData.filter(p => p.aporteEspecie === 'N');
        rData = rData.filter(r => r.aporteEspecie === 'N');
      } else if (selection !== 'Todo el presupuesto') {
        pData = pData.filter(p => p.codigoOE === selection);
        rData = rData.filter(r => r.codigoOE === selection);
      }
    } else if (type === 'group') {
      if (selection !== 'Todos los grupos') {
        pData = pData.filter(p => p.grupoResponsable === selection);
        rData = rData.filter(r => r.grupoResponsable === selection);
      }
    } else if (type === 'class') {
      if (selection !== 'Todas las clasificaciones') {
        pData = pData.filter(p => p.clasificacion === selection);
        rData = rData.filter(r => r.clasificacion === selection);
      }
    } else if (type === 'rubros') {
      if (!selection.includes('Todas las actividades') && selection.length > 0) {
        pData = pData.filter(p => selection.includes(p.detalle));
        rData = rData.filter(r => selection.includes(r.detalle));
      }
    }

    return { pData, rData };
  }, [data, states]);

  const getChartData = useCallback((filtered: { pData: PlanMensualItem[], rData: SeguimientoItem[] } | null) => {
    if (!filtered || !data) return [];

    const { pData, rData } = filtered;
    
    // Dynamic range from data
    const allMonths: string[] = [];
    const [minYear, minMonth] = data.minMes.split('-').map(Number);
    const [maxYear, maxMonth] = data.maxMes.split('-').map(Number);
    
    const startDate = new Date(minYear, minMonth - 1, 1);
    const endDate = new Date(maxYear, maxMonth - 1, 1);
    
    let current = new Date(startDate);
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      allMonths.push(`${year}-${month}`);
      current.setMonth(current.getMonth() + 1);
    }

    let cumPlan = 0;
    let cumReal = 0;
    const now = new Date();
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return allMonths.map(mes => {
      const valPlan = pData.filter(p => p.mes === mes).reduce((sum, p) => sum + p.valorPlaneado, 0);
      const valReal = rData.filter(r => r.mes === mes).reduce((sum, r) => sum + r.valorEjecutado, 0);
      
      cumPlan += valPlan;
      if (mes <= mesActual || valReal > 0) {
        cumReal += valReal;
      }

      return {
        mes,
        mesTimestamp: new Date(mes).getTime(),
        valorPlaneado: valPlan,
        valorEjecutado: valReal,
        cumPlan,
        cumReal: (mes <= mesActual || valReal > 0) ? cumReal : null
      };
    }) as ChartDataPoint[];
  }, [data]);

  const getMetrics = useCallback((filtered: { pData: PlanMensualItem[], rData: SeguimientoItem[] } | null) => {
    if (!filtered) return null;
    const totalPlan = filtered.pData.reduce((sum, p) => sum + p.valorPlaneado, 0);
    const mesActual = new Date().toISOString().slice(0, 7);
    const totalReal = filtered.rData
      .filter(r => r.mes <= mesActual)
      .reduce((sum, r) => sum + r.valorEjecutado, 0);
    
    return {
      totalPlan,
      totalReal,
      saldo: totalPlan - totalReal,
      avance: totalPlan > 0 ? (totalReal / totalPlan) * 100 : 0
    };
  }, []);

  const downloadConsolidado = () => {
    if (!data) return;
    const mesActual = new Date().toISOString().slice(0, 7);
    
    const rows = data.detallesList.map(detalle => {
      const p = data.planMensual.filter(p => p.detalle === detalle).reduce((s, x) => s + x.valorPlaneado, 0);
      const r = data.seguimiento.filter(r => r.detalle === detalle && r.mes <= mesActual).reduce((s, x) => s + x.valorEjecutado, 0);
      const info = data.planMensual.find(p => p.detalle === detalle);
      const saldo = p - r;
      const avance = p > 0 ? (r / p) * 100 : 0;

      return {
        'Actividad / Detalle': detalle,
        'Clasificación': info?.clasificacion || '',
        'Grupo Responsable': info?.grupoResponsable || '',
        'Presupuestado': p,
        'Ejecutado': r,
        'Saldo por Ejecutar': saldo,
        '% Avance': avance.toFixed(1) + '%'
      };
    });

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${(row as any)[h]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Consolidado_Actividades_Detallado.csv';
    link.click();
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full bg-white rounded-3xl shadow-xl shadow-black/5 border border-black/5 p-8"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">Analizador de Presupuesto</h1>
              <p className="text-zinc-500">Sube tus archivos de Excel para comenzar el análisis</p>
            </div>
          </div>

          <div className="space-y-6">
            <FileUploader 
              label="1. Resumen Financiero Inicial" 
              icon={<FileText className="text-blue-500" />}
              onFileSelect={(f) => handleFileUpload('resumen', f)}
              file={files.resumen}
            />
            <FileUploader 
              label="2. Planeación Presupuesto" 
              icon={<CalendarIcon className="text-purple-500" />}
              onFileSelect={(f) => handleFileUpload('plan', f)}
              file={files.plan}
            />
            <FileUploader 
              label="3. Seguimiento de Ejecución" 
              icon={<Activity className="text-emerald-500" />}
              onFileSelect={(f) => handleFileUpload('seguimiento', f)}
              file={files.seguimiento}
            />

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={loading || !files.resumen || !files.plan || !files.seguimiento}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Upload size={20} />
                  Procesar Datos
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-zinc-900 font-sans pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
              <BarChart3 size={20} />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Analizador Presupuestal</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              {Object.entries(states).map(([state, active]) => (
                <button
                  key={state}
                  onClick={() => setStates(prev => ({ ...prev, [state]: !active }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                    active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                  )}
                >
                  {state}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setData(null)}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Reiniciar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-12">
        {/* Block 2: Visualización por objetivos */}
        <VisualizationBlock 
          id="objetivos"
          title="2. Visualización por Objetivos"
          icon={<Layers className="text-blue-500" />}
          description="Análisis de ejecución agrupado por objetivos estratégicos o tipo de aporte."
          selection={oeSelection}
          setSelection={setOeSelection}
          options={['Todo el presupuesto', 'Especie (S)', 'Financiado SGR (N)', ...data.oeList]}
          chartData={getChartData(getFilteredData('oe', oeSelection))}
          metrics={getMetrics(getFilteredData('oe', oeSelection))}
        />

        {/* Block 3: Visualización por grupos */}
        <VisualizationBlock 
          id="grupos"
          title="3. Visualización por Grupos"
          icon={<Users className="text-purple-500" />}
          description="Seguimiento financiero por equipo o grupo responsable de la ejecución."
          selection={groupSelection}
          setSelection={setGroupSelection}
          options={['Todos los grupos', ...data.gruposList]}
          chartData={getChartData(getFilteredData('group', groupSelection))}
          metrics={getMetrics(getFilteredData('group', groupSelection))}
        />

        {/* Block 4: Visualización por clasificación */}
        <VisualizationBlock 
          id="clasificacion"
          title="4. Visualización por Clasificación"
          icon={<Filter className="text-emerald-500" />}
          description="Análisis detallado según la categoría o clasificación del gasto."
          selection={classSelection}
          setSelection={setClassSelection}
          options={['Todas las clasificaciones', ...data.clasificacionesList]}
          chartData={getChartData(getFilteredData('class', classSelection))}
          metrics={getMetrics(getFilteredData('class', classSelection))}
        />

        {/* Block 5: Visualización por rubros (Multi-select) */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">5. Visualización por Rubros</h2>
              <p className="text-zinc-500">Selección múltiple de actividades específicas para análisis comparativo.</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-black/5 p-8 shadow-sm space-y-8">
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Search size={14} />
                Seleccionar Actividades (Ctrl + Click para múltiple)
              </label>
              <select
                multiple
                value={rubrosSelection}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
                  setRubrosSelection(values);
                }}
                className="w-full h-40 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              >
                <option value="Todas las actividades">Todas las actividades</option>
                {data.detallesList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-400 italic">💡 Tip: Mantén presionada la tecla Ctrl (o Cmd en Mac) para seleccionar varias actividades.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={getChartData(getFilteredData('rubros', rubrosSelection))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={formatMillions} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} formatter={(v: number) => [formatCurrency(v), '']} />
                    <Legend verticalAlign="top" align="right" iconType="circle" />
                    <Line type="monotone" dataKey="cumPlan" name="Planeado" stroke="#3B82F6" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="cumReal" name="Ejecutado" stroke="#F97316" strokeWidth={3} dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <MetricMini label="Planeado" value={formatCurrency(getMetrics(getFilteredData('rubros', rubrosSelection))?.totalPlan || 0)} color="blue" />
                <MetricMini label="Ejecutado" value={formatCurrency(getMetrics(getFilteredData('rubros', rubrosSelection))?.totalReal || 0)} color="orange" />
                <MetricMini label="Saldo" value={formatCurrency(getMetrics(getFilteredData('rubros', rubrosSelection))?.saldo || 0)} color="zinc" />
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Avance</div>
                  <div className="text-xl font-bold text-zinc-900">{getMetrics(getFilteredData('rubros', rubrosSelection))?.avance.toFixed(1)}%</div>
                  <div className="w-full h-1.5 bg-zinc-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${getMetrics(getFilteredData('rubros', rubrosSelection))?.avance}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Block 6: Tabla completa */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white">
                <TableIcon size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">6. Tabla Consolidada</h2>
                <p className="text-zinc-500">Resumen general de todas las actividades y su estado financiero.</p>
              </div>
            </div>
            <button 
              onClick={downloadConsolidado}
              className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-all flex items-center gap-2 shadow-lg shadow-black/10"
            >
              <Download size={18} />
              Descargar CSV
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-zinc-50">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Actividad / Detalle</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Clasificación</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Grupo</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Planeado</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Ejecutado</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Saldo</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {data.detallesList.map((detalle) => {
                    const p = data.planMensual.filter(p => p.detalle === detalle).reduce((s, x) => s + x.valorPlaneado, 0);
                    const r = data.seguimiento.filter(r => r.detalle === detalle && r.mes <= new Date().toISOString().slice(0, 7)).reduce((s, x) => s + x.valorEjecutado, 0);
                    const info = data.planMensual.find(p => p.detalle === detalle);
                    const avance = p > 0 ? (r / p) * 100 : 0;

                    return (
                      <tr key={detalle} className="hover:bg-zinc-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-zinc-900 line-clamp-2 max-w-xs group-hover:line-clamp-none transition-all">{detalle}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">{info?.clasificacion || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">{info?.grupoResponsable || '-'}</span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-mono text-zinc-600">{formatCurrency(p)}</td>
                        <td className="px-6 py-4 text-right text-sm font-mono text-zinc-600">{formatCurrency(r)}</td>
                        <td className="px-6 py-4 text-right text-sm font-mono text-zinc-600">{formatCurrency(p - r)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-1000",
                                  avance >= 80 ? "bg-emerald-500" : avance >= 40 ? "bg-orange-500" : "bg-red-500"
                                )}
                                style={{ width: `${Math.min(avance, 100)}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-bold w-10",
                              avance >= 80 ? "text-emerald-600" : avance >= 40 ? "text-orange-600" : "text-red-600"
                            )}>
                              {avance.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function VisualizationBlock({ id, title, icon, description, selection, setSelection, options, chartData, metrics }: any) {
  return (
    <section id={id} className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-zinc-100 text-zinc-600">
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-zinc-500">{description}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-black/5 p-8 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="w-full md:w-72">
            <FilterSelect 
              label="Seleccionar"
              icon={<Filter size={14} />}
              value={selection}
              onChange={setSelection}
              options={options}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <MetricMini label="Planeado" value={formatCurrency(metrics?.totalPlan || 0)} color="blue" />
            <MetricMini label="Ejecutado" value={formatCurrency(metrics?.totalReal || 0)} color="orange" />
            <MetricMini label="Saldo" value={formatCurrency(metrics?.saldo || 0)} color="zinc" />
            <MetricMini label="Avance" value={`${metrics?.avance.toFixed(1)}%`} color={metrics?.avance >= 80 ? 'emerald' : 'red'} />
          </div>
        </div>

        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={formatMillions} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} formatter={(v: number) => [formatCurrency(v), '']} />
              <Legend verticalAlign="top" align="right" iconType="circle" />
              <Line type="monotone" dataKey="cumPlan" name="Planeado" stroke="#3B82F6" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="cumReal" name="Ejecutado" stroke="#F97316" strokeWidth={3} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function MetricMini({ label, value, color }: { label: string, value: string, color: string }) {
  const colors: any = {
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    orange: "text-orange-600",
    red: "text-red-600",
    zinc: "text-zinc-600",
  };
  return (
    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
      <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">{label}</div>
      <div className={cn("text-sm font-bold truncate", colors[color])}>{value}</div>
    </div>
  );
}

function FileUploader({ label, icon, onFileSelect, file }: { label: string, icon: React.ReactNode, onFileSelect: (f: File) => void, file: File | null }) {
  return (
    <div className="relative">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 ml-1">
        {label}
      </label>
      <div className={cn(
        "relative group cursor-pointer border-2 border-dashed rounded-2xl p-4 transition-all",
        file ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 hover:border-zinc-300 bg-zinc-50/50"
      )}>
        <input 
          type="file" 
          accept=".xlsx,.xls" 
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
          onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        />
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
            {file ? <CheckCircle2 className="text-emerald-500" size={20} /> : icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 truncate">
              {file ? file.name : "Seleccionar archivo..."}
            </p>
            <p className="text-xs text-zinc-500">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : "Formatos .xlsx, .xls"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, icon, value, onChange, options }: { label: string, icon: React.ReactNode, value: string, onChange: (v: string) => void, options: string[] }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
        {icon}
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all cursor-pointer"
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
      </div>
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}



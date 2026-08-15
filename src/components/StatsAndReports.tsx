import React from 'react';
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Percent, 
  HelpCircle,
  ArrowUpRight,
  Flame,
  Award
} from 'lucide-react';
import { ClassStatistics, MasterTemplate, StudentExamResult } from '../types';
import { exportToExcel, exportToPdf } from '../utils/exportUtils';

interface StatsAndReportsProps {
  results: StudentExamResult[];
  template: MasterTemplate;
  stats: ClassStatistics;
}

export const StatsAndReports: React.FC<StatsAndReportsProps> = ({
  results,
  template,
  stats,
}) => {
  const handleExportExcel = () => {
    exportToExcel(results, template, stats);
  };

  const handleExportPdf = () => {
    exportToPdf(results, template, stats);
  };

  // Grade buckets for distribution (0-1.9, 2.0-2.9, 3.0-3.9, 4.0-5.0)
  const buckets = [
    { label: '0.0 - 1.9 (Bajo)', count: results.filter((r) => r.score < 2.0).length, color: 'bg-red-500' },
    { label: '2.0 - 2.9 (Insuficiente)', count: results.filter((r) => r.score >= 2.0 && r.score < 3.0).length, color: 'bg-amber-500' },
    { label: '3.0 - 3.9 (Aceptable)', count: results.filter((r) => r.score >= 3.0 && r.score < 4.0).length, color: 'bg-blue-500' },
    { label: '4.0 - 5.0 (Excelente)', count: results.filter((r) => r.score >= 4.0).length, color: 'bg-emerald-500' },
  ];

  const maxBucketCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      {/* Title & Export Buttons Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-md border border-indigo-100">
              Módulo 5: RF-10
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Reportes Estadísticos y Exportación Oficial
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generación de actas de calificaciones en formato Excel (.xlsx) y PDF con analítica psicométrica ítem por ítem.
          </p>
        </div>

        {/* Export Buttons (RF-10) */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="btn-export-excel"
            onClick={handleExportExcel}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Descargar Excel (.xlsx)</span>
          </button>

          <button
            id="btn-export-pdf"
            onClick={handleExportPdf}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs shadow-sm transition"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Generar Acta PDF</span>
          </button>
        </div>
      </div>

      {/* Key KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Average Score */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Promedio del Grupo</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.averageScore.toFixed(2)}</span>
            <span className="text-xs text-slate-400">/ {template.scaleMax.toFixed(1)}</span>
          </div>
          <span className="text-[11px] text-slate-500 block">
            Desviación estándar: ±{stats.standardDeviation.toFixed(2)}
          </span>
        </div>

        {/* Metric 2: Pass Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tasa de Aprobación</span>
            <Percent className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-emerald-600">{stats.passRate}%</span>
          </div>
          <span className="text-[11px] text-slate-500 block">
            {stats.passedCount} aprobados • {stats.failedCount} reprobados
          </span>
        </div>

        {/* Metric 3: Highest Score */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Nota Más Alta</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-amber-600">{stats.highestScore.toFixed(2)}</span>
          </div>
          <span className="text-[11px] text-slate-500 block">
            Nota mínima: {stats.lowestScore.toFixed(2)}
          </span>
        </div>

        {/* Metric 4: Hardest Question */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pregunta Más Fallada</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-rose-600">
              {stats.hardestQuestions[0] ? `#${stats.hardestQuestions[0]}` : 'N/A'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block">
            Menor índice de acierto en el grupo
          </span>
        </div>
      </div>

      {/* Two Column Layout: Score Distribution & Item Difficulty Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Grade Distribution (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
            <span>Distribución de Calificaciones</span>
            <span className="text-xs font-semibold text-slate-400">{stats.gradedStudents} Estudiantes</span>
          </h3>

          <div className="space-y-3.5">
            {buckets.map((bucket) => {
              const pct = stats.gradedStudents > 0 ? (bucket.count / stats.gradedStudents) * 100 : 0;
              return (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{bucket.label}</span>
                    <span>
                      {bucket.count} est. ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bucket.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <strong>Nota aprobatoria:</strong> {template.passingGrade.toFixed(1)} / {template.scaleMax.toFixed(1)}
          </div>
        </div>

        {/* Right Column: Question by Question Difficulty Breakdown (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">
              Análisis Ítem por Ítem (% de Éxito por Pregunta)
            </h3>
            <span className="text-xs font-semibold text-slate-400">1 a {template.totalQuestions} Preguntas</span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 pr-1 text-xs">
            {stats.questionStats.map((q) => {
              const isHard = stats.hardestQuestions.includes(q.questionNumber);
              const isEasy = stats.easiestQuestions.includes(q.questionNumber);

              return (
                <div key={q.questionNumber} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2 w-28">
                    <span className="font-bold text-slate-700 w-6">#{q.questionNumber}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      (Clave: {template.keys[q.questionNumber]?.toUpperCase()})
                    </span>
                  </div>

                  <div className="flex-1 mx-3">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          q.successRate >= 80
                            ? 'bg-emerald-500'
                            : q.successRate >= 50
                            ? 'bg-indigo-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${q.successRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="w-24 text-right">
                    <span className="font-bold text-slate-800">{q.successRate}%</span>
                    <span className="text-[10px] text-slate-400 block">
                      {q.correctCount}/{stats.gradedStudents} aciertos
                    </span>
                  </div>

                  <div className="w-20 text-right pl-2">
                    {isHard && (
                      <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-[10px] font-bold">
                        Difícil
                      </span>
                    )}
                    {isEasy && (
                      <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-[10px] font-bold">
                        Fácil
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

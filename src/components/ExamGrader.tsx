import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Edit3, 
  Eye, 
  Trash2, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  FileText, 
  UserCheck, 
  Sparkles,
  ArrowUpDown,
  RotateCcw,
  Check
} from 'lucide-react';
import { MasterTemplate, StudentExamResult } from '../types';
import { gradeStudentExam } from '../utils/scoring';

interface ExamGraderProps {
  results: StudentExamResult[];
  setResults: React.Dispatch<React.SetStateAction<StudentExamResult[]>>;
  template: MasterTemplate;
  onOpenVisualModal: (result: StudentExamResult) => void;
  onNavigateToReports: () => void;
  onDeleteResult?: (id: string) => void;
  onDeleteBulkResults?: (ids: string[]) => void;
}

export const ExamGrader: React.FC<ExamGraderProps> = ({
  results,
  setResults,
  template,
  onOpenVisualModal,
  onNavigateToReports,
  onDeleteResult,
}) => {
  const [filterTab, setFilterTab] = useState<'ALL' | 'NEEDS_REVIEW' | 'PASSED' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');

  // Start inline editing of handwritten name/grade (RF-06)
  const startEdit = (result: StudentExamResult) => {
    setEditingResultId(result.id);
    setEditName(result.studentName);
    setEditGrade(result.grade);
  };

  const saveEdit = (id: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, studentName: editName.trim() || 'Sin Nombre', grade: editGrade.trim() || '10-1' } : r))
    );
    setEditingResultId(null);
  };

  const cancelEdit = () => {
    setEditingResultId(null);
  };

  const deleteResult = (id: string) => {
    if (confirm('¿Está seguro de eliminar esta hoja calificada?')) {
      if (onDeleteResult) {
        onDeleteResult(id); // Deletes from Firebase + React state
      } else {
        setResults((prev) => prev.filter((r) => r.id !== id)); // Local-only fallback
      }
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`¿Está seguro de eliminar ${selectedIds.size} calificaciones seleccionadas?`)) {
      const idsArray = Array.from(selectedIds);
      if (onDeleteBulkResults) {
        onDeleteBulkResults(idsArray);
      } else {
        setResults((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      }
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Recalculate all grades against updated template
  const handleRecalculateAll = () => {
    setResults((prev) =>
      prev.map((r) => {
        const regraded = gradeStudentExam(r.detectedAnswers, template, r);
        return {
          ...r,
          score: regraded.score,
          percentage: regraded.percentage,
          correctCount: regraded.correctCount,
          incorrectCount: regraded.incorrectCount,
          blankCount: regraded.blankCount,
          doubleMarkCount: regraded.doubleMarkCount,
          isPassed: regraded.isPassed,
          anomalies: regraded.anomalies,
          status: regraded.anomalies.length > 0 ? 'NEEDS_REVIEW' : 'GRADED',
        };
      })
    );
  };

  // Counts for tabs
  const totalCount = results.length;
  const needsReviewCount = results.filter((r) => r.anomalies.length > 0 || r.status === 'NEEDS_REVIEW').length;
  const passedCount = results.filter((r) => r.isPassed).length;
  const failedCount = results.filter((r) => !r.isPassed).length;

  // Filtered list
  const filteredResults = results.filter((r) => {
    // Tab filter
    if (filterTab === 'NEEDS_REVIEW' && r.anomalies.length === 0 && r.status !== 'NEEDS_REVIEW') return false;
    if (filterTab === 'PASSED' && !r.isPassed) return false;
    if (filterTab === 'FAILED' && r.isPassed) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.studentName.toLowerCase().includes(q);
      const matchGrade = r.grade.toLowerCase().includes(q);
      const matchFile = r.fileName.toLowerCase().includes(q);
      return matchName || matchGrade || matchFile;
    }

    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResults.length && filteredResults.length > 0) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all visible
      setSelectedIds(new Set(filteredResults.map(r => r.id)));
    }
  };

  const isAllSelected = filteredResults.length > 0 && selectedIds.size === filteredResults.length;

  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-md border border-indigo-100">
              Módulo 3 & 4: RF-05, RF-06, RF-07, RF-08
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Evaluación y Calificaciones de Estudiantes
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Revisión automática de marcas OMR, extracción manuscrita de nombres/grados y detección de incidencias.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar {selectedIds.size}</span>
            </button>
          )}

          <button
            onClick={handleRecalculateAll}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
            title="Recalcular notas con la Plantilla Maestro activa"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Recalcular Notas</span>
          </button>

          <button
            onClick={onNavigateToReports}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ver Reportes & Estadísticas</span>
          </button>
        </div>
      </div>

      {/* Incidents Alert Box (RF-08) */}
      {needsReviewCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm block">
                {needsReviewCount} {needsReviewCount === 1 ? 'examen requiere' : 'exámenes requieren'} revisión manual (RF-08)
              </span>
              <span className="text-xs text-amber-800">
                Se detectaron preguntas en blanco, respuestas dobles o trazos ambiguos. Puede hacer clic en el botón de inspección visual con superposición (icono de ojo) para verificar o corregir manualmente.
              </span>
            </div>
          </div>
          <button
            onClick={() => setFilterTab('NEEDS_REVIEW')}
            className="px-3 py-1.5 bg-amber-200/80 hover:bg-amber-300 text-amber-950 rounded-lg text-xs font-bold transition shrink-0"
          >
            Filtrar Incidencias
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Filter buttons */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto text-xs">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              filterTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Todos ({totalCount})
          </button>

          <button
            onClick={() => setFilterTab('NEEDS_REVIEW')}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center space-x-1 ${
              filterTab === 'NEEDS_REVIEW'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-100/70'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Con Incidencias ({needsReviewCount})</span>
          </button>

          <button
            onClick={() => setFilterTab('PASSED')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              filterTab === 'PASSED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Aprobados ({passedCount})
          </button>

          <button
            onClick={() => setFilterTab('FAILED')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              filterTab === 'FAILED' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            Reprobados ({failedCount})
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por estudiante, grado..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredResults.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm space-y-2">
            <UserCheck className="w-10 h-10 mx-auto text-slate-300" />
            <span>No se encontraron exámenes para el filtro seleccionado.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input 
                      type="checkbox" 
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      disabled={filteredResults.length === 0}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 w-10 text-center">#</th>
                  <th className="py-3 px-4 min-w-[200px]">Estudiante (OCR Manuscrito)</th>
                  <th className="py-3 px-4 w-28 text-center">Grado</th>
                  <th className="py-3 px-4 w-24 text-center">Aciertos</th>
                  <th className="py-3 px-4 w-24 text-center">Errores</th>
                  <th className="py-3 px-4 w-24 text-center">Blanco / Doble</th>
                  <th className="py-3 px-4 w-28 text-center">Nota Final</th>
                  <th className="py-3 px-4 w-32 text-center">Estado</th>
                  <th className="py-3 px-4 w-28 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((r, index) => {
                  const isEditing = editingResultId === r.id;
                  const hasAnomalies = r.anomalies.length > 0;

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/70 transition cursor-default ${selectedIds.has(r.id) ? 'bg-indigo-50/30' : ''}`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelectRow(r.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      {/* Row number */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {index + 1}
                      </td>

                      {/* Student Name (Handwritten OCR RF-06 with Inline Edit) */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="text-xs font-semibold px-2 py-1 bg-white border border-indigo-400 rounded-lg w-full focus:outline-none ring-2 ring-indigo-100"
                              placeholder="Nombre del estudiante"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-900 text-sm">
                                {r.studentName}
                              </span>
                              {r.analyzedWithAI && (
                                <span title="Extraído con IA Gemini Vision OCR">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 truncate block max-w-xs">
                              {r.fileName}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Grade / Group */}
                      <td className="py-3.5 px-4 text-center">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGrade}
                            onChange={(e) => setEditGrade(e.target.value)}
                            className="text-xs font-semibold px-2 py-1 bg-white border border-indigo-400 rounded-lg w-16 text-center focus:outline-none ring-2 ring-indigo-100"
                            placeholder="10-1"
                          />
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-semibold text-xs border border-slate-200">
                            {r.grade || 'N/A'}
                          </span>
                        )}
                      </td>

                      {/* Correct count */}
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                        {r.correctCount} / {r.totalQuestionsGraded}
                      </td>

                      {/* Incorrect count */}
                      <td className="py-3.5 px-4 text-center font-bold text-rose-500">
                        {r.incorrectCount}
                      </td>

                      {/* Blank / Double mark count */}
                      <td className="py-3.5 px-4 text-center text-slate-600">
                        <span className={r.blankCount > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}>
                          {r.blankCount} B
                        </span>
                        {' / '}
                        <span className={r.doubleMarkCount > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}>
                          {r.doubleMarkCount} D
                        </span>
                      </td>

                      {/* Final Score (0.0 to 5.0) */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-base font-extrabold px-2.5 py-1 rounded-md ${
                            r.isPassed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {r.score.toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {r.percentage}%
                        </span>
                      </td>

                      {/* Status & Incidents */}
                      <td className="py-3.5 px-4 text-center">
                        {hasAnomalies ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Revisar ({r.anomalies.length})</span>
                            </span>
                          </div>
                        ) : r.isPassed ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Aprobado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-semibold text-[10px]">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Reprobado</span>
                          </span>
                        )}
                      </td>

                      {/* Action buttons (RF-09 Inspection & Edit) */}
                      <td className="py-3.5 px-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => saveEdit(r.id)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                              title="Guardar cambios"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
                              title="Cancelar"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-1.5">
                            {/* Visual Overlay Inspection Modal Button (RF-09) */}
                            <button
                              id={`btn-inspect-sheet-${r.id}`}
                              onClick={() => onOpenVisualModal(r)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition border border-indigo-200"
                              title="Inspección Visual con Superposición (RF-09)"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit Student Info */}
                            <button
                              onClick={() => startEdit(r)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition border border-slate-200"
                              title="Editar nombre y grupo manuscrito"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => deleteResult(r.id)}
                              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition border border-slate-200"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

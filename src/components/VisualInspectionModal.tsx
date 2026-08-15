import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Sparkles, 
  Save, 
  HelpCircle,
  Maximize2
} from 'lucide-react';
import { MasterTemplate, OptionLetter, StudentExamResult } from '../types';
import { computeSheetOverlayCoordinates } from '../utils/omrEngine';
import { gradeStudentExam } from '../utils/scoring';

interface VisualInspectionModalProps {
  result: StudentExamResult | null;
  template: MasterTemplate;
  onClose: () => void;
  onSaveUpdatedResult: (updated: StudentExamResult) => void;
}

export const VisualInspectionModal: React.FC<VisualInspectionModalProps> = ({
  result,
  template,
  onClose,
  onSaveUpdatedResult,
}) => {
  if (!result) return null;

  const [currentResult, setCurrentResult] = useState<StudentExamResult>({ ...result });
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);

  const letters: OptionLetter[] = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, template.optionsPerQuestion) as OptionLetter[];
  const overlayCoords = computeSheetOverlayCoordinates(template.totalQuestions, template.optionsPerQuestion);

  // When teacher clicks a bubble to correct a mark manually
  const handleBubbleClick = (questionNumber: number, optionLetter: OptionLetter) => {
    const currentAns = currentResult.detectedAnswers[questionNumber];
    const newAns = currentAns === optionLetter ? 'BLANK' : optionLetter;

    const newDetectedAnswers = {
      ...currentResult.detectedAnswers,
      [questionNumber]: newAns,
    };

    // Recalculate score immediately
    const regraded = gradeStudentExam(newDetectedAnswers, template, currentResult);

    const updated: StudentExamResult = {
      ...currentResult,
      detectedAnswers: newDetectedAnswers,
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

    setCurrentResult(updated);
    onSaveUpdatedResult(updated);
  };

  const handleSetMultiple = (questionNumber: number) => {
    const newDetectedAnswers = {
      ...currentResult.detectedAnswers,
      [questionNumber]: 'MULTIPLE' as const,
    };
    const regraded = gradeStudentExam(newDetectedAnswers, template, currentResult);
    const updated: StudentExamResult = {
      ...currentResult,
      detectedAnswers: newDetectedAnswers,
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
    setCurrentResult(updated);
    onSaveUpdatedResult(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
              OMR
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-white">
                  Inspección Visual de Examen (RF-09)
                </h3>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-indigo-500/30">
                  Superposición Dinámica
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Estudiante: <strong className="text-slate-200">{currentResult.studentName}</strong> • Grado: <strong className="text-slate-200">{currentResult.grade}</strong> • Archivo: {currentResult.fileName}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Quick Score Tag */}
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400">Nota:</span>
              <span className={`text-sm font-extrabold ${currentResult.isPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currentResult.score.toFixed(2)} / {template.scaleMax.toFixed(1)}
              </span>
              <span className="text-[11px] text-slate-400">({currentResult.correctCount}/{template.totalQuestions} aciertos)</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split Screen (Left: Interactive Image Overlay, Right: Matrix & Corrections) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100">
          {/* Left Canvas & Photo Viewer (7 Cols) */}
          <div className="lg:col-span-7 p-4 flex flex-col items-center justify-center relative overflow-hidden bg-slate-900 border-r border-slate-200">
            {/* Overlay Toolbar */}
            <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 shadow-md">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.2))}
                className="p-1 hover:text-white"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-bold w-12 text-center text-xs">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.2))}
                className="p-1 hover:text-white"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-slate-700 mx-1" />
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOverlays}
                  onChange={(e) => setShowOverlays(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="text-[11px] font-medium">Marcas de Corrección</span>
              </label>
            </div>

            {/* Visual Legend */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center space-x-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-[11px] text-slate-300 shadow-md">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300" />
                Correcta
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-300" />
                Incorrecta
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300" />
                Blanco / Doble
              </span>
            </div>

            {/* Sheet Viewport with Interactive SVG/Overlay */}
            <div className="w-full h-full min-h-[460px] max-h-[620px] overflow-auto flex items-center justify-center p-4">
              <div
                className="relative transition-transform duration-150 origin-center bg-white shadow-2xl rounded-lg"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <img
                  src={currentResult.processedImageUrl || currentResult.imageUrl}
                  alt="Hoja de Examen Escaneada"
                  className="max-w-[480px] sm:max-w-[540px] h-auto object-contain select-none pointer-events-none rounded"
                />

                {/* Superimposed OMR Inspection Overlay (RF-09) */}
                {showOverlays && (
                  <div className="absolute inset-0 pointer-events-auto">
                    {overlayCoords.map((item) => {
                      const studentAns = currentResult.detectedAnswers[item.questionNumber];
                      const correctAns = template.keys[item.questionNumber];
                      const isCorrect = studentAns && studentAns.toLowerCase() === correctAns?.toLowerCase();
                      const isBlank = !studentAns || studentAns === 'BLANK';
                      const isMultiple = studentAns === 'MULTIPLE';

                      return (
                        <div key={item.questionNumber}>
                          {item.options.map((opt) => {
                            const isOptionMarked = studentAns?.toLowerCase() === opt.letter;
                            const isCorrectOption = correctAns?.toLowerCase() === opt.letter;

                            // Color logic
                            let badgeStyle = '';
                            if (isOptionMarked && isCorrect) {
                              badgeStyle = 'bg-emerald-500/60 border-2 border-emerald-400 ring-2 ring-emerald-300 animate-pulse';
                            } else if (isOptionMarked && !isCorrect) {
                              badgeStyle = 'bg-rose-500/70 border-2 border-rose-400 ring-2 ring-rose-300';
                            } else if (isCorrectOption && !isCorrect) {
                              badgeStyle = 'border-2 border-emerald-400 border-dashed bg-emerald-500/20';
                            }

                            return (
                              <button
                                key={opt.letter}
                                type="button"
                                onClick={() => handleBubbleClick(item.questionNumber, opt.letter)}
                                className={`absolute rounded-full cursor-pointer transition-transform hover:scale-125 z-10 ${badgeStyle}`}
                                style={{
                                  left: `${opt.x}%`,
                                  top: `${opt.y}%`,
                                  width: `${opt.radius * 2.2}%`,
                                  height: `${opt.radius * 2.2}%`,
                                  transform: 'translate(-50%, -50%)',
                                }}
                                title={`P${item.questionNumber} (${opt.letter.toUpperCase()}) - Clic para marcar/desmarcar`}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Matrix & Manual Adjustments Sidebar (5 Cols) */}
          <div className="lg:col-span-5 p-6 bg-white flex flex-col justify-between overflow-y-auto max-h-[620px]">
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>Matriz de Respuestas & Correcciones</span>
                  <span className="text-xs font-semibold text-slate-400">
                    {template.totalQuestions} Preguntas
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Haga clic en cualquier opción para cambiar la respuesta leída si el estudiante usó trazo claro o borrón.
                </p>
              </div>

              {/* Incidents Warning if any */}
              {currentResult.anomalies.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1 shadow-xs">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Incidencias detectadas en este examen:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                    {currentResult.anomalies.map((ano, i) => (
                      <li key={i}>{ano}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Matrix List of Questions */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
                {Array.from({ length: template.totalQuestions }, (_, i) => i + 1).map((qNum) => {
                  const studentAns = currentResult.detectedAnswers[qNum];
                  const correctKey = template.keys[qNum];
                  const isCorrect = studentAns && studentAns.toLowerCase() === correctKey?.toLowerCase();
                  const isBlank = !studentAns || studentAns === 'BLANK';
                  const isMultiple = studentAns === 'MULTIPLE';

                  return (
                    <div
                      key={qNum}
                      className={`p-2.5 flex items-center justify-between text-xs transition ${
                        isCorrect ? 'bg-emerald-50/40' : isBlank || isMultiple ? 'bg-amber-50/40' : 'bg-rose-50/40'
                      }`}
                    >
                      {/* Question Label */}
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-700 w-6">{qNum}.</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Clave: <strong className="text-emerald-700 uppercase">{correctKey}</strong>
                        </span>
                      </div>

                      {/* Bubbles Selector */}
                      <div className="flex items-center space-x-1">
                        {letters.map((l) => {
                          const isSelected = studentAns?.toLowerCase() === l;
                          const isKey = correctKey?.toLowerCase() === l;

                          return (
                            <button
                              key={l}
                              type="button"
                              onClick={() => handleBubbleClick(qNum, l)}
                              className={`w-6 h-6 rounded-full text-xs font-bold transition ${
                                isSelected
                                  ? isKey
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-rose-600 text-white shadow-xs'
                                  : isKey
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {l}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => handleSetMultiple(qNum)}
                          className={`px-1.5 py-1 rounded text-[10px] font-bold ${
                            isMultiple ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          title="Marcar como respuesta doble"
                        >
                          Doble
                        </button>
                      </div>

                      {/* Status Icon */}
                      <div className="w-5 text-center">
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                        ) : isBlank ? (
                          <span className="text-[10px] font-bold text-amber-600">Vacío</span>
                        ) : isMultiple ? (
                          <span className="text-[10px] font-bold text-amber-600">Doble</span>
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500 inline" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Confirm Action */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                Guardar & Finalizar Revisión
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

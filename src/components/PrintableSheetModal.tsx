import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileCheck2, 
  Sliders, 
  CheckCircle,
  Eye
} from 'lucide-react';
import { MasterTemplate } from '../types';
import { generateBlankAnswerSheetPdf } from '../utils/exportUtils';
import { generateSampleSheetSvg } from '../data/samplePresets';

interface PrintableSheetModalProps {
  template: MasterTemplate;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintableSheetModal: React.FC<PrintableSheetModalProps> = ({
  template,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const [institution, setInstitution] = useState(template.institution || 'INSTITUCIÓN UNIVERSITARIA ITM');
  const [subject, setSubject] = useState(template.subject || 'Evaluación de Matemáticas y Ciencias');
  const [questionCount, setQuestionCount] = useState(template.totalQuestions || 30);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPdf = () => {
    try {
      setIsGenerating(true);
      generateBlankAnswerSheetPdf(institution, subject, questionCount);
    } catch (e) {
      console.error('Error generating PDF:', e);
      alert('Error al generar el PDF de la hoja de respuestas.');
    } finally {
      setIsGenerating(false);
    }
  };

  const previewSvg = generateSampleSheetSvg('___________________________', '_______', {});

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Generador de Hojas de Respuesta Imprimibles
              </h3>
              <p className="text-xs text-slate-400">
                Formato estándar con marcas fiduciales ópticas para reconocimiento 100% confiable.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 p-6 gap-6 overflow-y-auto">
          {/* Settings Column */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Parámetros de Impresión
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nombre de la Institución
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Materia / Título del Examen
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cantidad de Preguntas
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[20, 30, 40, 50].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuestionCount(num)}
                    className={`py-2 rounded-lg text-xs font-bold transition border ${
                      questionCount === num
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {num} P
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 text-xs text-indigo-900 space-y-1">
              <span className="font-bold block">✓ Especificaciones Técnicas:</span>
              <ul className="list-disc list-inside text-[11px] text-indigo-800 space-y-0.5">
                <li>Marcas fiduciales en las 4 esquinas para auto-alineación.</li>
                <li>Casillas de nombre manuscrito y grado optimizadas para OCR.</li>
                <li>Burbujas espaciadas uniformemente (a, b, c, d).</li>
              </ul>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm transition flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Generando PDF...' : 'Descargar Hoja en PDF para Imprimir'}</span>
            </button>
          </div>

          {/* Sheet Preview */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Vista Previa de Impresión
            </span>
            <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 max-w-[280px]">
              <img
                src={previewSvg}
                alt="Vista previa hoja de respuestas"
                className="w-full h-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { 
  CheckCircle2, 
  Settings2, 
  Upload, 
  Sparkles, 
  RotateCcw, 
  Shuffle, 
  HelpCircle,
  FileCheck2,
  Sliders,
  Scale,
  Plus,
  Minus
} from 'lucide-react';
import { MasterTemplate, OptionLetter } from '../types';
import { parseUploadedFile } from '../utils/fileParser';
import { analyzeExamWithAI } from '../utils/aiVision';

interface TemplateManagerProps {
  template: MasterTemplate;
  templates: MasterTemplate[];
  setTemplate: React.Dispatch<React.SetStateAction<MasterTemplate>>;
  onChangeActiveTemplate: (id: string) => void;
  onCreateTemplate: () => void;
  onDeleteTemplate: (id: string) => void;
  onAutoExtractMaster?: (file: File) => Promise<void>;
  onSave?: () => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  template,
  templates,
  setTemplate,
  onChangeActiveTemplate,
  onCreateTemplate,
  onDeleteTemplate,
  onSave,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'grid' | 'config'>('grid');
  const [isAnalyzingMaster, setIsAnalyzingMaster] = useState(false);
  const [masterUploadFeedback, setMasterUploadFeedback] = useState<string | null>(null);
  const [customWeightsActive, setCustomWeightsActive] = useState(false);
  const masterFileInputRef = useRef<HTMLInputElement>(null);

  const letters: OptionLetter[] = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, template.optionsPerQuestion) as OptionLetter[];

  // Update a single answer key
  const handleKeySelect = (questionNum: number, letter: OptionLetter) => {
    setTemplate((prev) => ({
      ...prev,
      keys: {
        ...prev.keys,
        [questionNum]: letter,
      },
    }));
  };

  // Adjust total questions count (supports 1 to 100 questions)
  const handleQuestionCountChange = (newCount: number) => {
    if (newCount < 5 || newCount > 100) return;
    
    setTemplate((prev) => {
      const newKeys = { ...prev.keys };
      const newWeights = { ...prev.weights };

      // Ensure keys and weights exist for new questions
      for (let i = 1; i <= newCount; i++) {
        if (!newKeys[i]) newKeys[i] = 'a';
        if (newWeights[i] === undefined) newWeights[i] = 1.0;
      }
      return {
        ...prev,
        totalQuestions: newCount,
        keys: newKeys,
        weights: newWeights,
      };
    });
  };

  // Upload solved master sheet image to auto-detect key
  const handleMasterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzingMaster(true);
      setMasterUploadFeedback('Analizando hoja patrón con IA (Gemini → Qwen → Groq → OpenAI)...');

      const pages = await parseUploadedFile(file);
      if (pages.length === 0) throw new Error('No se pudo leer el archivo de la plantilla.');

      const firstPage = pages[0];

      // Strip data URL prefix to get raw base64
      const base64 = firstPage.dataUrl.includes(',')
        ? firstPage.dataUrl.split(',')[1]
        : firstPage.dataUrl;
      const mimeType = file.type || 'image/jpeg';

      // Use direct client-side AI cascade (bypasses Vercel timeouts)
      const aiResult = await analyzeExamWithAI(base64, mimeType, template.totalQuestions, template.optionsPerQuestion);

      if (aiResult && aiResult.answers && aiResult.answers.length > 0) {
        const extractedKeys: Record<number, OptionLetter> = { ...template.keys };
        let detectedCount = 0;

        aiResult.answers.forEach((ans) => {
          if (ans.selectedOption && ans.selectedOption !== 'BLANK' && ans.selectedOption !== 'MULTIPLE') {
            const letter = ans.selectedOption.toLowerCase() as OptionLetter;
            if (['a', 'b', 'c', 'd', 'e'].includes(letter)) {
              extractedKeys[ans.questionNumber] = letter;
              detectedCount++;
            }
          }
        });

        setTemplate((prev) => ({
          ...prev,
          keys: extractedKeys,
        }));

        setMasterUploadFeedback(`¡Éxito! Se detectaron ${detectedCount} respuestas válidas con ${aiResult.modelUsed || 'IA'}. Revise la cuadrícula y guarde la plantilla.`);
      } else {
        setMasterUploadFeedback('No se pudieron detectar todas las marcas automáticamente. Revise manualmente la cuadrícula.');
      }
    } catch (err: any) {
      console.error(err);
      setMasterUploadFeedback(`Error al procesar la plantilla: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsAnalyzingMaster(false);
      if (masterFileInputRef.current) masterFileInputRef.current.value = '';
    }
  };

  // Helper tools
  const handleFillAll = (letter: OptionLetter) => {
    const newKeys: Record<number, OptionLetter> = {};
    for (let q = 1; q <= template.totalQuestions; q++) {
      newKeys[q] = letter;
    }
    setTemplate((prev) => ({ ...prev, keys: newKeys }));
  };

  const handleRandomFill = () => {
    const newKeys: Record<number, OptionLetter> = {};
    for (let q = 1; q <= template.totalQuestions; q++) {
      const randIdx = Math.floor(Math.random() * letters.length);
      newKeys[q] = letters[randIdx];
    }
    setTemplate((prev) => ({ ...prev, keys: newKeys }));
  };

  // Group questions into columns of 10 for clean display
  const questionsPerColumn = template.totalQuestions <= 20 ? 10 : 10;
  const numColumns = Math.ceil(template.totalQuestions / questionsPerColumn);

  const columns = Array.from({ length: numColumns }, (_, colIdx) => {
    const startQ = colIdx * questionsPerColumn + 1;
    const endQ = Math.min(startQ + questionsPerColumn - 1, template.totalQuestions);
    return {
      colIdx,
      startQ,
      endQ,
      questions: Array.from({ length: endQ - startQ + 1 }, (_, i) => startQ + i),
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header info */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-md border border-indigo-100">
                Módulo 1: RF-01 & RF-02
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                Gestión de Plantillas
              </h2>
            </div>
            
            {/* Template Selector & Manager */}
            <div className="mt-3 flex items-center flex-wrap gap-2">
              <select
                value={template.id}
                onChange={(e) => onChangeActiveTemplate(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.totalQuestions} Preguntas)</option>
                ))}
              </select>
              <button
                onClick={onCreateTemplate}
                className="flex items-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-indigo-700 rounded-lg text-sm font-semibold border border-slate-200 transition"
                title="Crear Nueva Plantilla"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva</span>
              </button>
              {templates.length > 1 && (
                <button
                  onClick={() => onDeleteTemplate(template.id)}
                  className="flex items-center space-x-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-semibold border border-red-200 transition"
                  title="Eliminar Plantilla Actual"
                >
                  <Minus className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Seleccione la plantilla activa o cree una nueva para cada grado/asignatura.
            </p>
          </div>

          {/* Quick upload solved master sheet button */}
          <div className="flex flex-wrap items-center gap-3">
            {onSave && (
              <button
                onClick={onSave}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm shadow-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Guardar Plantilla</span>
              </button>
            )}
            <input
              type="file"
              ref={masterFileInputRef}
              onChange={handleMasterFileUpload}
              accept="image/*,.pdf,.docx"
              className="hidden"
            />
            <button
              id="btn-upload-master-sheet"
              onClick={() => masterFileInputRef.current?.click()}
              disabled={isAnalyzingMaster}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-sm transition disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isAnalyzingMaster ? 'Extrayendo con IA...' : 'Cargar Plantilla Resuelta'}</span>
            </button>
          </div>
        </div>

        {/* Master Upload Feedback Message */}
        {masterUploadFeedback && (
          <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              {masterUploadFeedback}
            </span>
            <button
              onClick={() => setMasterUploadFeedback(null)}
              className="text-indigo-500 hover:text-indigo-800 font-bold ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* Subtabs: Cuadrícula de Respuestas vs Configuración del Sistema */}
        <div className="flex border-b border-slate-200 mt-6 space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveSubTab('grid')}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
              activeSubTab === 'grid'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Clave de Respuestas ({template.totalQuestions} Preguntas)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('config')}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
              activeSubTab === 'config'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>Configuración de Calificación & Ponderación</span>
          </button>
        </div>
      </div>

      {/* Subtab 1: Interactive Answer Key Grid */}
      {activeSubTab === 'grid' && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6">
          {/* Header Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Preguntas:</span>
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => handleQuestionCountChange(template.totalQuestions - 5)}
                  disabled={template.totalQuestions <= 5}
                  className="p-1.5 rounded hover:bg-white text-slate-700 disabled:opacity-30 transition"
                  title="Restar 5 preguntas"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-3 py-0.5 font-bold text-slate-800 text-sm min-w-[2.5rem] text-center">
                  {template.totalQuestions}
                </span>
                <button
                  onClick={() => handleQuestionCountChange(template.totalQuestions + 5)}
                  disabled={template.totalQuestions >= 100}
                  className="p-1.5 rounded hover:bg-white text-slate-700 disabled:opacity-30 transition"
                  title="Añadir 5 preguntas"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Select Presets */}
              <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500 ml-2">
                <span className="text-slate-400 font-medium">Preajustes:</span>
                {[10, 20, 25, 30, 50].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleQuestionCountChange(num)}
                    className={`px-2.5 py-1 rounded-md font-semibold text-xs transition ${
                      template.totalQuestions === num
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick action tools */}
            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={handleRandomFill}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium border border-slate-200 transition"
                title="Generar clave aleatoria para pruebas"
              >
                <Shuffle className="w-3.5 h-3.5 text-slate-500" />
                <span>Aleatorio</span>
              </button>
              <button
                onClick={() => handleFillAll('a')}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium border border-slate-200 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Todas "A"</span>
              </button>
            </div>
          </div>

          {/* Columns Grid matching standard OMR sheets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {columns.map((col) => (
              <div
                key={col.colIdx}
                className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2"
              >
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-200 flex justify-between items-center">
                  <span>Columna {col.colIdx + 1}</span>
                  <span className="text-indigo-600 font-semibold">P{col.startQ} - P{col.endQ}</span>
                </div>

                {col.questions.map((qNum) => {
                  const currentAnswer = template.keys[qNum] || 'a';
                  return (
                    <div
                      key={qNum}
                      className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors"
                    >
                      <span className="w-6 text-xs font-bold text-slate-600 text-left">
                        {qNum < 10 ? `0${qNum}` : qNum}
                      </span>

                      {/* Bubble radio buttons */}
                      <div className="flex items-center space-x-1">
                        {letters.map((letter) => {
                          const isSelected = currentAnswer.toLowerCase() === letter;
                          return (
                            <button
                              key={letter}
                              id={`key-q${qNum}-${letter}`}
                              type="button"
                              onClick={() => handleKeySelect(qNum, letter)}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold uppercase transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-xs scale-105'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                              }`}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              Haga clic sobre cada letra (A, B, C, D) para marcar la respuesta correcta del patrón maestro. Los cambios se guardan y recalculan inmediatamente.
            </span>
          </div>
        </div>
      )}

      {/* Subtab 2: Grading System & Weights Configuration (RF-02) */}
      {activeSubTab === 'config' && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General Exam Info */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                Datos del Examen e Institución
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre de la Plantilla (ej: Grado 10)
                </label>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => setTemplate((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Plantilla Matemáticas 10mo"
                  className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre de la Institución
                </label>
                <input
                  type="text"
                  value={template.institution}
                  onChange={(e) => setTemplate((p) => ({ ...p, institution: e.target.value }))}
                  placeholder="Ej: Institución Universitaria ITM"
                  className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Materia / Asignatura o Título del Examen
                </label>
                <input
                  type="text"
                  value={template.subject}
                  onChange={(e) => setTemplate((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="Ej: Evaluación de Matemáticas y Ciencias"
                  className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Grading Scale & Passing Threshold */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                Escala de Calificación (RF-02)
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nota Mínima
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={template.scaleMin}
                    onChange={(e) => setTemplate((p) => ({ ...p, scaleMin: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nota Máxima
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={template.scaleMax}
                    onChange={(e) => setTemplate((p) => ({ ...p, scaleMax: parseFloat(e.target.value) || 5.0 }))}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg text-center font-bold text-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nota Aprobatoria
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={template.passingGrade}
                    onChange={(e) => setTemplate((p) => ({ ...p, passingGrade: parseFloat(e.target.value) || 3.0 }))}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg text-center font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
                <strong>Fórmula aplicada:</strong> Nota = (Preguntas Correctas / Total Preguntas) × {template.scaleMax.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Rules for Invalid / Blank Marks */}
          <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Reglas ante Marcas Inválidas o Vacías (RF-02)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Regla para Doble Marca (Múltiples burbujas sombreadas):
                </span>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="doubleMark"
                      checked={template.doubleMarkRule === 'INCORRECT'}
                      onChange={() => setTemplate((p) => ({ ...p, doubleMarkRule: 'INCORRECT' }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Contar como Incorrecta (0 puntos) — <em>Recomendado</em></span>
                  </label>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Regla para Preguntas sin Responder (En Blanco):
                </span>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="blankMark"
                      checked={template.blankMarkRule === 'INCORRECT'}
                      onChange={() => setTemplate((p) => ({ ...p, blankMarkRule: 'INCORRECT' }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Sin puntaje (0 puntos)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="blankMark"
                      checked={template.blankMarkRule === 'PENALTY'}
                      onChange={() => setTemplate((p) => ({ ...p, blankMarkRule: 'PENALTY', penaltyPerBlank: 0.1 }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Penalización por pregunta en blanco (-0.1 pts)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Camera, 
  RotateCw, 
  SlidersHorizontal, 
  Play, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Loader2,
  RefreshCw,
  Zap
} from 'lucide-react';
import { MasterTemplate, PreprocessSettings, StudentExamResult } from '../types';
import { parseUploadedFile, ParsedFilePage } from '../utils/fileParser';
import { preprocessImage, scanBubblesLocally, computeSheetOverlayCoordinates } from '../utils/omrEngine';
import { gradeStudentExam } from '../utils/scoring';
import { analyzeExamWithAI } from '../utils/aiVision';

interface BatchUploaderProps {
  template: MasterTemplate;
  onAddResults: (newResults: StudentExamResult[]) => void;
  onNavigateToGrader: () => void;
}

interface QueuedItem {
  id: string;
  page: ParsedFilePage;
  rotation: number; // 0, 90, 180, 270
  settings: PreprocessSettings;
  processedPreviewUrl?: string;
  binarizedPreviewUrl?: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR';
  progressMsg?: string;
  error?: string;
}

export const BatchUploader: React.FC<BatchUploaderProps> = ({
  template,
  onAddResults,
  onNavigateToGrader,
}) => {
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Preprocessing state for active preview
  const [globalSettings, setGlobalSettings] = useState<PreprocessSettings>({
    autoRotate: true,
    deskew: true,
    contrast: 1.15,
    brightness: 0.05,
    threshold: 128,
    showBinarized: false,
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
    gridTop: 22,
    gridLeft: 6,
    gridWidth: 88,
    gridHeight: 72,
    useHybridMode: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const selectedItem = queue.find((q) => q.id === selectedQueueId) || queue[0];

  // Handle files selected via drag & drop or file dialog
  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newQueuedItems: QueuedItem[] = [];

    for (const file of fileArray) {
      try {
        const pages = await parseUploadedFile(file);
        pages.forEach((page, pIdx) => {
          const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}-${pIdx}`;
          newQueuedItems.push({
            id,
            page,
            rotation: 0,
            settings: { ...globalSettings },
            status: 'PENDING',
          });
        });
      } catch (err: any) {
        console.error('Error parsing file:', err);
        alert(err.message || 'Error al leer el archivo');
      }
    }

    if (newQueuedItems.length > 0) {
      setQueue((prev) => [...prev, ...newQueuedItems]);
      if (!selectedQueueId) {
        setSelectedQueueId(newQueuedItems[0].id);
      }
      // Trigger instant preview generation for the first item
      updateItemPreview(newQueuedItems[0]);
    }
  };

  // Generate real-time OMR binarized preview
  const updateItemPreview = async (item: QueuedItem) => {
    try {
      const processed = await preprocessImage(item.page.dataUrl, item.settings, item.rotation);
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                processedPreviewUrl: processed.dataUrl,
                binarizedPreviewUrl: processed.binarizedDataUrl,
              }
            : q
        )
      );
    } catch (e) {
      console.error('Error generating preview:', e);
    }
  };

  // Re-run preview whenever selected item settings or rotation change
  const handleRotate = (degrees: number = 90) => {
    if (!selectedItem) return;
    const nextRot = (selectedItem.rotation + degrees) % 360;
    const updated = { ...selectedItem, rotation: nextRot };
    setQueue((prev) => prev.map((q) => (q.id === selectedItem.id ? updated : q)));
    updateItemPreview(updated);
  };

  const handleSettingChange = (field: keyof PreprocessSettings, value: any) => {
    if (!selectedItem) return;
    const updatedSettings = { ...selectedItem.settings, [field]: value };
    const updated = { ...selectedItem, settings: updatedSettings };
    setQueue((prev) => prev.map((q) => (q.id === selectedItem.id ? updated : q)));
    setGlobalSettings((prev) => ({ ...prev, [field]: value }));
    updateItemPreview(updated);
  };

  // Camera capture handlers
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError('No se pudo acceder a la cámara. Verifique los permisos en el navegador.');
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    const id = `item-cam-${Date.now()}`;
    const newItem: QueuedItem = {
      id,
      page: {
        fileName: `Cam_Scan_${new Date().toLocaleTimeString().replace(/:/g, '-')}.jpg`,
        originalName: 'Captura de Cámara',
        pageNumber: 1,
        totalPages: 1,
        dataUrl,
        fileSize: 1500000,
        fileType: 'image/jpeg',
      },
      rotation: 0,
      settings: { ...globalSettings },
      status: 'PENDING',
    };

    setQueue((prev) => [...prev, newItem]);
    setSelectedQueueId(id);
    updateItemPreview(newItem);
    stopCamera();
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Process a single item with Gemini OCR/HTR and OMR evaluation
  const processSingleItem = async (item: QueuedItem): Promise<StudentExamResult> => {
    // 1. Preprocess image with custom rotation & binarization
    const processed = await preprocessImage(item.page.dataUrl, item.settings, item.rotation);

    let studentName = '';
    let grade = '';
    let detectedAnswers: Record<number, any> = {};
    let analyzedWithAI = false;
    let serverAnomalies: string[] = [];

    // If Hybrid Mode is enabled, skip the AI entirely and only use the local scanner
    if (!item.settings.useHybridMode) {
      try {
        // 2. AI Vision Cascade: Gemini → Qwen → Groq → OpenAI (all direct from browser)
        const base64 = processed.croppedOriginalUrl.includes(',')
          ? processed.croppedOriginalUrl.split(',')[1]
          : processed.croppedOriginalUrl;
        const mimeType = item.page.fileType || 'image/jpeg';

        const aiResult = await analyzeExamWithAI(base64, mimeType, template.totalQuestions, template.optionsPerQuestion);

        if (aiResult && aiResult.answers.length > 0) {
          studentName = aiResult.studentName || '';
          grade = aiResult.grade || '';
          analyzedWithAI = true;
          serverAnomalies = [...(aiResult.anomalies || []), `Modelo IA: ${aiResult.modelUsed || 'Desconocido'}`];
          aiResult.answers.forEach((ans) => {
            if (ans.questionNumber) {
              detectedAnswers[ans.questionNumber] = ans.selectedOption;
            }
          });
        }
      } catch (apiErr) {
        console.warn('[AI Cascade] All models failed, using local scanner:', apiErr);
      }
    }

    // 3. Fallback to client-side heuristic density scanner if needed
    if (Object.keys(detectedAnswers).length === 0) {
      detectedAnswers = scanBubblesLocally(
        processed.canvas,
        template.totalQuestions,
        template.optionsPerQuestion,
        item.settings
      );
    }

    // Default student name if unreadable
    if (!studentName.trim()) {
      const cleanFileName = item.page.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      studentName = `Estudiante (${cleanFileName})`;
    }
    if (!grade.trim()) {
      grade = '10-1';
    }

    // 4. Calculate Score against Master Template
    const grading = gradeStudentExam(detectedAnswers, template);

    // Merge anomalies
    const allAnomalies = Array.from(new Set([...serverAnomalies, ...grading.anomalies]));

    const result: StudentExamResult = {
      id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      templateId: template.id,
      fileName: item.page.fileName,
      fileType: item.page.fileType,
      fileSize: item.page.fileSize,
      imageUrl: item.page.dataUrl,
      processedImageUrl: processed.dataUrl,
      binarizedImageUrl: processed.binarizedDataUrl,
      studentName,
      grade,
      institution: template.institution,
      detectedAnswers,
      score: grading.score,
      percentage: grading.percentage,
      correctCount: grading.correctCount,
      incorrectCount: grading.incorrectCount,
      blankCount: grading.blankCount,
      doubleMarkCount: grading.doubleMarkCount,
      totalQuestionsGraded: grading.totalQuestionsGraded,
      isPassed: grading.isPassed,
      status: allAnomalies.length > 0 ? 'NEEDS_REVIEW' : 'GRADED',
      anomalies: allAnomalies,
      rotationAngle: item.rotation,
      contrast: item.settings.contrast,
      brightness: item.settings.brightness,
      threshold: item.settings.threshold,
      gridTop: item.settings.gridTop,
      gridLeft: item.settings.gridLeft,
      gridWidth: item.settings.gridWidth,
      gridHeight: item.settings.gridHeight,
      analyzedWithAI,
      timestamp: new Date().toISOString(),
    };

    return result;
  };

  // Process all queued items sequentially in batch
  const handleProcessBatch = async () => {
    if (queue.length === 0) return;
    setIsProcessingAll(true);

    const completedResults: StudentExamResult[] = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'PROCESSING', progressMsg: 'Analizando con IA...' } : q))
      );

      try {
        const result = await processSingleItem(item);
        completedResults.push(result);
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'DONE', progressMsg: 'Calificado' } : q))
        );
      } catch (err: any) {
        console.error('Error processing item:', item.id, err);
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'ERROR', error: err.message } : q))
        );
      }
    }

    setIsProcessingAll(false);
    if (completedResults.length > 0) {
      onAddResults(completedResults);
      onNavigateToGrader();
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-md border border-indigo-100">
              Módulo 2: RF-03 & RF-04
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Carga Masiva y Preprocesamiento de Documentos
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Cargue exámenes en múltiples formatos (PDF, Word DOCX, JPG, PNG, WEBP) o capture fotos con la cámara para corrección automática.
          </p>
        </div>

        {/* Action button to trigger processing */}
        {queue.length > 0 && (
          <button
            id="btn-process-batch"
            onClick={handleProcessBatch}
            disabled={isProcessingAll}
            className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-sm transition disabled:opacity-50"
          >
            {isProcessingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando Batch ({queue.filter((q) => q.status === 'DONE').length}/{queue.length})...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Calificar Batch ({queue.length} Exámenes)</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Main Grid: Left Uploader / List & Right Preprocessing Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dropzone, Camera & Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Multi-format Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/30 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 shadow-xs"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
              multiple
              accept="image/*,.pdf,.docx,.doc"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800 block">
                Haga clic para subir o arrastre archivos aquí
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                Soporta PDF, DOCX (Word), JPG, PNG, WEBP
              </span>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[10px] font-bold">PDF</span>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[10px] font-bold">Word DOCX</span>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[10px] font-bold">JPG / PNG</span>
            </div>
          </div>

          {/* Device Camera Button */}
          <div className="flex gap-2">
            {!isCameraActive ? (
              <button
                id="btn-open-camera"
                type="button"
                onClick={startCamera}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition shadow-xs"
              >
                <Camera className="w-4 h-4 text-indigo-600" />
                <span>Capturar con Cámara en Vivo</span>
              </button>
            ) : (
              <div className="w-full bg-slate-900 rounded-xl p-4 text-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    Cámara en Vivo
                  </span>
                  <button
                    onClick={stopCamera}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="relative aspect-4/3 bg-black rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  {/* Visual Guide Box */}
                  <div className="absolute inset-4 border-2 border-emerald-400/80 rounded-lg pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] bg-slate-900/80 text-emerald-300 px-2 py-1 rounded">
                      Encuadre la hoja dentro del recuadro
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Tomar Foto & Agregar al Batch</span>
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {cameraError}
            </div>
          )}

          {/* Queue List */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Cola de Procesamiento ({queue.length})
              </span>
              {queue.length > 0 && (
                <button
                  onClick={() => setQueue([])}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Limpiar Todo
                </button>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No hay documentos en la cola. Arrastre archivos o tome una foto.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {queue.map((item, index) => {
                  const isSelected = item.id === (selectedItem?.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedQueueId(item.id);
                        updateItemPreview(item);
                      }}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-xs ${
                        isSelected
                          ? 'border-indigo-500 border-l-4 bg-indigo-50/50 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate max-w-[80%]">
                        <span className="font-bold text-slate-400 w-4">{index + 1}.</span>
                        <div className="truncate">
                          <span className="font-semibold text-slate-800 block truncate">
                            {item.page.fileName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.page.fileType.includes('pdf') ? 'PDF' : item.page.fileType.includes('word') ? 'Word' : 'Imagen'} • Rotación: {item.rotation}°
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {item.status === 'PROCESSING' && (
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                        )}
                        {item.status === 'DONE' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        )}
                        {item.status === 'ERROR' && (
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQueue((prev) => prev.filter((q) => q.id !== item.id));
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preprocessing & OMR Computer Vision Inspection Studio (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                Preprocesamiento de Imagen (RF-04)
              </h3>
              <p className="text-xs text-slate-500">
                Ajuste contraste, brillo y binarización Otsu para aislar burbujas oscurecidas.
              </p>
            </div>

            {/* Rotation Buttons */}
            {selectedItem && (
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => handleRotate(90)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
                  title="Girar imagen 90 grados a la derecha"
                >
                  <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Rotar 90°</span>
                </button>
              </div>
            )}
          </div>

          {selectedItem ? (
            <div className="space-y-4">
              {/* Controls Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Contrast Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Contraste</span>
                    <span className="text-indigo-600 font-bold">{Math.round(selectedItem.settings.contrast * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={selectedItem.settings.contrast}
                    onChange={(e) => handleSettingChange('contrast', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Brightness Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Brillo</span>
                    <span className="text-indigo-600 font-bold">{Math.round(selectedItem.settings.brightness * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.05"
                    value={selectedItem.settings.brightness}
                    onChange={(e) => handleSettingChange('brightness', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Threshold Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Umbral Binarizado</span>
                    <span className="text-indigo-600 font-bold">{selectedItem.settings.threshold}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="220"
                    step="1"
                    value={selectedItem.settings.threshold}
                    onChange={(e) => handleSettingChange('threshold', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>

              {/* Crop Sliders */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Crop Top */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Recorte Superior</span>
                    <span className="text-indigo-600 font-bold">{selectedItem.settings.cropTop}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={selectedItem.settings.cropTop}
                    onChange={(e) => handleSettingChange('cropTop', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
                {/* Crop Bottom */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Recorte Inferior</span>
                    <span className="text-indigo-600 font-bold">{selectedItem.settings.cropBottom}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={selectedItem.settings.cropBottom}
                    onChange={(e) => handleSettingChange('cropBottom', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
                {/* Crop Left */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Recorte Izq.</span>
                    <span className="text-indigo-600 font-bold">{selectedItem.settings.cropLeft}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={selectedItem.settings.cropLeft}
                    onChange={(e) => handleSettingChange('cropLeft', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
                {/* Crop Right */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Recorte Der.</span>
                    <span className="text-indigo-600 font-bold">{selectedItem.settings.cropRight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={selectedItem.settings.cropRight}
                    onChange={(e) => handleSettingChange('cropRight', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>

              {/* Hybrid Mode Toggle */}
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">🛠️ Modo Híbrido Local</h4>
                  <p className="text-[11px] text-slate-500">Desactiva la IA en la nube y califica 100% usando una grilla local calibrable.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={selectedItem.settings.useHybridMode}
                    onChange={(e) => handleSettingChange('useHybridMode', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Grid Alignment Sliders (Hybrid Mode) */}
              {selectedItem.settings.useHybridMode && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <div className="col-span-2 sm:col-span-4 text-xs font-bold text-indigo-800 flex items-center justify-between">
                    <span>Alineación Manual de Grilla (Modo Híbrido)</span>
                    <span className="font-normal text-[10px] text-indigo-600">Para calificación local 100% precisa</span>
                  </div>
                  {/* Grid Top */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-indigo-700 mb-1">
                      <span>Pos. Y (Arriba)</span>
                      <span className="font-bold">{selectedItem.settings.gridTop}%</span>
                    </div>
                    <input type="range" min="0" max="50" step="0.5" value={selectedItem.settings.gridTop} onChange={(e) => handleSettingChange('gridTop', parseFloat(e.target.value))} className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  </div>
                  {/* Grid Left */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-indigo-700 mb-1">
                      <span>Pos. X (Izq)</span>
                      <span className="font-bold">{selectedItem.settings.gridLeft}%</span>
                    </div>
                    <input type="range" min="0" max="50" step="0.5" value={selectedItem.settings.gridLeft} onChange={(e) => handleSettingChange('gridLeft', parseFloat(e.target.value))} className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  </div>
                  {/* Grid Height */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-indigo-700 mb-1">
                      <span>Alto (Escala Y)</span>
                      <span className="font-bold">{selectedItem.settings.gridHeight}%</span>
                    </div>
                    <input type="range" min="30" max="100" step="0.5" value={selectedItem.settings.gridHeight} onChange={(e) => handleSettingChange('gridHeight', parseFloat(e.target.value))} className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  </div>
                  {/* Grid Width */}
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-indigo-700 mb-1">
                      <span>Ancho (Escala X)</span>
                      <span className="font-bold">{selectedItem.settings.gridWidth}%</span>
                    </div>
                    <input type="range" min="30" max="100" step="0.5" value={selectedItem.settings.gridWidth} onChange={(e) => handleSettingChange('gridWidth', parseFloat(e.target.value))} className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  </div>
                </div>
              )}

              {/* View Toggle: Processed Photo vs Binarized Black & White */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Vista previa en tiempo real:</span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSettingChange('showBinarized', false)}
                    className={`px-2.5 py-1 rounded-md font-semibold text-xs transition ${
                      !selectedItem.settings.showBinarized
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Foto Ajustada
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSettingChange('showBinarized', true)}
                    className={`px-2.5 py-1 rounded-md font-semibold text-xs transition ${
                      selectedItem.settings.showBinarized
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Capa Binarizada OMR
                  </button>
                </div>
              </div>

              {/* Preview Display Window */}
              <div className="relative w-full h-[500px] bg-slate-900 rounded-xl overflow-y-auto overflow-x-hidden border border-slate-800 flex items-start justify-center p-4 shadow-inner">
                <div className="relative inline-block max-w-full">
                  <img
                    src={
                      selectedItem.settings.showBinarized && selectedItem.binarizedPreviewUrl
                        ? selectedItem.binarizedPreviewUrl
                        : selectedItem.processedPreviewUrl || selectedItem.page.dataUrl
                    }
                    alt="Previsualización OMR"
                    className="block max-w-full h-auto rounded shadow-lg select-none"
                  />
                  {/* Grid Overlay */}
                  {selectedItem.settings.useHybridMode && (
                    <div className="absolute inset-0 pointer-events-none">
                      {computeSheetOverlayCoordinates(
                        template.totalQuestions,
                        template.optionsPerQuestion,
                        selectedItem.settings.gridTop,
                        selectedItem.settings.gridHeight,
                        selectedItem.settings.gridLeft,
                        selectedItem.settings.gridWidth
                      ).map((item) => (
                        <div key={item.questionNumber}>
                          {item.options.map((opt) => (
                            <div
                              key={opt.letter}
                              className="absolute rounded-full border-2 border-indigo-500/80 bg-indigo-500/20 shadow-xs"
                              style={{
                                left: `${opt.x}%`,
                                top: `${opt.y}%`,
                                width: `${opt.radius * 2.2}%`,
                                height: `${opt.radius * 2.2}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-xs flex items-center space-x-2 border border-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{selectedItem.page.fileName} (Rotación: {selectedItem.rotation}°)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
              <ImageIcon className="w-8 h-8 text-slate-300" />
              <span>Seleccione un documento de la cola para previsualizar y calibrar filtros OMR</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

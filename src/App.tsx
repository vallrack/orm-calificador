import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { TemplateManager } from './components/TemplateManager';
import { BatchUploader } from './components/BatchUploader';
import { ExamGrader } from './components/ExamGrader';
import { StatsAndReports } from './components/StatsAndReports';
import { VisualInspectionModal } from './components/VisualInspectionModal';
import { PrintableSheetModal } from './components/PrintableSheetModal';
import { Login } from './components/Login';
import { DEFAULT_MASTER_TEMPLATE } from './data/samplePresets';
import { MasterTemplate, StudentExamResult } from './types';
import { calculateClassStatistics } from './utils/scoring';
import { RotateCcw, Sparkles, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { loadUserData, saveTemplate, saveResult, deleteResult, deleteUserData, deleteTemplate } from './utils/db';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'upload' | 'grader' | 'reports'>('templates');
  const [isLoading, setIsLoading] = useState(true);

  // Master Templates State
  const [templates, setTemplates] = useState<MasterTemplate[]>(() => {
    const saved = localStorage.getItem('omr_master_templates');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [DEFAULT_MASTER_TEMPLATE];
  });
  
  const [activeTemplateId, setActiveTemplateId] = useState<string>(() => {
    const saved = localStorage.getItem('omr_active_template_id');
    return saved || DEFAULT_MASTER_TEMPLATE.id;
  });

  const template = templates.find(t => t.id === activeTemplateId) || templates[0] || DEFAULT_MASTER_TEMPLATE;

  // Student Results State (RF-05, 06, 07, 08)
  const [results, setResults] = useState<StudentExamResult[]>(() => {
    const saved = localStorage.getItem('omr_student_results');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Modal states
  const [inspectingResult, setInspectingResult] = useState<StudentExamResult | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load data from Firestore
        const data = await loadUserData(currentUser.uid);
        if (data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
          if (!data.templates.find(t => t.id === activeTemplateId)) {
            setActiveTemplateId(data.templates[0].id);
          }
        }
        setResults(data.results);
      } else {
        setTemplates([DEFAULT_MASTER_TEMPLATE]);
        setActiveTemplateId(DEFAULT_MASTER_TEMPLATE.id);
        setResults([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync to local storage & Firestore
  useEffect(() => {
    localStorage.setItem('omr_master_templates', JSON.stringify(templates));
    localStorage.setItem('omr_active_template_id', activeTemplateId);
  }, [templates, activeTemplateId]);

  // Persist results to localStorage
  useEffect(() => {
    try {
      const lightweightResults = results.map(r => {
        const { imageUrl, processedImageUrl, binarizedImageUrl, ...rest } = r;
        return rest as StudentExamResult;
      });
      localStorage.setItem('omr_student_results', JSON.stringify(lightweightResults));
    } catch (e) {
      console.warn("Could not save results to localStorage (might be full).", e);
    }
  }, [results]);

  // Derived Class Statistics (RF-10) filtered by active template
  const filteredResults = results.filter(r => 
    r.templateId === template.id || (!r.templateId && template.id === templates[0]?.id)
  );
  const stats = calculateClassStatistics(filteredResults, template);

  // Handlers
  const handleSaveTemplate = async (updatedTemplate: MasterTemplate) => {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === updatedTemplate.id);
      if (idx >= 0) {
        const newArr = [...prev];
        newArr[idx] = updatedTemplate;
        return newArr;
      }
      return [...prev, updatedTemplate];
    });

    if (user) {
      try {
        await saveTemplate(user.uid, updatedTemplate);
        alert('Plantilla guardada exitosamente en la nube.');
      } catch (error) {
        alert('Error al guardar la plantilla en la nube. Verifica tus permisos de Firebase.');
      }
    }
  };

  const handleCreateTemplate = () => {
    const newTemplate: MasterTemplate = {
      ...DEFAULT_MASTER_TEMPLATE,
      id: Date.now().toString(),
      name: `Nueva Plantilla ${templates.length + 1}`
    };
    setTemplates(prev => [...prev, newTemplate]);
    setActiveTemplateId(newTemplate.id);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (templates.length <= 1) {
      alert("No puedes eliminar la única plantilla que tienes. Edítala en su lugar.");
      return;
    }
    if (confirm("¿Estás seguro de eliminar esta plantilla? Los resultados asociados a ella podrían quedar huérfanos.")) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (activeTemplateId === id) {
        setActiveTemplateId(templates.find(t => t.id !== id)?.id || templates[0].id);
      }
      if (user) {
        deleteTemplate(user.uid, id).catch(e => console.error(e));
      }
    }
  };

  const handleAddBatchResults = (newResults: StudentExamResult[]) => {
    setResults((prev) => [...newResults, ...prev]);
    if (user) {
      newResults.forEach(res => saveResult(user.uid, res));
    }
  };

  const handleDeleteResult = (id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
    if (user) {
      deleteResult(user.uid, id);
    }
  };

  const handleUpdateSingleResult = (updated: StudentExamResult) => {
    setResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setInspectingResult(updated);
    if (user) {
      saveResult(user.uid, updated);
    }
  };

  const handleResetData = async () => {
    if (confirm('¿Estás seguro de que deseas borrar todos los datos (plantillas y resultados)?')) {
      if (user) {
        await deleteUserData(user.uid, results, templates);
      }
      setTemplates([DEFAULT_MASTER_TEMPLATE]);
      setActiveTemplateId(DEFAULT_MASTER_TEMPLATE.id);
      setResults([]);
      localStorage.removeItem('omr_master_templates');
      localStorage.removeItem('omr_active_template_id');
      localStorage.removeItem('omr_student_results');
    }
  };

  const handleLogin = (currentUser: User) => {
    setUser(currentUser);
  };

  const handleLogout = async () => {
    if (confirm('¿Cerrar sesión?')) {
      await signOut(auth);
      setUser(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800 antialiased">
      {/* Global Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        template={template}
        totalStudents={results.length}
        openPrintModal={() => setIsPrintModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'templates' && (
          <TemplateManager
            template={template}
            templates={templates}
            onChangeActiveTemplate={setActiveTemplateId}
            onCreateTemplate={handleCreateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            setTemplate={(t) => {
               // Update current template in array, but wait for save to persist to Firebase
               setTemplates(prev => prev.map(tmpl => tmpl.id === t.id ? t : tmpl));
            }}
            onSave={() => handleSaveTemplate(template)}
          />
        )}

        {activeTab === 'upload' && (
          <BatchUploader
            template={template}
            onAddResults={handleAddBatchResults}
            onNavigateToGrader={() => setActiveTab('grader')}
          />
        )}

        {activeTab === 'grader' && (
          <ExamGrader
            results={filteredResults}
            setResults={setResults}
            template={template}
            onOpenVisualModal={(res) => setInspectingResult(res)}
            onNavigateToReports={() => setActiveTab('reports')}
            onDeleteResult={handleDeleteResult}
          />
        )}

        {activeTab === 'reports' && (
          <StatsAndReports
            results={filteredResults}
            template={template}
            stats={stats}
          />
        )}
      </main>

      {/* Visual Inspection Overlay Modal (RF-09) */}
      <VisualInspectionModal
        result={inspectingResult}
        template={template}
        onClose={() => setInspectingResult(null)}
        onSaveUpdatedResult={handleUpdateSingleResult}
      />

      {/* Printable Sheet Generator Modal */}
      <PrintableSheetModal
        template={template}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">ScoreVision Pro</span>
            <span className="text-slate-300">•</span>
            <span>Sistema OMR & HTR de Alta Precisión</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleResetData}
              className="flex items-center space-x-1.5 text-slate-600 hover:text-red-600 font-medium transition"
              title="Borrar todos los datos"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Borrar Datos</span>
            </button>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400">Gemini 3.7 Flash Vision + OpenCV OMR</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

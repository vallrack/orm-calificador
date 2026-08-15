import React from 'react';
import { 
  FileCheck, 
  UploadCloud, 
  Users, 
  BarChart3, 
  Printer, 
  Sparkles,
  Layers,
  GraduationCap,
  LogOut
} from 'lucide-react';
import { MasterTemplate } from '../types';

interface NavbarProps {
  activeTab: 'templates' | 'upload' | 'grader' | 'reports';
  setActiveTab: (tab: 'templates' | 'upload' | 'grader' | 'reports') => void;
  template: MasterTemplate;
  totalStudents: number;
  openPrintModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  template,
  totalStudents,
  openPrintModal,
  onLogout,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 leading-none tracking-tight">ScoreVision Pro</h1>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] rounded-md font-semibold border border-indigo-100">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>IA OMR/HTR</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate max-w-xs sm:max-w-sm">
                {template.institution || 'Sistema de Calificación OMR/HTR'} • {template.totalQuestions} Preguntas
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              id="nav-tab-templates"
              onClick={() => setActiveTab('templates')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'templates'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>1. Plantilla Maestro</span>
            </button>

            <button
              id="nav-tab-upload"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>2. Carga & OMR</span>
            </button>

            <button
              id="nav-tab-grader"
              onClick={() => setActiveTab('grader')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all relative ${
                activeTab === 'grader'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>3. Calificaciones</span>
              {totalStudents > 0 && (
                <span className={`ml-1.5 text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'grader' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {totalStudents}
                </span>
              )}
            </button>

            <button
              id="nav-tab-reports"
              onClick={() => setActiveTab('reports')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'reports'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>4. Reportes & Stats</span>
            </button>
          </nav>

          {/* Engine Status & Quick Action */}
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Motor de IA Activo</span>
            </div>

            <button
              id="btn-print-sheet"
              onClick={openPrintModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition shadow-xs"
              title="Generar formato de hoja de respuestas en blanco para imprimir"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Hojas en Blanco</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition shadow-xs"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
              activeTab === 'templates' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600'
            }`}
          >
            1. Plantilla
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
              activeTab === 'upload' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600'
            }`}
          >
            2. Carga & OMR
          </button>
          <button
            onClick={() => setActiveTab('grader')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
              activeTab === 'grader' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600'
            }`}
          >
            3. Calificaciones ({totalStudents})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
              activeTab === 'reports' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600'
            }`}
          >
            4. Estadísticas
          </button>
        </div>
      </div>
    </header>
  );
};

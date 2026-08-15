import { MasterTemplate, StudentExamResult } from '../types';

export const DEFAULT_MASTER_TEMPLATE: MasterTemplate = {
  id: 'tmpl-default',
  name: 'Nueva Plantilla',
  institution: '',
  subject: '',
  totalQuestions: 10,
  optionsPerQuestion: 4,
  scaleMin: 0.0,
  scaleMax: 5.0,
  passingGrade: 3.0,
  doubleMarkRule: 'INCORRECT',
  blankMarkRule: 'INCORRECT',
  createdAt: new Date().toISOString(),
  weights: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 1.0])),
  keys: {},
};

// Generates high quality SVG representation of sample exam sheet for interactive preview and visual overlay inspection
export function generateSampleSheetSvg(
  studentName: string = 'Valeria Buriticá',
  grade: string = '10-1',
  answers: Record<number, string> = DEFAULT_MASTER_TEMPLATE.keys
): string {
  const totalQ = 30;
  const letters = ['a', 'b', 'c', 'd'];
  
  let gridSvg = '';
  for (let q = 1; q <= totalQ; q++) {
    const colIdx = Math.floor((q - 1) / 10);
    const rowIdx = (q - 1) % 10;
    
    const x = 50 + colIdx * 190;
    const y = 200 + rowIdx * 35;
    
    // Question number box
    gridSvg += `<rect x="${x}" y="${y}" width="180" height="30" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" rx="4"/>`;
    gridSvg += `<text x="${x + 8}" y="${y + 20}" font-family="sans-serif" font-size="13" font-weight="bold" fill="#334155">${q}</text>`;
    
    letters.forEach((l, lIdx) => {
      const bx = x + 40 + lIdx * 35;
      const by = y + 15;
      const isSelected = answers[q] === l;
      const isMultiple = answers[q] === 'MULTIPLE' && (l === 'a' || l === 'b');
      const isFilled = isSelected || isMultiple;
      
      gridSvg += `<text x="${bx - 7}" y="${by + 4}" font-family="sans-serif" font-size="10" fill="#64748b">${l}.</text>`;
      gridSvg += `<circle cx="${bx + 8}" cy="${by}" r="7" fill="${isFilled ? '#334155' : 'none'}" stroke="#475569" stroke-width="1.5"/>`;
    });
  }

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 650 620" width="100%" height="100%">
    <!-- Paper Sheet Background -->
    <rect width="650" height="620" fill="#fcfcfc" stroke="#94a3b8" stroke-width="1.5" rx="8"/>
    
    <!-- Optical Fiducial Marks (Corners) -->
    <rect x="20" y="20" width="14" height="14" fill="#0f172a"/>
    <rect x="616" y="20" width="14" height="14" fill="#0f172a"/>
    <rect x="20" y="586" width="14" height="14" fill="#0f172a"/>
    <rect x="616" y="586" width="14" height="14" fill="#0f172a"/>
    
    <!-- Institution Header -->
    <text x="325" y="45" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a" text-anchor="middle">INSTITUCIÓN UNIVERSITARIA ITM</text>
    <text x="325" y="65" font-family="sans-serif" font-size="11" fill="#475569" text-anchor="middle">Reacreditada en Alta Calidad • Hacia una era de Universidad y Humanidad</text>
    
    <!-- Header Box with Student Info (Handwritten font simulation) -->
    <rect x="50" y="85" width="550" height="90" fill="#ffffff" stroke="#64748b" stroke-width="1.2" rx="6"/>
    
    <text x="70" y="120" font-family="sans-serif" font-size="12" font-weight="bold" fill="#1e293b">Nombre del Estudiante:</text>
    <line x1="220" y1="125" x2="400" y2="125" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>
    <text x="230" y="122" font-family="cursive, 'Brush Script MT', 'Segoe Script', sans-serif" font-size="17" font-weight="600" fill="#1e3a8a">${studentName}</text>
    
    <text x="420" y="120" font-family="sans-serif" font-size="12" font-weight="bold" fill="#1e293b">Grado / Grupo:</text>
    <line x1="515" y1="125" x2="580" y2="125" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>
    <text x="525" y="122" font-family="cursive, 'Brush Script MT', sans-serif" font-size="16" font-weight="600" fill="#1e3a8a">${grade}</text>
    
    <text x="70" y="155" font-family="sans-serif" font-size="10" fill="#64748b">Instrucciones: Rellene completamente el círculo correspondiente a su respuesta.</text>

    <!-- Grid of Questions -->
    ${gridSvg}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
}

export const INITIAL_SAMPLE_RESULTS: StudentExamResult[] = [];

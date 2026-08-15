import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ClassStatistics, MasterTemplate, StudentExamResult } from '../types';

/**
 * Export results to Excel (.xlsx)
 */
export function exportToExcel(
  results: StudentExamResult[],
  template: MasterTemplate,
  stats: ClassStatistics
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Calificaciones Generales
  const summaryData = results.map((r, index) => {
    const row: Record<string, any> = {
      'N°': index + 1,
      'Estudiante': r.studentName || 'Sin Nombre Identificado',
      'Grado / Grupo': r.grade || 'N/A',
      'Nota Final': r.score.toFixed(2),
      'Aprobado': r.isPassed ? 'SÍ' : 'NO',
      'Aciertos': r.correctCount,
      'Errores': r.incorrectCount,
      'En Blanco': r.blankCount,
      'Dobles/Inválidas': r.doubleMarkCount,
      'Porcentaje (%)': `${r.percentage}%`,
      'Estado': r.status === 'NEEDS_REVIEW' ? 'Requiere Revisión' : 'Calificado',
      'Incidencias': r.anomalies.join('; '),
    };
    return row;
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Calificaciones');

  // 2. Sheet: Matriz Detallada de Respuestas (Estudiante x Pregunta)
  const matrixData = results.map((r, index) => {
    const row: Record<string, any> = {
      'N°': index + 1,
      'Estudiante': r.studentName || 'Sin Nombre',
      'Grado': r.grade || '',
      'Nota': r.score.toFixed(2),
    };

    for (let q = 1; q <= template.totalQuestions; q++) {
      const studentAns = r.detectedAnswers[q] || '-';
      const keyAns = template.keys[q] || '';
      const isCorrect = studentAns.toLowerCase() === keyAns.toLowerCase();
      row[`P${q} (Clave: ${keyAns})`] = studentAns.toUpperCase() + (isCorrect ? ' ✓' : ' ✗');
    }

    return row;
  });

  const wsMatrix = XLSX.utils.json_to_sheet(matrixData);
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Detalle Preguntas');

  // 3. Sheet: Estadísticas del Grupo
  const statsData = [
    { Métrica: 'Total Estudiantes Evaluados', Valor: stats.gradedStudents },
    { Métrica: 'Promedio del Grupo', Valor: stats.averageScore },
    { Métrica: 'Nota Más Alta', Valor: stats.highestScore },
    { Métrica: 'Nota Más Baja', Valor: stats.lowestScore },
    { Métrica: 'Mediana', Valor: stats.medianScore },
    { Métrica: 'Desviación Estándar', Valor: stats.standardDeviation },
    { Métrica: 'Tasa de Aprobación (%)', Valor: `${stats.passRate}%` },
    { Métrica: 'Estudiantes Aprobados', Valor: stats.passedCount },
    { Métrica: 'Estudiantes Reprobados', Valor: stats.failedCount },
    { Métrica: 'Preguntas Más Falladas', Valor: stats.hardestQuestions.map((q) => `#${q}`).join(', ') || 'Ninguna' },
  ];
  const wsStats = XLSX.utils.json_to_sheet(statsData);
  XLSX.utils.book_append_sheet(wb, wsStats, 'Estadísticas');

  // Download XLSX
  const filename = `Reporte_Calificaciones_${template.subject || 'Examen'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Export results to PDF Official Report
 */
export function exportToPdf(
  results: StudentExamResult[],
  template: MasterTemplate,
  stats: ClassStatistics
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header Banner
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(template.institution || 'SISTEMA DE EVALUACIÓN Y CALIFICACIÓN OMR', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Informe Oficial de Calificaciones — ${template.subject || 'Examen'} (${template.totalQuestions} preguntas)`, 14, 20);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 160, 20);

  // Stats Summary Card
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen Ejecutivo del Grupo', 14, 36);

  const statsBody = [
    [
      `Total Estudiantes: ${stats.gradedStudents}`,
      `Promedio: ${stats.averageScore.toFixed(2)} / ${template.scaleMax.toFixed(1)}`,
      `Aprobados: ${stats.passedCount} (${stats.passRate}%)`,
      `Reprobados: ${stats.failedCount}`,
    ],
    [
      `Nota Máxima: ${stats.highestScore.toFixed(2)}`,
      `Nota Mínima: ${stats.lowestScore.toFixed(2)}`,
      `Desviación: ±${stats.standardDeviation.toFixed(2)}`,
      `Más difícil: Pregunta ${stats.hardestQuestions[0] ? '#' + stats.hardestQuestions[0] : 'N/A'}`,
    ],
  ];

  autoTable(doc, {
    startY: 40,
    theme: 'grid',
    body: statsBody,
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Main Students Table
  const tableData = results.map((r, i) => [
    (i + 1).toString(),
    r.studentName || 'Sin Nombre',
    r.grade || 'N/A',
    r.correctCount.toString(),
    r.incorrectCount.toString(),
    r.blankCount.toString(),
    r.doubleMarkCount.toString(),
    `${r.percentage}%`,
    r.score.toFixed(2),
    r.isPassed ? 'APROBADO' : 'REPROBADO',
  ]);

  const finalY = (doc as any).lastAutoTable?.finalY || 60;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Listado de Calificaciones por Estudiante', 14, finalY + 8);

  autoTable(doc, {
    startY: finalY + 12,
    head: [['#', 'Estudiante', 'Grado', 'Aciertos', 'Errores', 'Blanco', 'Doble', '%', 'Nota Final', 'Estado']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 13, halign: 'center' },
      6: { cellWidth: 13, halign: 'center' },
      7: { cellWidth: 15, halign: 'center' },
      8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: 24, halign: 'center' },
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 9) {
        if (data.cell.raw === 'APROBADO') {
          data.cell.styles.textColor = [22, 101, 52]; // green
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [185, 28, 28]; // red
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${pageCount} — Generado por Calificador OMR & OCR`, 105, 290, { align: 'center' });
  }

  doc.save(`Acta_Calificaciones_${template.subject || 'Examen'}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Generate a printable blank bubble answer sheet PDF (ready to print for classroom exams)
 */
export function generatePrintableAnswerSheet(
  totalQuestions: number = 30,
  institution: string = 'Institución Universitaria ITM',
  subject: string = 'Evaluación Académica',
  optionsPerQuestion: number = 4
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const letters = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, optionsPerQuestion);

  // Outer border & alignment corner markers for optical scanners
  const margin = 12;
  const pageWidth = 210;
  const pageHeight = 297;

  // Corner black square fiducials
  const markerSize = 6;
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, margin, markerSize, markerSize, 'F');
  doc.rect(pageWidth - margin - markerSize, margin, markerSize, markerSize, 'F');
  doc.rect(margin, pageHeight - margin - markerSize, markerSize, markerSize, 'F');
  doc.rect(pageWidth - margin - markerSize, pageHeight - margin - markerSize, markerSize, markerSize, 'F');

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(institution.toUpperCase(), 105, 22, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`HOJA DE RESPUESTAS OMR — ${subject.toUpperCase()}`, 105, 28, { align: 'center' });

  // Student Info Box
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.4);
  doc.rect(margin + 5, 34, pageWidth - (margin + 5) * 2, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Nombre del Estudiante:', margin + 9, 42);
  doc.line(margin + 48, 42, margin + 125, 42); // line for handwritten name

  doc.text('Grado / Grupo:', margin + 130, 42);
  doc.line(margin + 155, 42, pageWidth - margin - 10, 42); // line for handwritten grade

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Fecha: _____________________', margin + 9, 50);
  doc.text('Firma: _________________________________', margin + 85, 50);

  // Instructions
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Instrucciones: Rellene completamente el círculo de la opción elegida con lápiz oscuro o bolígrafo negro. Evite tachones.', 105, 62, { align: 'center' });

  // Bubble Answer Grid
  const questionsPerColumn = totalQuestions <= 20 ? 10 : totalQuestions <= 40 ? 10 : 25;
  const numColumns = Math.ceil(totalQuestions / questionsPerColumn);
  
  const gridStartY = 68;
  const availableWidth = pageWidth - (margin + 5) * 2;
  const colWidth = availableWidth / numColumns;
  const rowHeight = 7.2;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);

  for (let q = 1; q <= totalQuestions; q++) {
    const colIndex = Math.floor((q - 1) / questionsPerColumn);
    const rowIndex = (q - 1) % questionsPerColumn;

    const colX = margin + 5 + colIndex * colWidth;
    const rowY = gridStartY + rowIndex * rowHeight;

    // Row bounding box
    doc.rect(colX, rowY, colWidth - 2, rowHeight);

    // Question Number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${q}.`, colX + 3, rowY + 5);

    // Options (a, b, c, d)
    const bubbleAreaWidth = colWidth - 14;
    const optSpacing = bubbleAreaWidth / optionsPerQuestion;

    letters.forEach((letter, optIdx) => {
      const bx = colX + 11 + optIdx * optSpacing + optSpacing / 2;
      const by = rowY + 3.6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(`${letter}.`, bx - 3.5, by + 1.2);

      // Bubble circle
      doc.circle(bx + 1.5, by, 1.8, 'S');
    });
  }

  // Footer instructions
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Formato Estándar OMR — Diseñado para lectura óptica de alta precisión', 105, 285, { align: 'center' });

  doc.save(`Plantilla_Hoja_Respuestas_${totalQuestions}Q.pdf`);
}

export const generateBlankAnswerSheetPdf = (
  institution: string,
  subject: string,
  totalQuestions: number
) => {
  return generatePrintableAnswerSheet(totalQuestions, institution, subject, 4);
};


import { OptionLetter, PreprocessSettings } from '../types';

/**
 * Image processing utilities for OMR sheets
 */

export interface ProcessedImageData {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  binarizedDataUrl: string;
  croppedOriginalUrl: string;
  width: number;
  height: number;
  detectedAngle: number;
}

/**
 * Load an image from a URL or base64
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('No se pudo cargar la imagen para procesamiento'));
    img.src = src;
  });
}

/**
 * Rotate and adjust contrast/brightness on an image canvas
 */
export async function preprocessImage(
  imageSource: string | HTMLImageElement,
  settings: PreprocessSettings,
  rotationDegrees: number = 0
): Promise<ProcessedImageData> {
  const img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del Canvas');

  // Handle rotation
  const rad = (rotationDegrees * Math.PI) / 180;
  const is90or270 = Math.abs(rotationDegrees) === 90 || Math.abs(rotationDegrees) === 270;
  
  const rotatedWidth = is90or270 ? img.height : img.width;
  const rotatedHeight = is90or270 ? img.width : img.height;

  // Calculate crop dimensions
  const cropTopPct = settings.cropTop || 0;
  const cropBottomPct = settings.cropBottom || 0;
  const cropLeftPct = settings.cropLeft || 0;
  const cropRightPct = settings.cropRight || 0;

  const startX = rotatedWidth * (cropLeftPct / 100);
  const startY = rotatedHeight * (cropTopPct / 100);
  const cropW = Math.max(1, rotatedWidth * (1 - (cropLeftPct + cropRightPct) / 100));
  const cropH = Math.max(1, rotatedHeight * (1 - (cropTopPct + cropBottomPct) / 100));

  // Draw rotated image to temporary canvas
  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = rotatedWidth;
  rotatedCanvas.height = rotatedHeight;
  const rCtx = rotatedCanvas.getContext('2d')!;
  rCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
  rCtx.rotate(rad);
  rCtx.drawImage(img, -img.width / 2, -img.height / 2);

  // Draw cropped image to main canvas
  canvas.width = cropW;
  canvas.height = cropH;
  ctx.drawImage(rotatedCanvas, startX, startY, cropW, cropH, 0, 0, cropW, cropH);

  // Capture the cropped original image before applying contrast
  // Quality set to 0.80 to keep base64 payload under Vercel's 4.5MB Serverless limit
  const croppedOriginalUrl = canvas.toDataURL('image/jpeg', 0.80);

  // Pixel manipulation: Brightness, Contrast & Grayscale
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imgData.data;
  
  const contrastFactor = (259 * (settings.contrast * 100 + 255)) / (255 * (259 - settings.contrast * 100));
  const brightnessOffset = settings.brightness * 128;

  // Create binarized canvas
  const binCanvas = document.createElement('canvas');
  binCanvas.width = canvas.width;
  binCanvas.height = canvas.height;
  const binCtx = binCanvas.getContext('2d', { willReadFrequently: true })!;
  const binImgData = binCtx.createImageData(canvas.width, canvas.height);
  const binPixels = binImgData.data;

  // Calculate Otsu threshold or use user setting
  let threshold = settings.threshold;
  if (threshold === 128) {
    threshold = calculateOtsuThreshold(pixels);
  }

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    // Grayscale (Luminance)
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Apply contrast and brightness
    gray = contrastFactor * (gray - 128) + 128 + brightnessOffset;
    gray = Math.max(0, Math.min(255, gray));
    
    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;

    // Binarize (White paper vs Dark marks)
    const isDark = gray < threshold;
    const binVal = isDark ? 0 : 255;
    
    binPixels[i] = binVal;
    binPixels[i + 1] = binVal;
    binPixels[i + 2] = binVal;
    binPixels[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  binCtx.putImageData(binImgData, 0, 0);

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    binarizedDataUrl: binCanvas.toDataURL('image/png'),
    croppedOriginalUrl,
    width: canvas.width,
    height: canvas.height,
    detectedAngle: 0,
  };
}

/**
 * Otsu's thresholding algorithm for automatic binarization
 */
function calculateOtsuThreshold(pixels: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0);
  const totalPixels = pixels.length / 4;

  for (let i = 0; i < pixels.length; i += 4) {
    const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    histogram[gray]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Calculate expected visual grid overlay positions for questions
 * Returns normalized bounding boxes for each question's bubbles (0.0 to 1.0)
 */
export interface BubbleCoordinates {
  questionNumber: number;
  colIndex: number;
  rowIndex: number;
  options: {
    letter: OptionLetter;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    radius: number; // percentage
  }[];
}

export function computeSheetOverlayCoordinates(
  totalQuestions: number = 30,
  optionsPerQuestion: number = 4,
  gridTop: number = 22, // % from top
  gridHeight: number = 72, // % of total height
  gridLeft: number = 6, // % from left
  gridWidth: number = 88, // % width available
  settings?: PreprocessSettings
): BubbleCoordinates[] {
  const letters: OptionLetter[] = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, optionsPerQuestion) as OptionLetter[];
  
  // Use configurable questions per column or fallback to standard logic
  const questionsPerColumn = settings?.questionsPerColumn 
    ? settings.questionsPerColumn 
    : (totalQuestions <= 20 ? 10 : totalQuestions <= 40 ? 10 : 25);
  const numColumns = Math.ceil(totalQuestions / questionsPerColumn);
  
  const coordinates: BubbleCoordinates[] = [];

  for (let q = 1; q <= totalQuestions; q++) {
    const colIndex = Math.floor((q - 1) / questionsPerColumn);
    const rowIndex = (q - 1) % questionsPerColumn;

    // Base settings vs overrides for this specific column
    const colOverride = settings?.sectionOverrides?.[colIndex] || {};
    
    // Width and height of the grid section for THIS column
    // The width available for *one* column is (gridWidth / numColumns) base
    // But if they override width, we use the override as the column's *own* width
    const baseColWidth = gridWidth / numColumns;
    const activeWidth = colOverride.width !== undefined ? colOverride.width : baseColWidth;
    
    const baseRowHeight = gridHeight / questionsPerColumn;
    const activeHeight = colOverride.height !== undefined ? colOverride.height / questionsPerColumn : baseRowHeight;

    // Start X and Y for this column
    const baseColX = gridLeft + colIndex * baseColWidth;
    const activeColX = colOverride.left !== undefined ? colOverride.left : baseColX;
    
    const baseTop = gridTop;
    const activeTop = colOverride.top !== undefined ? colOverride.top : baseTop;

    const colX = activeColX;
    const rowY = activeTop + rowIndex * activeHeight;
    
    const colWidth = activeWidth;
    const rowHeight = activeHeight;

    const bubbleOpts = letters.map((letter, optIdx) => {
      // Default: Offset after question number label (~25% of column for label, remaining 75% for bubbles a,b,c,d)
      const defaultLabelOffset = colWidth * 0.25;
      const defaultOptionSpacing = (colWidth * 0.75) / optionsPerQuestion;
      
      const labelOffset = colOverride.bubbleOffset !== undefined ? colOverride.bubbleOffset : defaultLabelOffset;
      const optionSpacing = colOverride.bubbleSpacing !== undefined ? colOverride.bubbleSpacing : defaultOptionSpacing;
      
      const optX = colX + labelOffset + (optIdx * optionSpacing) + (optionSpacing / 2);
      const optY = rowY + (rowHeight / 2);
      
      return {
        letter,
        x: optX,
        y: optY,
        radius: Math.min(colWidth, rowHeight) * 0.28,
      };
    });

    coordinates.push({
      questionNumber: q,
      colIndex,
      rowIndex,
      options: bubbleOpts,
    });
  }

  return coordinates;
}

/**
 * Local heuristic OMR scanner fallback for client-side evaluation
 */
export function scanBubblesLocally(
  canvas: HTMLCanvasElement,
  totalQuestions: number = 30,
  optionsPerQuestion: number = 4,
  settings?: PreprocessSettings
): Record<number, OptionLetter | 'MULTIPLE' | 'BLANK'> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return {};

  let gridTop = settings?.gridTop ?? 22;
  let gridLeft = settings?.gridLeft ?? 6;
  let gridWidth = settings?.gridWidth ?? 88;
  let gridHeight = settings?.gridHeight ?? 72;

  const width = canvas.width;
  const height = canvas.height;

  // Auto-detect if image is a cropped grid (aspect ratio > 0.8) instead of a full tall A4 page (aspect ratio ~0.7)
  // The user's cropped images still contain the 'Nombre del Estudiante' header which takes ~17% of the height.
  if (width > height * 0.8) {
    if (gridTop === 22) gridTop = 17;     // Header takes ~17%
    if (gridHeight === 72) gridHeight = 83; // Grid takes the rest
    if (gridLeft === 6) gridLeft = 2;    // Move to left
    if (gridWidth === 88) gridWidth = 96;   // Use full width
  }

  const overlayCoords = computeSheetOverlayCoordinates(
    totalQuestions, optionsPerQuestion, gridTop, gridHeight, gridLeft, gridWidth, settings
  );
  const results: Record<number, OptionLetter | 'MULTIPLE' | 'BLANK'> = {};

  for (const item of overlayCoords) {
    const densities: { letter: OptionLetter; darkness: number }[] = [];

    for (const opt of item.options) {
      const pixelX = Math.round((opt.x / 100) * width);
      const pixelY = Math.round((opt.y / 100) * height);
      const radiusPx = Math.round((opt.radius / 100) * Math.min(width, height));

      const boxSize = Math.max(4, radiusPx * 2);
      const startX = Math.max(0, pixelX - radiusPx);
      const startY = Math.max(0, pixelY - radiusPx);

      const sampleW = Math.min(boxSize, width - startX);
      const sampleH = Math.min(boxSize, height - startY);

      if (sampleW <= 0 || sampleH <= 0) continue;

      const imgData = ctx.getImageData(startX, startY, sampleW, sampleH);
      const data = imgData.data;
      
      let darkPixels = 0;
      let totalSampled = 0;

      for (let p = 0; p < data.length; p += 4) {
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        if (gray < 110) {
          darkPixels++;
        }
        totalSampled++;
      }

      const darknessRatio = totalSampled > 0 ? darkPixels / totalSampled : 0;
      densities.push({ letter: opt.letter, darkness: darknessRatio });
    }

    // Sort by darkness
    densities.sort((a, b) => b.darkness - a.darkness);

    const highest = densities[0];
    const secondHighest = densities[1];

    const DARKNESS_THRESHOLD = 0.32;
    const DIFFERENCE_MARGIN = 0.15;

    if (!highest || highest.darkness < DARKNESS_THRESHOLD) {
      results[item.questionNumber] = 'BLANK';
    } else if (secondHighest && secondHighest.darkness > DARKNESS_THRESHOLD && (highest.darkness - secondHighest.darkness) < DIFFERENCE_MARGIN) {
      results[item.questionNumber] = 'MULTIPLE';
    } else {
      results[item.questionNumber] = highest.letter;
    }
  }

  return results;
}

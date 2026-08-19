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
  imageSource: string | HTMLImageElement | HTMLCanvasElement,
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
  gridTop: number = 22,   // % from top where answer rows start
  gridHeight: number = 72, // % height of the full answer block
  gridLeft: number = 6,   // % from left where the answer block starts
  gridWidth: number = 88,  // % width of the full answer block
  settings?: PreprocessSettings
): BubbleCoordinates[] {
  const letters: OptionLetter[] = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, optionsPerQuestion) as OptionLetter[];

  const questionsPerColumn = settings?.questionsPerColumn ?? 10;
  const numColumns = Math.ceil(totalQuestions / questionsPerColumn);

  // Each "section" of the answer sheet has:
  //   - A narrow question-number label column (~20% of section width)
  //   - The remaining 80% divided equally among the bubbles (a, b, c, d)
  // labelFraction: what fraction of a section is taken by the Q# label
  const LABEL_FRACTION = 0.22; // 22% of section for the number, 78% for bubbles

  const coordinates: BubbleCoordinates[] = [];

  for (let q = 1; q <= totalQuestions; q++) {
    const colIndex = Math.floor((q - 1) / questionsPerColumn);
    const rowIndex = (q - 1) % questionsPerColumn;

    const colOverride = settings?.sectionOverrides?.[colIndex] ?? {};

    // --- Section box (the full section rectangle in % of image) ---
    const baseSectionWidth = gridWidth / numColumns;
    const sectionWidth   = colOverride.width  !== undefined ? colOverride.width  : baseSectionWidth;
    const sectionHeight  = colOverride.height !== undefined ? colOverride.height : gridHeight;
    const sectionLeft    = colOverride.left   !== undefined ? colOverride.left   : gridLeft + colIndex * baseSectionWidth;
    const sectionTop     = colOverride.top    !== undefined ? colOverride.top    : gridTop;

    // Row height within this section
    const rowHeight = sectionHeight / questionsPerColumn;

    // Y center of this row's bubbles
    const rowY = sectionTop + rowIndex * rowHeight + rowHeight * 0.5;

    // X: skip the label area, then space bubbles evenly
    const labelWidth  = colOverride.bubbleOffset  !== undefined ? colOverride.bubbleOffset  : sectionWidth * LABEL_FRACTION;
    const bubbleArea  = sectionWidth - labelWidth;
    const bubbleStep  = colOverride.bubbleSpacing !== undefined ? colOverride.bubbleSpacing : bubbleArea / optionsPerQuestion;
    const bubbleRadius = Math.min(sectionWidth / optionsPerQuestion, rowHeight) * 0.28;

    const bubbleOpts = letters.map((letter, optIdx) => {
      // Center of each bubble: sectionLeft + labelWidth + (optIdx + 0.5) * bubbleStep
      const optX = sectionLeft + labelWidth + (optIdx + 0.5) * bubbleStep;
      return {
        letter,
        x: optX,
        y: rowY,
        radius: bubbleRadius,
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

  const overlayCoords = computeSheetOverlayCoordinates(
    totalQuestions, optionsPerQuestion, gridTop, gridHeight, gridLeft, gridWidth, settings
  );
  const results: Record<number, OptionLetter | 'MULTIPLE' | 'BLANK'> = {};

  for (const item of overlayCoords) {
    const densities: { letter: OptionLetter; darkness: number }[] = [];

    for (const opt of item.options) {
      // Convert % positions to pixel coordinates
      const pixelX = Math.round((opt.x / 100) * width);
      const pixelY = Math.round((opt.y / 100) * height);

      // Radius in pixels: use width-based % since coordinates are in % of image width
      // Use a smaller radius (0.6) to ensure we ONLY sample the inside of the bubble and avoid the thick printed outlines
      const radiusPx = Math.max(3, Math.round((opt.radius / 100) * width * 0.6));

      const startX = Math.max(0, pixelX - radiusPx);
      const startY = Math.max(0, pixelY - radiusPx);
      const sampleW = Math.min(radiusPx * 2, width - startX);
      const sampleH = Math.min(radiusPx * 2, height - startY);

      if (sampleW <= 0 || sampleH <= 0) continue;

      const imgData = ctx.getImageData(startX, startY, sampleW, sampleH);
      const data = imgData.data;

      let darkPixels = 0;
      let totalSampled = 0;
      const cx = sampleW / 2;
      const cy = sampleH / 2;

      for (let py = 0; py < sampleH; py++) {
        for (let px = 0; px < sampleW; px++) {
          // Only sample pixels within the circular area
          const distSq = (px - cx) ** 2 + (py - cy) ** 2;
          if (distSq > (radiusPx * 0.9) ** 2) continue;

          const p = (py * sampleW + px) * 4;
          const gray = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
          if (gray < 128) darkPixels++;
          totalSampled++;
        }
      }

      if (totalSampled > 0) {
        densities.push({
          letter: opt.letter,
          darkness: darkPixels / totalSampled, // 0.0 to 1.0
        });
      }
    }

    if (densities.length === 0) {
      results[item.questionNumber] = 'BLANK';
      continue;
    }

    // Sort by darkness descending
    densities.sort((a, b) => b.darkness - a.darkness);
    const highest = densities[0];
    const others = densities.slice(1);
    const avgOthers = others.length > 0
      ? others.reduce((sum, d) => sum + d.darkness, 0) / others.length
      : 0;

    // --- Pure Relative Decision ---
    // A bubble is "clearly marked" if it is at least RELATIVE_FACTOR times darker
    // than the average of all the OTHER bubbles in the same row.
    const RELATIVE_FACTOR = 1.25;  // winner must be 25% darker than average of others
    const ABS_MIN = 0.05;          // winner must still be at least 5% dark (for faint pencil)
    const DOUBLE_GAP = 0.05;       // if top-2 are within 5% of each other → MULTIPLE

    const isWinnerDark = highest.darkness >= ABS_MIN;
    const isClearWinner = isWinnerDark && (avgOthers === 0 || highest.darkness >= avgOthers * RELATIVE_FACTOR);
    const secondHighest = densities[1];
    const isDoubleMarked = isClearWinner && secondHighest && secondHighest.darkness >= ABS_MIN
      && (highest.darkness - secondHighest.darkness) < DOUBLE_GAP;

    if (!isWinnerDark) {
      results[item.questionNumber] = 'BLANK';
    } else if (isDoubleMarked) {
      results[item.questionNumber] = 'MULTIPLE';
    } else if (isClearWinner) {
      results[item.questionNumber] = highest.letter;
    } else {
      // Winner exists but not clearly darker than neighbors → likely empty bubble outlines
      results[item.questionNumber] = 'BLANK';
    }
  }

  return results;
}

declare const cv: any;

/**
 * Attempt to automatically detect document boundaries and perspective warp it.
 * Uses OpenCV.js if available globally.
 */
export async function autoAlignDocument(imageSource: string | HTMLImageElement): Promise<{ alignedCanvas: HTMLCanvasElement | null, success: boolean }> {
  if (typeof cv === 'undefined') {
    console.warn("OpenCV.js is not loaded. Skipping auto-alignment.");
    return { alignedCanvas: null, success: false };
  }

  try {
    const img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { alignedCanvas: null, success: false };
    ctx.drawImage(img, 0, 0);

    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    
    // Blur to reduce noise
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    
    // Edge detection
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 75, 200);

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Find the largest quadrilateral (4 sides)
    let maxArea = 0;
    let bestApprox = new cv.Mat();
    let foundDoc = false;

    // We assume the document takes up at least 20% of the image
    const minArea = (img.width * img.height) * 0.2;

    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area > minArea) {
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        
        if (approx.rows === 4 && area > maxArea) {
          maxArea = area;
          approx.copyTo(bestApprox);
          foundDoc = true;
        }
        approx.delete();
      }
    }

    if (!foundDoc) {
      src.delete(); gray.delete(); blurred.delete(); edges.delete();
      contours.delete(); hierarchy.delete(); bestApprox.delete();
      return { alignedCanvas: null, success: false };
    }

    // Sort the 4 points (top-left, top-right, bottom-right, bottom-left)
    const points = [];
    for (let i = 0; i < 4; i++) {
      points.push({ x: bestApprox.data32S[i * 2], y: bestApprox.data32S[i * 2 + 1] });
    }
    
    // Top-left has smallest sum, Bottom-right has largest sum
    const sortedBySum = [...points].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    const tl = sortedBySum[0];
    const br = sortedBySum[3];
    
    // Top-right has smallest diff (y-x), Bottom-left has largest diff
    const remaining = [sortedBySum[1], sortedBySum[2]].sort((a, b) => (a.y - a.x) - (b.y - b.x));
    const tr = remaining[0];
    const bl = remaining[1];

    // Compute dimensions of the new image
    const widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
    const widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
    const maxWidth = Math.max(Math.round(widthA), Math.round(widthB));

    const heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
    const heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
    const maxHeight = Math.max(Math.round(heightA), Math.round(heightB));

    const srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
    ]);
    const dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0, maxWidth - 1, 0, maxWidth - 1, maxHeight - 1, 0, maxHeight - 1
    ]);

    const M = cv.getPerspectiveTransform(srcCoords, dstCoords);
    const warped = new cv.Mat();
    const dsize = new cv.Size(maxWidth, maxHeight);
    cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    const outCanvas = document.createElement('canvas');
    outCanvas.width = maxWidth;
    outCanvas.height = maxHeight;
    cv.imshow(outCanvas, warped);

    // Cleanup
    src.delete(); gray.delete(); blurred.delete(); edges.delete();
    contours.delete(); hierarchy.delete(); bestApprox.delete();
    srcCoords.delete(); dstCoords.delete(); M.delete(); warped.delete();

    return { alignedCanvas: outCanvas, success: true };
  } catch (err) {
    console.warn("OpenCV auto-alignment failed:", err);
    return { alignedCanvas: null, success: false };
  }
}



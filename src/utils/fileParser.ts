/**
 * Multi-format document and image loader
 * Supports JPG, PNG, WEBP, PDF, and DOCX (embedded images)
 */

export interface ParsedFilePage {
  fileName: string;
  originalName: string;
  pageNumber: number;
  totalPages: number;
  dataUrl: string;
  fileSize: number;
  fileType: string;
}

/**
 * Read standard image file to data URL
 */
export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Error al leer la imagen ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Render PDF pages to images using PDF.js or Canvas
 */
export async function parsePdfFile(file: File): Promise<ParsedFilePage[]> {
  try {
    const pdfjs = await import('pdfjs-dist');
    
    // Set worker src
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '4.10.38'}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const pages: ParsedFilePage[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // High res for OMR/OCR
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (ctx) {
        // Render PDF page into canvas
        // @ts-ignore
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        pages.push({
          fileName: `${file.name.replace(/\.pdf$/i, '')}_p${pageNum}.jpg`,
          originalName: file.name,
          pageNumber: pageNum,
          totalPages: pdf.numPages,
          dataUrl,
          fileSize: file.size,
          fileType: 'application/pdf',
        });
      }
    }

    return pages;
  } catch (error) {
    console.error('Error parsing PDF with pdfjs:', error);
    throw new Error(`No se pudo procesar el archivo PDF ${file.name}. Asegúrese de que sea un PDF válido.`);
  }
}

/**
 * Extract embedded images from DOCX files
 */
export async function parseDocxFile(file: File): Promise<ParsedFilePage[]> {
  try {
    // A docx file is a ZIP archive containing word/media/image1.png, etc.
    // We can use array buffer and inspect image signatures or extract media
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    
    // Check for PK zip header
    if (uint8[0] !== 0x50 || uint8[1] !== 0x4B) {
      throw new Error('El archivo DOCX no tiene un formato válido.');
    }

    const pages: ParsedFilePage[] = [];
    
    // Dynamic import mammoth to extract images or HTML
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const parser = new DOMParser();
      const doc = parser.parseFromString(result.value, 'text/html');
      const images = doc.querySelectorAll('img');

      if (images.length > 0) {
        images.forEach((img, idx) => {
          const src = img.getAttribute('src');
          if (src && src.startsWith('data:image')) {
            pages.push({
              fileName: `${file.name.replace(/\.docx?$/i, '')}_img${idx + 1}.jpg`,
              originalName: file.name,
              pageNumber: idx + 1,
              totalPages: images.length,
              dataUrl: src,
              fileSize: file.size,
              fileType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
          }
        });
      }
    } catch (mErr) {
      console.warn('Mammoth extraction fallback:', mErr);
    }

    if (pages.length === 0) {
      // Fallback: search for JPEG/PNG binary headers inside the zip payload
      const extracted = extractRawImagesFromZipBuffer(uint8, file.name, file.size);
      if (extracted.length > 0) {
        return extracted;
      }
      throw new Error(`No se encontraron imágenes escaneadas dentro del documento Word ${file.name}.`);
    }

    return pages;
  } catch (error: any) {
    console.error('Error parsing DOCX:', error);
    throw new Error(error.message || `Error al procesar el archivo Word ${file.name}`);
  }
}

/**
 * Fallback binary scanner for image magic numbers inside zip
 */
function extractRawImagesFromZipBuffer(bytes: Uint8Array, originalName: string, fileSize: number): ParsedFilePage[] {
  const pages: ParsedFilePage[] = [];
  let imageIndex = 1;

  for (let i = 0; i < bytes.length - 8; i++) {
    // Check JPEG SOI (0xFF, 0xD8, 0xFF)
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      // Look for EOI (0xFF, 0xD9)
      for (let j = i + 10; j < Math.min(bytes.length - 1, i + 15000000); j++) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          const jpegSlice = bytes.subarray(i, j + 2);
          const blob = new Blob([jpegSlice], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          pages.push({
            fileName: `${originalName}_scan${imageIndex}.jpg`,
            originalName,
            pageNumber: imageIndex,
            totalPages: 1,
            dataUrl: url,
            fileSize,
            fileType: 'image/jpeg',
          });
          imageIndex++;
          i = j + 2;
          break;
        }
      }
    }
  }

  return pages;
}

/**
 * Process any uploaded file (batch support)
 */
export async function parseUploadedFile(file: File): Promise<ParsedFilePage[]> {
  const lowerName = file.name.toLowerCase();
  
  if (lowerName.endsWith('.pdf')) {
    return parsePdfFile(file);
  }
  
  if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
    return parseDocxFile(file);
  }

  if (
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.bmp') ||
    file.type.startsWith('image/')
  ) {
    const dataUrl = await readImageFile(file);
    return [
      {
        fileName: file.name,
        originalName: file.name,
        pageNumber: 1,
        totalPages: 1,
        dataUrl,
        fileSize: file.size,
        fileType: file.type || 'image/jpeg',
      },
    ];
  }

  throw new Error(`Formato no soportado (${file.name}). Utilice PDF, DOCX, JPG, PNG o WEBP.`);
}

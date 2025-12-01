import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

/**
 * Get PDF metadata (page count, etc.)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<{pageCount: number}>}
 */
export const getPdfMetadata = async (pdfBuffer) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    return { pageCount };
  } catch (error) {
    console.error('Error getting PDF metadata:', error);
    throw new Error('Kon PDF metadata niet lezen');
  }
};

/**
 * Generate a placeholder cover image based on PDF dimensions
 * Note: Real cover rendering happens client-side with PDF.js
 * This creates a styled placeholder with the correct aspect ratio
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {Object} options - Options
 * @param {number} options.width - Output width (default 400)
 * @returns {Promise<Buffer>} - JPEG image buffer
 */
export const generateCoverImage = async (pdfBuffer, options = {}) => {
  const { width = 400 } = options;

  try {
    // Get page dimensions from pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const firstPage = pdfDoc.getPage(0);
    const { width: pageWidth, height: pageHeight } = firstPage.getSize();
    
    // Calculate height maintaining aspect ratio
    const height = Math.round((pageHeight / pageWidth) * width);
    
    // Create a gradient placeholder image
    // This will be replaced by actual PDF rendering on the client
    const svgImage = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f8fafc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e2e8f0;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
        <rect x="10%" y="15%" width="80%" height="3%" rx="4" fill="#cbd5e1"/>
        <rect x="10%" y="22%" width="60%" height="2%" rx="3" fill="#e2e8f0"/>
        <rect x="10%" y="28%" width="70%" height="2%" rx="3" fill="#e2e8f0"/>
        <g transform="translate(${width/2 - 30}, ${height/2 - 30})">
          <rect width="60" height="80" rx="4" fill="#cbd5e1"/>
          <rect x="5" y="5" width="25" height="70" rx="2" fill="#e2e8f0"/>
          <rect x="32" y="5" width="23" height="70" rx="2" fill="#f1f5f9"/>
        </g>
      </svg>
    `;
    
    const coverBuffer = await sharp(Buffer.from(svgImage))
      .jpeg({ quality: 90 })
      .toBuffer();
    
    return coverBuffer;
  } catch (error) {
    console.error('Error generating cover image:', error);
    
    // Ultimate fallback: simple gray placeholder
    const fallbackBuffer = await sharp({
      create: {
        width: 400,
        height: 566, // A4 aspect ratio
        channels: 3,
        background: { r: 241, g: 245, b: 249 }
      }
    })
    .jpeg({ quality: 85 })
    .toBuffer();
    
    return fallbackBuffer;
  }
};

/**
 * Validate PDF file
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<boolean>}
 */
export const validatePdf = async (buffer) => {
  try {
    // Check magic bytes for PDF
    const header = buffer.slice(0, 5).toString();
    if (header !== '%PDF-') {
      return false;
    }
    
    // Try to load with pdf-lib to validate structure
    await PDFDocument.load(buffer);
    return true;
  } catch (error) {
    console.error('PDF validation failed:', error);
    return false;
  }
};

export default {
  getPdfMetadata,
  generateCoverImage,
  validatePdf
};

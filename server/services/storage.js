import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Initialize S3 client (works with AWS S3, Cloudflare R2, Bunny, etc.)
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || ''
  },
  forcePathStyle: true // Required for some S3-compatible services
});

const BUCKET = process.env.S3_BUCKET || 'pdf-flipbook';
const PUBLIC_URL = process.env.STORAGE_PUBLIC_URL || '';

/**
 * Upload a file to S3/R2 storage
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} contentType - MIME type
 * @param {string} folder - Folder path (e.g., 'pdfs' or 'covers')
 * @returns {Promise<{key: string, url: string}>}
 */
export const uploadFile = async (buffer, originalName, contentType, folder = 'uploads') => {
  const ext = path.extname(originalName);
  const key = `${folder}/${uuidv4()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read'
  });

  await s3Client.send(command);

  // Construct public URL
  const url = PUBLIC_URL 
    ? `${PUBLIC_URL}/${key}`
    : `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;

  return { key, url };
};

/**
 * Delete a file from S3/R2 storage
 * @param {string} key - File key/path
 */
export const deleteFile = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key
  });

  await s3Client.send(command);
};

/**
 * Extract key from URL
 * @param {string} url - Full URL
 * @returns {string} - Key
 */
export const getKeyFromUrl = (url) => {
  if (!url) return null;
  
  // Try to extract key from URL
  if (PUBLIC_URL && url.startsWith(PUBLIC_URL)) {
    return url.replace(`${PUBLIC_URL}/`, '');
  }
  
  // Fallback: get everything after the bucket name
  const parts = url.split('/');
  const bucketIndex = parts.findIndex(p => p === BUCKET);
  if (bucketIndex !== -1) {
    return parts.slice(bucketIndex + 1).join('/');
  }
  
  return null;
};

export default {
  uploadFile,
  deleteFile,
  getKeyFromUrl
};

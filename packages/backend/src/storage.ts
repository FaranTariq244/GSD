import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import sharp from 'sharp';

// S3-compatible storage client (works with AWS S3, MinIO, Cloudflare R2, etc.)
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000', // MinIO default
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'gsd-attachments';

/**
 * Generate a unique storage key for a file
 */
export function generateStorageKey(originalFilename: string): string {
  const ext = originalFilename.split('.').pop() || '';
  const randomId = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${randomId}.${ext}`;
}

/**
 * Upload a file to S3-compatible storage
 */
export async function uploadFile(buffer: Buffer, storageKey: string, mimeType: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
}

/**
 * Get a presigned URL for downloading a file (valid for 1 hour)
 */
export async function getDownloadUrl(storageKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Delete a file from storage
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
  });

  await s3Client.send(command);
}

/**
 * Generate a thumbnail for an image file
 * Returns the thumbnail buffer and storage key, or null if not an image
 */
export async function generateThumbnail(
  buffer: Buffer,
  originalStorageKey: string,
  mimeType: string
): Promise<{ buffer: Buffer; storageKey: string } | null> {
  // Only generate thumbnails for images
  if (!mimeType.startsWith('image/')) {
    return null;
  }

  try {
    // Generate 200px width thumbnail (maintains aspect ratio)
    const thumbnailBuffer = await sharp(buffer)
      .resize(200, null, {
        withoutEnlargement: true, // Don't upscale small images
        fit: 'inside',
      })
      .jpeg({ quality: 80 }) // Convert to JPEG for consistent format and compression
      .toBuffer();

    // Generate storage key for thumbnail (add 'thumb-' prefix)
    const thumbnailKey = `thumb-${originalStorageKey}`;

    return { buffer: thumbnailBuffer, storageKey: thumbnailKey };
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
}

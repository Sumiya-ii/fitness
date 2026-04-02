import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';

function createClient(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          },
        }
      : {}),
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
  });
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  const client = createClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    }),
  );
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

export async function deleteFromS3(key: string): Promise<void> {
  try {
    const client = createClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
      }),
    );
  } catch {
    // Best-effort cleanup — log but don't fail the job
    console.warn(`[S3] Failed to delete object: ${key}`);
  }
}

export async function uploadToS3(key: string, buffer: Buffer, contentType: string): Promise<void> {
  const client = createClient();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

export async function getPresignedUrl(key: string, expiresInSeconds: number): Promise<string> {
  const client = createClient();
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

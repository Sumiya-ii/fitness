import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '../config';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(config: ConfigService) {
    const bucket = config.get('S3_BUCKET');
    const region = config.get('S3_REGION');
    const accessKeyId = config.get('S3_ACCESS_KEY_ID');
    const secretAccessKey = config.get('S3_SECRET_ACCESS_KEY');
    const endpoint = config.get('S3_ENDPOINT');

    this.bucket = bucket;

    if (bucket && region) {
      this.client = new S3Client({
        region,
        ...(accessKeyId && secretAccessKey
          ? { credentials: { accessKeyId, secretAccessKey } }
          : {}),
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });
    } else {
      this.logger.warn('S3 not configured — audio will be stored in BullMQ job (dev mode only)');
      this.client = null;
    }
  }

  get isConfigured(): boolean {
    return this.client !== null && !!this.bucket;
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    if (!this.client || !this.bucket) {
      throw new Error('S3 is not configured');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async ping(): Promise<{ ok: boolean; bucket: string | undefined; error?: string }> {
    if (!this.client || !this.bucket) {
      return {
        ok: false,
        bucket: this.bucket,
        error: 'S3 not configured (missing S3_BUCKET or S3_REGION)',
      };
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { ok: true, bucket: this.bucket };
    } catch (err) {
      return { ok: false, bucket: this.bucket, error: String(err) };
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client || !this.bucket) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to delete S3 object ${key}: ${String(err)}`);
    }
  }
}

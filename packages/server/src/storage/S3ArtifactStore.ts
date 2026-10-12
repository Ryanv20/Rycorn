import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const client = new S3Client({});

export class S3ArtifactStore {
  async putJson(prefix: string, value: unknown): Promise<{ bucket: string; key: string; eTag?: string }> {
    const bucket = process.env.RYCORN_S3_BUCKET?.trim();
    if (!bucket) throw new Error('RYCORN_S3_BUCKET is not configured');

    const normalizedPrefix = prefix.split('/').filter(Boolean).join('/');
    const date = new Date().toISOString().slice(0, 10);
    const key = [normalizedPrefix, date, `${randomUUID()}.json`].filter(Boolean).join('/');
    const response = await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value),
      ContentType: 'application/json; charset=utf-8',
    }));

    return { bucket, key, eTag: response.ETag };
  }
}

export const s3ArtifactStore = new S3ArtifactStore();

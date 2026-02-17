import { S3Client } from '@aws-sdk/client-s3';
import { MINIO_ENDPOINT, MINIO_ROOT_PASSWORD, MINIO_ROOT_USER } from './constants';

export const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: MINIO_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: MINIO_ROOT_USER,
    secretAccessKey: MINIO_ROOT_PASSWORD,
  },
});

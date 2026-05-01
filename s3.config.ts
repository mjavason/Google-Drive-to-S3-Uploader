import { S3Client } from '@aws-sdk/client-s3';
import { S3_ENDPOINT, S3_REGION, S3_ROOT_PASSWORD, S3_ROOT_USER } from './constants';

export const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: S3_ROOT_USER,
    secretAccessKey: S3_ROOT_PASSWORD,
  },
});

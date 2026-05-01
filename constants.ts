import dotenv from 'dotenv';

dotenv.config({
  path: './.env',
});

export const PORT = process.env.PORT || 5000;
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
export const SampleGDriveFileId = '1DGG6D0fvLgLfH7KcaW_IC66mxcZ7VzuG';

export const S3_ROOT_USER = process.env.S3_ROOT_USER || 'dev';
export const S3_ROOT_PASSWORD = process.env.S3_ROOT_PASSWORD || 'dev-minio';
export const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
export const S3_BUCKET = process.env.S3_BUCKET || 'startup';
export const S3_REGION = process.env.S3_REGION || 'us-east-1';
export const S3_BUCKET_NAME = 'direct-gdrive-uploads';

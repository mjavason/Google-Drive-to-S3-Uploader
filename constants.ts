import dotenv from 'dotenv';

dotenv.config({
  path: './.env',
});

export const PORT = process.env.PORT || 5000;
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
export const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER || 'dev';
export const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD || 'dev-minio1';
export const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'direct-gdrive-uploads';

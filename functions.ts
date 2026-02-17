import { Upload } from '@aws-sdk/lib-storage';
import axios from 'axios';
import { google } from 'googleapis';
import { MINIO_BUCKET_NAME, MINIO_ENDPOINT } from './constants';
import { s3 } from './s3.config';

export async function transferDriveFileToS3(driveAccessToken: string, fileId: string) {
  console.log('[TRANSFER] Starting Drive → S3 transfer');
  console.log(`[TRANSFER] FileId: ${fileId}`);

  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: driveAccessToken });

  console.log('[TRANSFER] OAuth credentials set');

  const drive = google.drive({ version: 'v3', auth: oauth });

  console.log('[TRANSFER] Fetching file metadata from Google Drive');

  const fileMeta = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType',
  });

  const fileName = fileMeta.data.name || fileId;
  console.log(`[TRANSFER] Original file name: ${fileName}`);

  console.log('[TRANSFER] Requesting file stream from Google Drive');

  const driveResponse = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

  console.log('[TRANSFER] Drive stream received');

  const day = new Date().getDate();
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const datePath = `${year}/${month}/${day}`;

  const key = `${datePath}/${fileName}`;
  console.log(`[TRANSFER] S3 destination key: ${key}`);

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: MINIO_BUCKET_NAME,
      Key: key,
      Body: driveResponse.data,
    },
  });

  upload.on('httpUploadProgress', (progress) => {
    console.log(
      `[TRANSFER] Upload progress: ${progress.loaded}/${progress.total || 'unknown'} bytes`,
    );
  });

  console.log('[TRANSFER] S3 multipart upload initiated');

  try {
    await upload.done();
    console.log('[TRANSFER] Upload completed successfully');
    return { fileUrl: `${MINIO_ENDPOINT}/${MINIO_BUCKET_NAME}/${key}` };
  } catch (err) {
    console.error('[TRANSFER] Upload failed:', err);
  }
}

export async function pingSelf(url: string) {
  try {
    const { data } = await axios.get(url);
    console.log(`Server pinged successfully: ${data.message}`);
    return true;
  } catch (e: any) {
    console.error(`Error pinging server: ${e.message}`);
    return false;
  }
}

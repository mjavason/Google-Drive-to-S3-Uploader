import { PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import { google } from 'googleapis';
import { PassThrough } from 'stream';
import { s3 } from './s3.config';

export async function transferDriveFileToS3(
  driveAccessToken: string,
  fileId: string,
): Promise<void> {
  console.log('[TRANSFER] Starting Drive → S3 transfer');
  console.log(`[TRANSFER] FileId: ${fileId}`);

  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: driveAccessToken });

  console.log('[TRANSFER] OAuth credentials set');

  const drive = google.drive({ version: 'v3', auth: oauth });

  console.log('[TRANSFER] Requesting file stream from Google Drive');

  const driveResponse = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

  console.log('[TRANSFER] Drive stream received');

  const stream = new PassThrough();

  const day = new Date().getDate();
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const datePath = `${year}/${month}/${day}`;

  const key = `${datePath}/${fileId}`;

  console.log(`[TRANSFER] S3 destination key: ${key}`);

  const uploadPromise = s3.send(
    new PutObjectCommand({
      Bucket: 'direct-gdrive-uploads',
      Key: key,
      Body: stream,
    }),
  );

  console.log('[TRANSFER] S3 upload initiated');

  driveResponse.data.on('error', (err) => {
    console.error('[TRANSFER] Drive stream error:', err);
  });

  stream.on('error', (err) => {
    console.error('[TRANSFER] PassThrough stream error:', err);
  });

  driveResponse.data.pipe(stream);

  console.log('[TRANSFER] Piping Drive → S3');

  await uploadPromise;

  console.log('[TRANSFER] Upload completed successfully');
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

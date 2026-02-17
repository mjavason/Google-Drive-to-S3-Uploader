import { Upload } from '@aws-sdk/lib-storage';
import { google } from 'googleapis';
import { s3 } from './s3.config';
import axios from 'axios';

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

  const day = new Date().getDate();
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const datePath = `${year}/${month}/${day}`;

  const key = `${datePath}/${fileId}`;

  console.log(`[TRANSFER] S3 destination key: ${key}`);

  // Use multipart Upload for unknown-length streams
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: 'direct-gdrive-uploads',
      Key: key,
      Body: driveResponse.data, // stream directly
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
  } catch (err) {
    console.error('[TRANSFER] Upload failed:', err);
    throw err;
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

import { Upload } from '@aws-sdk/lib-storage';
import axios from 'axios';
import { google } from 'googleapis';
import { S3_BUCKET_NAME, S3_ENDPOINT, SampleGDriveFileId } from './constants';
import { s3 } from './s3.config';
import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

export async function transferDriveFileToS3(
  driveAccessToken: string,
  fileId: string = SampleGDriveFileId,
) {
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
      Bucket: S3_BUCKET_NAME,
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
    return { fileUrl: `${S3_ENDPOINT}/${S3_BUCKET_NAME}/${key}` };
  } catch (err) {
    console.error('[TRANSFER] Upload failed:', err);
  }
}

export function extractDriveFileId(url: string): string {
  // Matches common Google Drive URL formats
  const match = url.match(/(?:\/d\/|id=)([-\w]{25,})/);

  if (!match || !match[1]) {
    throw new Error('Invalid Google Drive URL');
  }

  console.log(`[UTIL] Extracted file ID: ${match[1]} from URL: ${url}`);
  return match[1];
}

export async function getMimeType(ext: string): Promise<string> {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export async function ensureBucketExists(bucket: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err: any) {
    if (err.$metadata?.httpStatusCode === 404) {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } else {
      throw err;
    }
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

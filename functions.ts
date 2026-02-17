import { PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import { google } from 'googleapis';
import { PassThrough } from 'stream';
import { s3 } from './s3.config';

export async function transferDriveFileToS3(
  driveAccessToken: string,
  fileId: string,
): Promise<void> {
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: driveAccessToken });

  const drive = google.drive({ version: 'v3', auth: oauth });
  const driveResponse = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

  const stream = new PassThrough();

  const day = new Date().getDate();
  const month = new Date().getMonth() + 1; // Months are zero-indexed
  const year = new Date().getFullYear();
  const datePath = `${year}/${month}/${day}`;

  const uploadPromise = s3.send(
    new PutObjectCommand({
      Bucket: 'direct-gdrive-uploads',
      Key: `${datePath}/${fileId}`,
      Body: stream,
    }),
  );

  driveResponse.data.pipe(stream);

  await uploadPromise;
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

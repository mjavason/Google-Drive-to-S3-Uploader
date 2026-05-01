import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import axios from 'axios';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import 'express-async-errors';
import morgan from 'morgan';
import { BASE_URL, PORT, S3_BUCKET } from './constants';
import { ensureBucketExists, extractDriveFileId, transferDriveFileToS3 } from './functions';
import { s3 } from './s3.config';
import { setupSwagger } from './swagger.config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';

//#region App Setup
const app = express();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  }),
);
app.use(cors());
app.use(morgan('dev'));
setupSwagger(app, BASE_URL);

//#endregion App Setup

//#region Code here

/**
 * @swagger
 * /multipart/init:
 *   post:
 *    summary: Initialize a multipart upload
 *    description: Initializes a multipart upload and returns the upload ID and key for the file to be uploaded
 *    tags: [Multipart Upload]
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              fileName:
 *                type: string
 *              contentType:
 *                type: string
 *    responses:
 *      '200':
 *        description: Multipart upload initialized successfully
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                uploadId:
 *                  type: string
 *                key:
 *                  type: string
 */
app.post('/multipart/init', async (req, res) => {
  const { fileName, contentType } = req.body;

  try {
    await ensureBucketExists(S3_BUCKET);

    const Key = `uploads/${uuid()}-${fileName}`;

    const cmd = new CreateMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key,
      ContentType: contentType,
    });

    const out = await s3.send(cmd);

    res.json({
      message: 'Multipart upload initialized successfully',
      uploadId: out.UploadId,
      key: Key,
    });
  } catch (e: any) {
    console.error('Error initializing multipart upload:', e.message);
    res.status(500).json({
      message: 'Failed to initialize multipart upload',
    });
  }
});

/**
 * @swagger
 * /multipart/sign:
 *   post:
 *     summary: Get signed URLs for multipart upload
 *     description: Returns signed URLs for each part of a multipart upload
 *     tags: [Multipart Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               uploadId:
 *                 type: string
 *               parts:
 *                 type: integer
 *     responses:
 *       '200':
 *         description: Signed URLs generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       partNumber:
 *                         type: integer
 *                       url:
 *                         type: string
 */
app.post('/multipart/sign', async (req, res) => {
  const { key, uploadId, parts } = req.body;

  if (!key || !uploadId || !parts) {
    return res.status(400).json({
      error: 'Missing required fields',
      received: req.body,
    });
  }

  const urls = [];

  for (let partNumber = 1; partNumber <= parts; partNumber++) {
    const cmd = new UploadPartCommand({
      Bucket: S3_BUCKET,
      Key: key, // must be defined
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 60 * 2 }); // URL valid for 2 hours
    urls.push({ partNumber, url });
  }

  res.json({ urls });
});

/**
 * @swagger
 * /multipart/complete:
 *   post:
 *     summary: Complete a multipart upload
 *     description: Completes a multipart upload by assembling previously uploaded parts
 *     tags: [Multipart Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               uploadId:
 *                 type: string
 *               parts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ETag:
 *                       type: string
 *                     PartNumber:
 *                       type: integer
 *     responses:
 *       '200':
 *         description: Multipart upload completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 location:
 *                   type: string
 */
app.post('/multipart/complete', async (req, res) => {
  const { key, uploadId, parts } = req.body as {
    key: string;
    uploadId: string;
    parts: { ETag: string; PartNumber: number }[];
  };

  const cmd = new CompleteMultipartUploadCommand({
    Bucket: S3_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
    },
  });

  const out = await s3.send(cmd);

  res.json({ location: out.Location });
});

/**
 * @swagger
 * /transfer:
 *   post:
 *    summary: Transfer a file from GDrive to S3 (for testing purposes - in production, this would likely be triggered by a pub/sub event or similar)
 *    description: Transfer a file from GDrive to S3 (for testing purposes - in production, this would likely be triggered by a pub/sub event or similar)
 *    tags: [Transfer]
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              driveAccessToken:
 *                type: string
 *                description: The access token for Google Drive
 *              fileUrl:
 *                type: string
 *                description: The URL of the file to upload. Retrieve it by sharing the file in Google Drive and copying the link. If not provided, a default sample file will be used.
 *            required:
 *              - driveAccessToken
 *    responses:
 *      '200':
 *        description: Successful.
 *      '400':
 *        description: Bad request.
 *      '500':
 *        description: Failed to upload file.
 */
app.post('/transfer', async (req: Request, res: Response) => {
  const { driveAccessToken, fileUrl } = req.body;

  if (!driveAccessToken) {
    return res.status(400).send({
      success: false,
      message: 'driveAccessToken is required',
    });
  }

  try {
    const fileId = fileUrl ? extractDriveFileId(fileUrl) : undefined;
    const data = await transferDriveFileToS3(driveAccessToken, fileId);
    return res.send({
      success: true,
      message: 'File uploaded successfully',
      fileUrl: data?.fileUrl,
    });
  } catch (error: any) {
    console.error('Error uploading file:', error.message);
    return res.status(500).send({
      success: false,
      message: 'Failed to upload file',
    });
  }
});

//#endregion

//#region Server Setup

/**
 * @swagger
 * /api:
 *   get:
 *     summary: Call a demo external API (httpbin.org)
 *     description: Returns an object containing demo content
 *     tags: [Default]
 *     responses:
 *       '200':
 *         description: Successful.
 *       '400':
 *         description: Bad request.
 */
app.get('/api', async (req: Request, res: Response) => {
  try {
    const result = await axios.get('https://httpbin.org');
    return res.send({
      message: 'Demo API called (httpbin.org)',
      data: result.status,
    });
  } catch (error: any) {
    console.error('Error calling external API:', error.message);
    return res.status(500).send({
      error: 'Failed to call external API',
    });
  }
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: API Health check
 *     description: Returns an object containing demo content
 *     tags: [Default]
 *     responses:
 *       '200':
 *         description: Successful.
 *       '400':
 *         description: Bad request.
 */
app.get('/', (req: Request, res: Response) => {
  return res.send({
    message: 'API is Live!',
  });
});

/**
 * @swagger
 * /obviously/this/route/cant/exist:
 *   get:
 *     summary: API 404 Response
 *     description: Returns a non-crashing result when you try to run a route that doesn't exist
 *     tags: [Default]
 *     responses:
 *       '404':
 *         description: Route not found
 */
app.use((req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    message: 'API route does not exist',
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // throw Error('This is a sample error');
  console.log(`${'\x1b[31m'}`); // start color red
  console.log(`${err.message}`);
  console.log(`${'\x1b][0m]'}`); //stop color

  return res.status(500).send({
    success: false,
    status: 500,
    message: err.message,
  });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
});

// (for render services) Keep the API awake by pinging it periodically
// setInterval(pingSelf(BASE_URL), 600000);

//#endregion

import axios from 'axios';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import 'express-async-errors';
import morgan from 'morgan';
import { BASE_URL, PORT } from './constants';
import { transferDriveFileToS3 } from './functions';
import { setupSwagger } from './swagger.config';

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
// route to upload a file from GDrive to S3 (for testing purposes - in production, this would likely be triggered by a pub/sub event or similar)
// driveAccessToken: string,
// fileId: string,

/**
 * @swagger
 * /upload:
 *   post:
 *    summary: Upload a file from GDrive to S3 (for testing purposes - in production, this would likely be triggered by a pub/sub event or similar)
 *    description: Upload a file from GDrive to S3 (for testing purposes - in production, this would likely be triggered by a pub/sub event or similar)
 *    tags: [Default]
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
 *              fileId:
 *                type: string
 *                description: The ID of the file to upload
 *            required:
 *              - driveAccessToken
 *              - fileId
 *    responses:
 *      '200':
 *        description: Successful.
 *      '400':
 *        description: Bad request.
 *      '500':
 *        description: Failed to upload file.
 */
app.post('/upload', async (req: Request, res: Response) => {
  const { driveAccessToken, fileId } = req.body;
  if (!driveAccessToken || !fileId) {
    return res.status(400).send({
      success: false,
      message: 'driveAccessToken and fileId are required',
    });
  }

  try {
    await transferDriveFileToS3(driveAccessToken, fileId);
    return res.send({
      success: true,
      message: 'File uploaded successfully',
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

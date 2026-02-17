import { Express } from 'express';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

export function setupSwagger(app: Express, url: string) {
  const SWAGGER_OPTIONS = {
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: 'GDrive to S3 Transfer Service',
        version: '1.0.1',
        description:
          'This service provides an endpoint to transfer files from Google Drive to S3. It is designed for testing purposes and can be triggered by a pub/sub event or similar in production.',
        contact: {
          name: 'Orji Michael',
          email: 'orjimichael4886@gmail.com',
        },
      },
      servers: [
        {
          url,
        },
      ],
    },
    apis: ['**/*.ts'],
  };
  const swaggerSpec = swaggerJSDoc(SWAGGER_OPTIONS);

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

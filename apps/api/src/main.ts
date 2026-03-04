import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { API_PREFIX } from '@coach/shared';
import { ConfigService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.port;

  if (!config.isProduction) {
    const documentBuilder = new DocumentBuilder()
      .setTitle('Coach API')
      .setDescription('AI nutrition coaching app backend')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, documentBuilder);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  console.log(`Coach API running on port ${port}`);
}
bootstrap();

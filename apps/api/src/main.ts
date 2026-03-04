import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { API_PREFIX } from '@coach/shared';
import { ConfigService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.port;

  await app.listen(port);
  console.log(`Coach API running on port ${port}`);
}
bootstrap();

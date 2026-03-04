import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseProvider } from './firebase.provider';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Global()
@Module({
  providers: [
    FirebaseProvider,
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [FirebaseProvider, AuthService],
})
export class AuthModule {}

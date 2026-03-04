import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '../config';

@Injectable()
export class FirebaseProvider implements OnModuleInit {
  private app!: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get('FIREBASE_PRIVATE_KEY');

    const credential =
      clientEmail && privateKey
        ? admin.credential.cert({ projectId, clientEmail, privateKey })
        : admin.credential.applicationDefault();

    this.app = admin.initializeApp({ credential, projectId });
  }

  get auth(): admin.auth.Auth {
    return this.app.auth();
  }

  async verifyToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return this.auth.verifyIdToken(idToken);
  }
}

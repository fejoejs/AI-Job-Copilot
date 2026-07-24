import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { initializeFirebaseAdmin } from './firebase.admin';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor() {
    initializeFirebaseAdmin();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('A valid Firebase access token is required');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      
      // Bind firebase uid to request
      request.user = decodedToken;
      return true;
    } catch (error) {
      console.error('Firebase JWT Verification failed:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

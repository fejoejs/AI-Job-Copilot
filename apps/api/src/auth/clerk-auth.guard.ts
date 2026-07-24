import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private client: jwksClient.JwksClient;

  constructor() {
    const jwksUri = process.env.CLERK_JWKS_URL || 'https://api.clerk.com/v1/jwks';
    this.client = jwksClient({
      jwksUri,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  private getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
    if (!header.kid) {
      return callback(new Error('No kid found in JWT header'));
    }
    this.client.getSigningKey(header.kid, (err: Error | null, key?: jwksClient.SigningKey) => {
      if (err) {
        return callback(err);
      }
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('A valid Clerk access token is required');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = await new Promise<jwt.JwtPayload | string>((resolve, reject) => {
        jwt.verify(
          token,
          this.getKey.bind(this),
          { algorithms: ['RS256'] },
          (err: Error | null, decodedToken: any) => {
            if (err || !decodedToken) {
              reject(err || new Error('Invalid token'));
            } else {
              resolve(decodedToken);
            }
          },
        );
      });

      // Bind clerk userId (which is in the 'sub' field) and details to request
      request.user = decoded;
      return true;
    } catch (error) {
      console.error('JWT Verification failed:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

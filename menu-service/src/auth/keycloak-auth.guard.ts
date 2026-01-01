import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'];

    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = auth.substring('Bearer '.length);

    const public_key = `-----BEGIN PUBLIC KEY-----\n${process.env.KC_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;

    const issuer = process.env.KC_ISSUER;

    try {
      const decoded = jwt.verify(token, public_key, {
        algorithms: ['RS256'],
      }) as any;

      req.user = {
        sub: decoded.sub,
        email: decoded.email,
        roles: decoded?.realm_access?.roles || [],
      };

      return true;
    } catch (e) {
      // console.error('JWT verify error', e);
      throw new UnauthorizedException('Invalid token');
    }
  }
}

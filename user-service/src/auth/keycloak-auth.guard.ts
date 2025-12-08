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
    const auth = req.headers['authorization'] as string | undefined;

    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = auth.substring('Bearer '.length);
    const publicKey = this.config.get<string>('KC_PUBLIC_KEY');
    const issuer = this.config.get<string>('KC_ISSUER');

    try {
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer,
      }) as any;

      const roles: string[] = decoded?.realm_access?.roles || [];

      req.user = {
        sub: decoded.sub,
        email: decoded.email || decoded.preferred_username,
        roles,
      };

      return true;
    } catch (e) {
      console.error('JWT verify error', e);
      throw new UnauthorizedException('Invalid token');
    }
  }
}

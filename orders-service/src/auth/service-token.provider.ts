import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CachedToken = { token: string; exp: number };

@Injectable()
export class ServiceTokenProvider {
  private cache: CachedToken | null = null;

  constructor(private readonly config: ConfigService) {}

  private decodeExp(token: string): number {
    const payloadB64 = token.split('.')[1];
    const json = Buffer.from(payloadB64, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload.exp ?? 0;
  }

  async getServiceToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cache && this.cache.exp - now > 30) {
      return this.cache.token;
    }

    const kcBase = this.config.get<string>('KC_BASE_URL');  
    const realm = this.config.get<string>('KC_REALM');      
    const clientId = this.config.get<string>('KC_CLIENT_ID'); 
    const clientSecret = this.config.get<string>('KC_CLIENT_SECRET');

    if (!kcBase || !realm || !clientId || !clientSecret) {
      throw new Error('Missing KC_* env vars for service token');
    }

    const tokenUrl = `${kcBase}/realms/${realm}/protocol/openid-connect/token`;

    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get service token: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { access_token: string };
    const token = data.access_token;

    this.cache = { token, exp: this.decodeExp(token) };
    return token;
  }
}

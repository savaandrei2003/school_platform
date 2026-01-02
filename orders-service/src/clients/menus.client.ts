import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceTokenProvider } from '../auth/service-token.provider';

type ValidateOrderRequest = {
  date: string;
  choices: any;
};

type ValidateOrderResponse = {
  ok: boolean;
  menuId?: string;
  snapshot?: any;
  errors?: string[];
};

@Injectable()
export class MenusClient {
  private baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly serviceToken: ServiceTokenProvider,
  ) {
    this.baseUrl = this.config.get<string>('MENUS_SERVICE_URL') || 'http://menu-service:3001';
  }

  async validateOrder(dto: ValidateOrderRequest): Promise<ValidateOrderResponse> {
    const token = await this.serviceToken.getServiceToken(); // <--- AICI

    const res = await fetch(`${this.baseUrl}/menus/internal/validate-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`, // <--- ȘI AICI
      },
      body: JSON.stringify(dto),
    });

    const data = (await res.json()) as ValidateOrderResponse;

    if (!res.ok || !data.ok) {
      throw new BadRequestException({
        message: 'Menu validation failed',
        details: data?.errors ?? [],
      });
    }

    return data;
  }
}

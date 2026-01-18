import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersClient {
  private baseUrl: string;

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get<string>('USERS_SERVICE_URL') || 'http://user-service:3000';
  }

  async assertChildBelongsToParent(childId: string, accessToken: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/users/children`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new ForbiddenException('Cannot verify child ownership');

    const children = (await res.json()) as Array<{ id: string }>;
    const ok = children.some((c) => c.id === childId);
    if (!ok) throw new ForbiddenException('Child does not belong to this parent');
  }
}

import { SetMetadata } from '@nestjs/common';
import { API_KEY_SCOPES } from '../guards/api-key-auth.guard';

export const RequireScopes = (...scopes: string[]) =>
  SetMetadata(API_KEY_SCOPES, scopes);

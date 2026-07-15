import { Profile } from '@clickbit/shared';

declare module 'express' {
  interface Request {
    user?: Profile;
    serviceToken?: unknown;
  }
}

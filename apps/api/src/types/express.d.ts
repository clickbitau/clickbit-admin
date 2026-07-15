import { Profile } from '@clickbit/shared';

declare global {
  namespace Express {
    interface Request {
      user?: Profile;
      serviceToken?: unknown;
    }
  }
}

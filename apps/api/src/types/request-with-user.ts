import { Request } from 'express';
import { Profile } from '@clickbit/shared';

export interface RequestWithUser extends Request {
  user: Profile;
}

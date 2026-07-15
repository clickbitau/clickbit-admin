import { Profile } from '@clickbit/shared';

declare global {
  namespace Express {
    interface Request {
      user?: Profile;
      serviceToken?: unknown;
    }

    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination?: string;
        filename?: string;
        path?: string;
        buffer: Buffer;
      }
    }
  }
}

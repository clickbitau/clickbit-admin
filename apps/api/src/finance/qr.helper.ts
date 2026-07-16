import * as QRCode from 'qrcode';

const baseUrl = process.env.FRONTEND_URL || 'https://clickbit.com.au';

export async function generateVerificationQRBuffer(
  verificationCode: string,
  options: { width?: number; margin?: number } = {},
): Promise<Buffer> {
  const url = `${baseUrl}/verify/${verificationCode}`;
  return QRCode.toBuffer(url, {
    type: 'png',
    width: options.width || 100,
    margin: options.margin || 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}

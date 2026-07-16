export { stringValue, numberValue, booleanValue, asJson, parseJson, slugify, buildMessageEnvelope, buildDataEnvelope, buildListEnvelope } from '../content/content-utils';

export function parseSettingJson(value: string | null, defaultValue: any = {}): any {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

export function safeNow(): Date {
  return new Date();
}

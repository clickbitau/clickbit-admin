const TOKEN_KEY = 'clickbit:access_token';
const REFRESH_KEY = 'clickbit:refresh_token';

export function getSharedCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return undefined;
  }
  // Share across subdomains of clickbit.com.au (and similar .com.au / .co.uk style domains).
  // This is a heuristic: if the last two segments look like a known two-part public suffix,
  // use the last three segments; otherwise use the last two.
  const parts = host.split('.');
  const twoPartSuffixes = ['com.au', 'net.au', 'org.au', 'gov.au', 'edu.au', 'co.uk', 'org.uk', 'co.nz', 'com.sg'];
  const lastTwo = parts.slice(-2).join('.');
  if (twoPartSuffixes.includes(lastTwo) && parts.length >= 3) {
    return `.${parts.slice(-3).join('.')}`;
  }
  return `.${lastTwo}`;
}

function buildCookie(name: string, value: string, maxAgeSeconds: number, remove = false): string {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const sameSite = secure ? 'SameSite=None' : 'SameSite=Lax';
  const domain = getSharedCookieDomain();
  const maxAge = remove ? 'max-age=0' : `max-age=${maxAgeSeconds}`;
  let cookie = `${encodeURIComponent(name)}=${remove ? '' : encodeURIComponent(value)}; path=/; ${maxAge}`;
  if (secure) cookie += '; Secure';
  cookie += `; ${sameSite}`;
  if (domain) cookie += `; domain=${domain}`;
  return cookie;
}

export function setCookie(name: string, value: string, maxAgeSeconds = 7 * 24 * 60 * 60): void {
  if (typeof document === 'undefined') return;
  document.cookie = buildCookie(name, value, maxAgeSeconds);
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = encodeURIComponent(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = buildCookie(name, '', 0, true);
}

export function getSharedToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY) || getCookie(TOKEN_KEY);
  } catch {
    return getCookie(TOKEN_KEY);
  }
}

export function getSharedRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REFRESH_KEY) || getCookie(REFRESH_KEY);
  } catch {
    return getCookie(REFRESH_KEY);
  }
}

export function setSharedTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {
    // ignore
  }
  setCookie(TOKEN_KEY, accessToken);
  if (refreshToken) setCookie(REFRESH_KEY, refreshToken);
}

export function clearSharedTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
  clearCookie(TOKEN_KEY);
  clearCookie(REFRESH_KEY);
}

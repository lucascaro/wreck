import * as url from 'url';
import * as Debug from 'debug';

const debug = Debug('wreck:helpers:url');

export const VALID_PROTOCOLS = ['http:', 'https:'];

export function isValidURL(str: string): boolean {
  try {
    const parsed = url.parse(str);
    const fixed = fixParsedURL(parsed);
    const hasHost = fixed.host !== undefined;
    const validProto =
      !fixed.protocol || VALID_PROTOCOLS.includes(fixed.protocol);
    return hasHost && validProto;
  } catch {
    return false;
  }
  // A valid url should at least have a host.
}

export function fixStringURL(u: string, referrer: string = ''): string {
  let fixed = u.replace(/^\/\//, 'https://');
  fixed = url.resolve(referrer, fixed);
  if (!fixed.startsWith('http')) {
    fixed = `https://${fixed}`;
  }
  debug(`fix ${u} as ${fixed}`);
  // const { host } = referrer ? url.parse(referrer) : { host: undefined };
  // const parsed = fixParsedURL(url.parse(fixed), host);
  // debug(`parsed: ${JSON.stringify(parsed)}`);
  // return url.format(parsed);
  return fixed;
}

export function fixParsedURL(
  u: url.UrlWithStringQuery,
  host?: string,
): url.UrlWithStringQuery {
  return {
    ...u,
    host: u.host || host,
    protocol: u.protocol || 'https:',
  };
}

export function validateURLs(
  urlList: string[],
): { valid: string[]; invalid: string[] } {
  const lines = urlList;
  const { valid, invalid } = lines.reduce(
    (p, c) => {
      if (isValidURL(c)) {
        return { ...p, valid: [...p.valid, c] };
      }
      return { ...p, invalid: [...p.invalid, c] };
    },
    { valid: [] as string[], invalid: [] as string[] },
  );
  return { valid, invalid };
}

export default {
  isValidURL,
  fixParsedURL,
  fixStringURL,
  validateURLs,
};

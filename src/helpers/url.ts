/*!
 *   Copyright 2018 Lucas Caro <lucascaro@gmail.com>
 *   This file is part of Foobar.
 *
 *   Foobar is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Foobar is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Foobar.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

import * as url from 'url';
import * as Debug from 'debug';

const debug = Debug('wreck:helpers:url');

export const VALID_PROTOCOLS = ['http:', 'https:'];

/**
 * Returns a normalized URL or null if the input is invalid.
 *
 * @param str the string to validate and convert to a URL
 * @param base the base url in case of relative paths.
 */
export function getNormalizedURL(str: string, base?: string): URL | null {
  try {
    // Default to https if no base url is provided
    const adjusted = (!base && str.startsWith('//')) ? `https:${str}` : str;
    debug(`adjusted URL: ${adjusted}`);
    const theURL = new url.URL(adjusted, base);
    // Remove fragment
    theURL.hash = '';
    debug(`normalized URL: ${theURL} from ${str}`);
    return theURL;
  } catch (e) {
    debug(`error normaliing URL ${str}: ${e}`);
    return null;
  }
}

/**
 * Validates a given URL according to the crawler requrements.
 * @param u A URL to validate.
 */
export function isValidNormalizedURL(u?: URL | null): boolean {
  if (!u) {
    return false;
  }

  return u.hostname !== '' && VALID_PROTOCOLS.includes(u.protocol);
}

export type ValidationResults = {
  valid: URL[];
  invalid: string [];
};

export function validateURLs(
  urlList: string[],
): ValidationResults {
  // Using reduce to avoid looping twice. Might be better to
  // prefer clarity and have two filter calls instead...
  const { valid, invalid } = urlList.reduce(
    (p, c) => {
      const normalized = getNormalizedURL(c);
      if (normalized && isValidNormalizedURL(normalized)) {
        return { ...p, valid: [...p.valid, normalized] };
      }
      return { ...p, invalid: [...p.invalid, c] };
    },
    { valid: [], invalid: [] } as ValidationResults,
  );
  return { valid, invalid };
}

export default {
  validateURLs,
  getNormalizedURL,
  isValidNormalizedURL,
};

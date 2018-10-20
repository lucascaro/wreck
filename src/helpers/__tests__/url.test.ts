import * as url from '@helpers/url';

describe('url#getNormalizedURL', () => {
  test('empty url', () => {
    expect(url.getNormalizedURL('')).toBeNull();
  });

  test('valid url', () => {
    expect(url.getNormalizedURL('http://www.google.com/')).toBeInstanceOf(URL);
    expect(url.getNormalizedURL('http://www.google.com/'))
      .toEqual(new URL('http://www.google.com/'));
    expect(url.getNormalizedURL('https://www.google.com'))
      .toEqual(new URL('https://www.google.com/'));
    expect(url.getNormalizedURL('//www.google.com'))
      .toEqual(new URL('https://www.google.com/'));
  });

  test('empty base', () => {
    expect(url.getNormalizedURL('http://www.google.com/', '')).toBeNull();
  });

  test('default to https if no base is set', () => {
    expect(url.getNormalizedURL('http://www.google.com')).toBeInstanceOf(URL);
    expect(url.getNormalizedURL('https://www.google.com'))
      .toEqual(new URL('https://www.google.com/'));
    expect(url.getNormalizedURL('//www.google.com'))
      .toEqual(new URL('https://www.google.com/'));
  });

  test('does not add https when a base is set', () => {
    const base = 'https://www.google.com/';
    expect(url.getNormalizedURL('www.google.com', base)).toBeInstanceOf(URL);

    expect(url.getNormalizedURL('www.google.com', base))
      .toMatchObject(new URL('https://www.google.com/www.google.com', base));

    expect(url.getNormalizedURL('//www.google.com', base))
      .toEqual(new URL('https://www.google.com/', base));

    expect(url.getNormalizedURL('//www.google.com', 'http://www.google.com/'))
      .toEqual(new URL('http://www.google.com/', 'http://www.google.com/'));
  });

  test('edge cases', () => {
    const base = 'https://www.google.com/';

    expect(String(url.getNormalizedURL('http://www.google.com', base)))
      .toEqual('http://www.google.com/');

  });

});

describe('url#isValidNormalizedURL', () => {
  test('rejects empty', () => {
    expect(url.isValidNormalizedURL()).toBe(false);
    expect(url.isValidNormalizedURL(null)).toBe(false);
  });

  test('checks protocol', () => {
    expect(url.isValidNormalizedURL(url.getNormalizedURL('http://google.com'))).toBe(true);
    expect(url.isValidNormalizedURL(url.getNormalizedURL('https://google.com'))).toBe(true);
    expect(url.isValidNormalizedURL(url.getNormalizedURL('ftp://google.com'))).toBe(false);
    expect(url.isValidNormalizedURL(url.getNormalizedURL('ws://google.com'))).toBe(false);
    expect(url.isValidNormalizedURL(url.getNormalizedURL('wat://google.com'))).toBe(false);
  });
});

describe('url#validateURLs', () => {
  test('empty input', () => {
    expect(url.validateURLs([])).toEqual({ valid: [], invalid: [] });
  });

  test('several urls', () => {
    const testURLsIn = [
      'http://google.com',
      'https://google.com',
      '//google.com',
      'google.com',
    ];
    const valid = [
      new URL('http://google.com/'),
      new URL('https://google.com/'),
      new URL('https://google.com/'),
    ];
    const invalid = [
      'google.com',
    ];
    expect(url.validateURLs(testURLsIn)).toEqual({ valid, invalid });
  });
});

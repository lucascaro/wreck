import * as helper from '@helpers/url';
import { URL } from 'url';

describe('url#getNormalizedURL', () => {
  test('empty url', () => {
    expect(helper.getNormalizedURL('')).toBeNull();
  });

  test('valid url', () => {
    expect(helper.getNormalizedURL('http://www.google.com/')).toBeInstanceOf(URL);
    expect(helper.getNormalizedURL('http://www.google.com/'))
      .toEqual(new URL('http://www.google.com/'));
    expect(helper.getNormalizedURL('https://www.google.com'))
      .toEqual(new URL('https://www.google.com/'));
    expect(helper.getNormalizedURL('//www.google.com'))
      .toEqual(new URL('https://www.google.com/'));
  });

  test('empty base', () => {
    expect(helper.getNormalizedURL('http://www.google.com/', '')).toBeNull();
  });

  test('default to https if no base is set', () => {
    expect(helper.getNormalizedURL('http://www.google.com')).toBeInstanceOf(URL);
    expect(helper.getNormalizedURL('https://www.google.com'))
      .toEqual(new URL('https://www.google.com/'));
    expect(helper.getNormalizedURL('//www.google.com'))
      .toEqual(new URL('https://www.google.com/'));
  });

  test('does not add https when a base is set', () => {
    const base = 'https://www.google.com/';
    expect(helper.getNormalizedURL('www.google.com', base)).toBeInstanceOf(URL);

    expect(helper.getNormalizedURL('www.google.com', base))
      .toMatchObject(new URL('https://www.google.com/www.google.com', base));

    expect(helper.getNormalizedURL('//www.google.com', base))
      .toEqual(new URL('https://www.google.com/', base));

    expect(helper.getNormalizedURL('//www.google.com', 'http://www.google.com/'))
      .toEqual(new URL('http://www.google.com/', 'http://www.google.com/'));
  });

  test('edge cases', () => {
    const base = 'https://www.google.com/';

    expect(String(helper.getNormalizedURL('http://www.google.com', base)))
      .toEqual('http://www.google.com/');

  });

});

describe('url#isValidNormalizedURL', () => {
  test('rejects empty', () => {
    expect(helper.isValidNormalizedURL()).toBe(false);
    expect(helper.isValidNormalizedURL(null)).toBe(false);
  });

  test('checks protocol', () => {
    expect(helper.isValidNormalizedURL(helper.getNormalizedURL('http://google.com'))).toBe(true);
    expect(helper.isValidNormalizedURL(helper.getNormalizedURL('https://google.com'))).toBe(true);
    expect(helper.isValidNormalizedURL(helper.getNormalizedURL('ftp://google.com'))).toBe(false);
    expect(helper.isValidNormalizedURL(helper.getNormalizedURL('ws://google.com'))).toBe(false);
    expect(helper.isValidNormalizedURL(helper.getNormalizedURL('wat://google.com'))).toBe(false);
  });
});

describe('url#validateURLs', () => {
  test('empty input', () => {
    expect(helper.validateURLs([])).toEqual({ valid: [], invalid: [] });
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
    expect(helper.validateURLs(testURLsIn)).toEqual({ valid, invalid });
  });
});

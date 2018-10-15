import * as url from '@helpers/url';

const validTestURLs = [
  'http://google.com',
  'http://www.google.com/',
  'http://google',
];
const invalidTestURLs = [
  '//google.com/',
  'google.com',
  '//google.com/',
  'blahblah',
  'wobble://google.com',
];

describe('url#isValidURL', () => {
  test('empty string', () => {
    expect(url.isValidURL('')).toBe(false);
  });

  test('validURLs return true', () => {
    validTestURLs.forEach((u) => {
      expect(url.isValidURL(u)).toBe(true);
    });
  });

  test('invalidURLs return false', () => {
    invalidTestURLs.forEach((u) => {
      expect(url.isValidURL(u)).toBe(false);
    });
  });
});

describe('url#validateURLs', () => {
  test('empty list', () => {
    expect(url.validateURLs([])).toEqual({ valid: [], invalid: [] });
  });

  test('validate URLs', () => {
    const inputURLs = [...validTestURLs, ...invalidTestURLs];

    const { valid, invalid } = url.validateURLs(inputURLs);

    expect(valid).toEqual(validTestURLs);
    expect(invalid).toEqual(invalidTestURLs);
  });
});

describe('url#fixStringURL', () => {});

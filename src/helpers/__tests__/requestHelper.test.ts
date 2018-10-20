import requestHelper from '@root/src/helpers/requestHelper';
import { Response, Headers } from 'node-fetch';
import { MessageType } from '../Message';

describe('requestHelper#fetchURL', () => {
  test('noop', () => undefined);
});

describe('requestHelper#handleHTTPResponse', () => {
  const R = requestHelper({
    CHILD_NO: 0,
    debug: () => null,
    REQUEST_TIMEOUT: 100,
    EXCLUDE_URLS: [],
    MAX_CRAWL_DEPTH: 4,
  });
  const work = {
    url: 'http://example.com',
    referrer: 'http://example.com',
    depth: 0,
  };
  test('returns done message', async () => {
    const response = new Response('', {
      status: 200,
    });
    const res = await R.handleHTTPResponse(response, work, 'GET', 0);
    expect(res.type).toEqual(MessageType.DONE);
    expect(res.payload).toEqual({
      ...work,
      workerNo: 0,
      statusCode: 200,
      success: true,
      neighbours: [],
    });
  });
  test('parses neighbours if GET', async () => {
    const response = new Response('<a href="http://www.example.com/1"></a>', {
      status: 200,
    });
    const res = await R.handleHTTPResponse(response, work, 'GET', 0);
    expect(res.type).toEqual(MessageType.DONE);
    expect(res.payload).toEqual({
      ...work,
      workerNo: 0,
      statusCode: 200,
      success: true,
      neighbours: ['http://www.example.com/1'],
    });
  });
  test('ignores body if HEAD', async () => {
    const response = new Response('<a href="http://www.example.com/1"></a>', {
      status: 200,
    });
    const res = await R.handleHTTPResponse(response, work, 'HEAD', 0);
    expect(res.type).toEqual(MessageType.DONE);
    expect(res.payload).toEqual({
      ...work,
      workerNo: 0,
      statusCode: 200,
      success: true,
      neighbours: [],
    });
  });
});

describe('requestHelper#getRetryAfterTimeout', () => {
  const R = requestHelper({
    CHILD_NO: 0,
    debug: () => null,
    REQUEST_TIMEOUT: 100,
    EXCLUDE_URLS: [],
    MAX_CRAWL_DEPTH: 4,
  });
  test('returns default if no retry-after', () => {
    const response = new Response('', {
      status: 200,
      headers: new Headers({ 'some-header': 'some-value' }),
    });
    expect(R.getRetryAfterTimeout(response, 42)).toBe(42);
  });
  test('returns number when retry-after is a number', () => {
    const response = new Response('', {
      status: 200,
      headers: new Headers({ 'Retry-After': '10' }),
    });
    expect(R.getRetryAfterTimeout(response, 42)).toBe(10000);
  });
  test('returns number when retry-after is a date', () => {
    const ogNow = Date.now();
    const response = new Response('', {
      status: 200,
      headers: new Headers({
        'Retry-After': new Date(ogNow + 100000).toUTCString(),
      }),
    });
    const resp = R.getRetryAfterTimeout(response, 42);
    const newNow = Date.now();
    const diff = newNow - ogNow;
    // Allow for 1 second error during conversion
    expect(resp).toBeGreaterThanOrEqual(99000 - diff);
    expect(resp).toBeLessThanOrEqual(100000);
  });

  // TODO: refactor and test retries.
});

describe('requestHelper#parseNeighbours', () => {
  const R = requestHelper({
    CHILD_NO: 0,
    debug: () => null,
    REQUEST_TIMEOUT: 100,
    EXCLUDE_URLS: [],
    MAX_CRAWL_DEPTH: 4,
  });
  test('empty body has no neighbours', () => {
    const base = 'http://example.com';
    expect(R.parseNeighbours('', '')).toEqual([]);
    expect(R.parseNeighbours('', base)).toEqual([]);
  });
  test('hyperlinks are neighbours', () => {
    const base = 'http://example.com';
    expect(R.parseNeighbours('<a href="/test">', base))
      .toEqual(['http://example.com/test']);
    expect(R.parseNeighbours('<a href="https://external.org/test">', base))
      .toEqual(['https://external.org/test']);
  });
  test('images are neighbours', () => {
    const base = 'http://example.com';
    expect(R.parseNeighbours('<img src="/test.jpg">', base))
      .toEqual(['http://example.com/test.jpg']);
    expect(R.parseNeighbours('<img src="https://external.org/test.png">', base))
      .toEqual(['https://external.org/test.png']);
  });

  test('multiple links are neighbours', () => {
    const base = 'https://example.com';
    const doc = `
    <head>
      <link rel="stylesheet" href="/test.css"></link>
    </head>
    <body>
      <a href="https://external.org/"></a>
      <a href="/internal"></a>
      <img src="https://external.org/test.png" />
      <script src="https://external.org/test.js"></script>
    </body>
    `;
    expect(R.parseNeighbours(doc, base))
      .toEqual([
        'https://example.com/test.css',
        'https://external.org/',
        'https://example.com/internal',
        'https://external.org/test.png',
        'https://external.org/test.js',
      ]);
  });
});

describe('requestHelper#methodForURL', () => {
  const R = requestHelper({
    CHILD_NO: 0,
    debug: () => null,
    REQUEST_TIMEOUT: 100,
    EXCLUDE_URLS: [/excludeme/i, /nofollow/],
    MAX_CRAWL_DEPTH: 4,
  });
  const WP = { url: '', referrer: '', depth: 1 };
  test('regular URLs return GET', () => {
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com' })).toEqual('GET');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1' })).toEqual('GET');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.htm' })).toEqual('GET');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.html' })).toEqual('GET');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.php' })).toEqual('GET');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.do' })).toEqual('GET');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.action' })).toEqual('GET');
  });

  test('images, scripts and styles return HEAD', () => {
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.jpg' })).toEqual('HEAD');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.jpeg' })).toEqual('HEAD');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.png' })).toEqual('HEAD');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.svg' })).toEqual('HEAD');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.webp' })).toEqual('HEAD');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.css' })).toEqual('HEAD');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.js' })).toEqual('HEAD');
  });

  test('ignores query string and fragment', () => {
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/?var=some.jpg' })).toEqual('GET');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/1.jpg?test.html' })).toEqual('HEAD');
  });

  test('excludes by pattern', () => {
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/?ref=excludeme' })).toEqual('HEAD');
    expect(R.methodForURL({ ...WP, url: 'http://www.google.com/nofollow' })).toEqual('HEAD');
  });

  test('considers max depth', () => {
    expect(
      R.methodForURL({
        ...WP,
        url: 'http://www.google.com/',
        depth: 4,
      }),
    ).toEqual('GET');
    expect(
      R.methodForURL({
        ...WP,
        url: 'http://www.google.com/',
        depth: 5,
      }),
    ).toEqual('HEAD');
  });

  test('external URLs are HEAD', () => {
    expect(
      R.methodForURL({
        referrer: 'http://www.google.com/',
        url: 'http://www.google.com/1',
        depth: 1,
      }),
    ).toEqual('GET');
    expect(
      R.methodForURL({
        referrer: 'http://www.google.com/',
        url: 'http://www.somewhereelse.com/1',
        depth: 1,
      }),
    ).toEqual('HEAD');
  });
});

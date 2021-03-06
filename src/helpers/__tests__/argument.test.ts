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

import * as A from '@helpers/argument';
import { Stream, Readable, PassThrough } from 'stream';

// Using commonjs for mocking.
const fs = require('fs');

describe('argument#getArrayOption', () => {
  test('no value returns empty array', () => {
    expect(A.getArrayOption()).toEqual([]);
    expect(A.getArrayOption(null)).toEqual([]);
    expect(A.getArrayOption('')).toEqual([]);
  });

  test('scalar value returns array of one', () => {
    expect(A.getArrayOption('1')).toEqual(['1']);
  });

  test('array value returns array', () => {
    expect(A.getArrayOption(['1', '2'])).toEqual(['1', '2']);
  });

  test('array of non strings returns array of strings', () => {
    const input = [1, true, Array(2)];
    const expected = ['1', 'true', ','];
    // Some TS magic to forcefully feed the function the wrong types.
    expect(A.getArrayOption(input as any[] as string[])).toEqual(expected);
  });
});

describe('argument#getURLsFromArgOrStdin', () => {
  test('returns argument if passed', () => {
    expect(A.getURLsFromArgOrSTDIN('testing')).toEqual(['testing']);
  });
  test('reads from stdin if no argument passed', () => {
    const mockSTDIN = [
      'test1',
      'test2',
      3,
    ];
    const ogFn = fs.readFileSync;
    fs.readFileSync = jest.fn(() => mockSTDIN.join('\n'));
    expect(A.getURLsFromArgOrSTDIN()).toEqual(['test1', 'test2', '3']);
    fs.readFileSync = ogFn;
  });
});

function mockSTDIN(s: string[]) : () => void {
  const mock = new Readable({
    highWaterMark: 0,
    encoding: 'utf-8',
  });
  mock.push(s.join('\n'));
  mock.push(null);

  const stdin = process.stdin;
  Object.defineProperty(process, 'stdin', {
    value: mock,
    configurable: true,
    writable: false,
  });

  // Return a restore functionl
  return () => {
    Object.defineProperty(process, 'stdin', {
      value: stdin,
      configurable: true,
      writable: false,
    });
  };
}

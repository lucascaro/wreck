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

import { readFileSync } from 'fs';

export function getURLsFromArgOrSTDIN(argURL?: string): string[] {
  if (argURL) {
    return[argURL];
  }

  const input = readFileSync(0, 'utf-8').toString();
  const lines = input
      .split('\n')
      .map(l => l.trim())
      .filter(l => l !== '');
  return lines;
}

export function getArrayOption(optVal?: string | string[] | null): string[] {
  if (!optVal) {
    return [];
  }
  if (typeof optVal === 'string') {
    return [optVal];
  }
  return Array.from(optVal.map(String));
}

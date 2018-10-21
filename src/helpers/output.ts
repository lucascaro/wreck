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

export enum OutputLevel {
  SILENT = 0,
  NORMAL = 1,
  VERBOSE = 2,
}

let outputLevel = OutputLevel.NORMAL;
if (Object.prototype.hasOwnProperty.call(process.env, 'WRECK_OUTPUT_LEVEL')) {
  const savedLevel = Number(process.env.WRECK_OUTPUT_LEVEL);
  if (Object.values(OutputLevel).includes(savedLevel)) {
    outputLevel = savedLevel;
  }
}
export default {

  setLevel(l: OutputLevel) {
    outputLevel = l;
    process.env['WRECK_OUTPUT_LEVEL'] = String(l);
  },

  normal(...args: any) {
    if (outputLevel >= OutputLevel.NORMAL) {
      console.log(...args);
    }
  },

  always(...args: any) {
    console.log(...args);
  },

  warn(...args: any) {
    if (outputLevel >= OutputLevel.SILENT) {
      console.warn(...args);
    }
  },

  error(...args: any) {
    if (outputLevel >= OutputLevel.SILENT) {
      console.error(...args);
    }
  },

  verbose(...args: any) {
    if (outputLevel >= OutputLevel.VERBOSE) {
      console.log(...args);
    }
  },
};

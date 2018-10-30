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

import * as Debug from 'debug';
import output from '../helpers/output';
import { PersistentState } from '../helpers/PersistentState';
import { WorkPayload } from '../helpers/Message';
import { command, Command, ReturnValue } from 'console-commando';

const debug = Debug('wreck:commands:report');

export default command('report')
  .withDescription('Print a summary of the last run.')
  .withHandler(async (command: Command) => {
    const allURLs: Set<string> = new Set();
    const workQueue: Map<string, WorkPayload> = new Map();
    const results = await PersistentState.readState(allURLs, workQueue);
    output.normal(`Processed ${allURLs.size} URLs. ${workQueue.size} are pending.`);
    // TODO: report options.
    const successes = results.filter(r => r.success);
    const errors = results.filter(r => !r.success);
    const notFound = results.filter(r => r.statusCode === 404);

    // TODO: formatters
    results.forEach((result, i) => {
      output.verbose(
        '->',
        i,
        result.url,
        result.referrer,
        result.statusCode,
        result.success ? 'OK' : 'ERROR',
      );
    });

    output.normal(`Success: ${successes.length}`);
    output.normal(`Error: ${errors.length}`);
    output.normal(`NotFound: ${notFound.length}`);
    return ReturnValue.SUCCESS;
  });

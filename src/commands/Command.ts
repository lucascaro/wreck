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

import output, { OutputLevel } from '@helpers/output';
// tslint:disable-next-line:import-name
import Commando from 'console-commando';
import Crawl from './Crawl';
import Report from './Report';
import { PersistentState } from '../helpers/PersistentState';

// Use plain old require to get version string.
const { version } = require('@root/package.json');

export default new Commando('wreck')
  .description('Reliable and Efficient Web Crawler')
  .option('-v --verbose', 'Make operation more talkative.')
  .option('-s --silent', 'Make operation silent (Only errors and warnings will be shown).')
  .option('-f --state-file <fileName>', 'Path to status file.', './wreck.run.state.json')
  .version(version)
  .command(Crawl)
  .command(Report)
  .before((command: Commando) => {
    if (command.getOption('verbose')) {
      output.setLevel(OutputLevel.VERBOSE);
    }
    if (command.getOption('silent')) {
      output.setLevel(OutputLevel.SILENT);
    }
    const stateFileName = command.getOption('state-file');
    PersistentState.init(stateFileName);
  });

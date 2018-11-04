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
import { command, Command, flag, stringOption } from 'console-commando';
import Crawl from './Crawl';
import Report from './Report';
import { PersistentState } from '../helpers/PersistentState';

// Use plain old require to get version string.
const { version } = require('@root/package.json');

export default command('wreck')
  .withVersion(version)
  .withDescription('Reliable and Efficient Web Crawler')
  .withOption(flag('verbose', 'v', 'Make operation more talkative.'))
  .withOption(flag('silent', 's', 'Display errors and warnings only.'))
  .withOption(stringOption('state-file', 'f', 'Path to state file.', './wreck.run.state.json'))
  .withSubCommand(Crawl)
  .withSubCommand(Report)
  .withPreProcessor((command: Command) => {
    if (command.getFlag('verbose')) {
      output.setLevel(OutputLevel.VERBOSE);
    }
    if (command.getFlag('silent')) {
      output.setLevel(OutputLevel.SILENT);
    }
    const stateFileName = command.getStringOption('state-file');
    PersistentState.init(stateFileName);
  });

import { createWriteStream, WriteStream, createReadStream, renameSync, existsSync } from 'fs';
import { WorkPayload, ResultPayload } from './Message';
import { Writable } from 'stream';
import * as split2 from 'split2';
import * as Debug from 'debug';

const debug = Debug('wreck:helpers:persistence');

const fileName = './wreck.run.state.json';

export namespace PersistentState {
  let outStream: WriteStream | null = null;
  export function readState(outAllURLs: Set<String>, outWorkQueue: Map<string, WorkPayload>) {
    return new Promise((resolve, reject) => {
      if (!existsSync(fileName)) {
        resolve();
        return;
      }
      createReadStream(fileName, { encoding: 'utf-8' })
      .pipe(split2())
      .pipe(new Writable({
        write(chunk, encoding, callback) {
          const result: ResultPayload = JSON.parse(chunk);
          // debug({ ...result, neighbours: result.neighbours.length });
          outAllURLs.add(result.url);
          result.neighbours.forEach((neighbour) => {
            // Ignore URLs that were already added.
            if (!outAllURLs.has(neighbour)) {
              const payload: WorkPayload = {
                url: neighbour,
                referrer: result.url,
                depth: result.depth + 1,
              };
              outWorkQueue.set(neighbour, payload);
              outAllURLs.add(neighbour);
            }
          });
          outWorkQueue.delete(result.url);
          callback();
        },
      }))
      .on('finish', resolve)
      .on('error', reject);
    });
  }

  export function write(chunk: any) {
    if (!outStream) {
      outStream = createWriteStream(fileName, { encoding: 'utf-8', flags: 'a' });
    }
    outStream.write(chunk);
  }

  export function resetState() {
    if (outStream) {
      outStream.close();
      outStream = null;
    }
    if (existsSync(fileName)) {
      renameSync(fileName, `${fileName}~`);
    }
  }
}

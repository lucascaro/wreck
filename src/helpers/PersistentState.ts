import { createWriteStream, WriteStream, createReadStream, renameSync, existsSync } from 'fs';
import { WorkPayload, ResultPayload } from './Message';
import { Writable } from 'stream';
import * as split2 from 'split2';
import * as Debug from 'debug';

const debug = Debug('wreck:helpers:persistence');

let fileName: string;

export namespace PersistentState {
  let outStream: WriteStream | null = null;

  export function init(stateFileName: string = './wreck.run.state.json') {
    fileName = stateFileName;
  }

  export function readState(
    outAllURLs: Set<String>,
    outWorkQueue: Map<string, WorkPayload>,
    ): Promise<ResultPayload[]> {
    if (!fileName) { throw new Error('persistent state not initialized'); }
    return new Promise((resolve, reject) => {
      const allWork: ResultPayload[] = [];
      if (!existsSync(fileName)) {
        resolve(allWork);
        return;
      }
      createReadStream(fileName, { encoding: 'utf-8' })
      .pipe(split2())
      .pipe(new Writable({
        write(chunk, encoding, callback) {
          const result: ResultPayload = JSON.parse(chunk);
          // debug({ ...result, neighbours: result.neighbours.length });
          outAllURLs.add(result.url);
          allWork.push(result);
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
      .on('finish', () => resolve(allWork))
      .on('error', reject);
    });
  }

  export function write(chunk: any) {
    if (!fileName) { throw new Error('persistent state not initialized'); }
    if (!outStream) {
      outStream = createWriteStream(fileName, { encoding: 'utf-8', flags: 'a' });
    }
    outStream.write(chunk);
  }

  export function resetState() {
    if (!fileName) { throw new Error('persistent state not initialized'); }
    if (outStream) {
      outStream.close();
      outStream = null;
    }
    if (existsSync(fileName)) {
      renameSync(fileName, `${fileName}~`);
    }
  }
}

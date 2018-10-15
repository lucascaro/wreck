
export default interface Message {
  type: string;
  payload?: any;
}

export enum MessageType {
  READY = 'ready',
  WORK = 'work',
  DONE = 'done',
  CLAIM = 'claim',
  RELEASE = 'release',
  DEQUEUE = 'dequeue',
  QUEUE_EMPTY = 'queue_empty',
}

export class PrintableMessage implements Message{
  type: string = '';
  payload?: any;
  toString() {
    return `type: ${this.type}, payload: ${this.payload}`;
  }
}

export class GenericMessage implements Message, PrintableMessage {
  constructor(public type: string, public payload: any) {}
}

export class ReadyMessage implements Message, PrintableMessage {
  type = MessageType.READY;
}

export interface WorkPayload {
  url: string;
  workerNo?: number;
}
export class WorkMessage implements Message, PrintableMessage {
  type = MessageType.WORK;
  constructor(public payload: WorkPayload) {}
}

export interface ResultPayload {
  url: string;
  workerNo: number;
  statusCode: number;
  success: boolean;
  neighbours: string[];
}

export class DoneMessage implements Message {
  type = MessageType.DONE;
  // TODO: the payload for this should be crawl results
  constructor(public payload: ResultPayload) {}
}

export interface ClaimPayload {
  workerNo: number;
}
export class ClaimMessage implements Message {
  type = MessageType.CLAIM;
  constructor(public payload: ClaimPayload) {}
}
export class ReleaseMessage implements Message {
  type = MessageType.RELEASE;
  constructor(public payload: WorkPayload) {}
}

export class DequeueMessage implements Message {
  type = MessageType.DEQUEUE;
  constructor(public payload: string) {}
}

export class QueueEmptyMessage implements Message {
  type = MessageType.QUEUE_EMPTY;
}

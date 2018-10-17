
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
  referrer: string;
  depth: number;
  workerNo?: number;
}
export class WorkMessage implements Message, PrintableMessage {
  type = MessageType.WORK;
  constructor(public payload: WorkPayload) {}
}

export interface ResultPayload {
  url: string;
  referrer: string;
  depth: number;
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

export function messageFromJSON(obj: Partial<Message>): Message {
  switch (obj.type) {
    case MessageType.READY:
      return new ReadyMessage();
    case MessageType.WORK:
        // TODO: validate payload
      return new WorkMessage(obj.payload);
    case MessageType.DONE:
        // TODO: validate payload
      return new DoneMessage(obj.payload);
    case MessageType.CLAIM:
        // TODO: validate payload
      return new ClaimMessage(obj.payload);
    case MessageType.RELEASE:
        // TODO: validate payload
      return new ReleaseMessage(obj.payload);
    case MessageType.DEQUEUE:
        // TODO: validate payload
      return new DequeueMessage(obj.payload);
    case MessageType.QUEUE_EMPTY:
      return new QueueEmptyMessage();
    default:
      const type = obj.type || 'unknown';
      const payload = obj.payload || obj;

      return new GenericMessage(type, payload);
  }
}

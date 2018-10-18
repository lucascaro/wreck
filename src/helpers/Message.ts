
// export default interface Message {
//   type: string;
//   payload?: any;
// }

export const enum MessageType {
  READY = 'ready',
  WORK = 'work',
  DONE = 'done',
  CLAIM = 'claim',
  RELEASE = 'release',
  DEQUEUE = 'dequeue',
  QUEUE_EMPTY = 'queue_empty',
}

export type Message =
  GenericMessage |
  ReadyMessage |
  WorkMessage |
  DoneMessage |
  ClaimMessage |
  ReleaseMessage |
  DequeueMessage |
  QueueEmptyMessage
;

export class GenericMessage {
  constructor(public type: string, public payload?: any) {}
  toString() {
    return `type: ${this.type}, payload: ${this.payload}`;
  }
}

export class ReadyMessage extends GenericMessage {
  constructor() {
    super(MessageType.READY);
  }
}

export interface WorkPayload {
  url: string;
  referrer: string;
  depth: number;
  workerNo?: number;
}
export class WorkMessage extends GenericMessage {
  constructor(payload: WorkPayload) {
    super(MessageType.WORK, payload);
  }
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

export class DoneMessage extends GenericMessage {
  constructor(payload: ResultPayload) {
    super(MessageType.DONE, payload);
  }
}

export interface ClaimPayload {
  workerNo: number;
}
export class ClaimMessage extends GenericMessage {
  constructor(payload: ClaimPayload) {
    super(MessageType.CLAIM, payload);
  }
}
export class ReleaseMessage extends GenericMessage {
  constructor(payload: WorkPayload) {
    super(MessageType.RELEASE, payload);
  }
}

export class DequeueMessage extends GenericMessage {
  constructor(payload: string) {
    super(MessageType.DEQUEUE, payload);
  }
}

export class QueueEmptyMessage extends GenericMessage {
  constructor() {
    super(MessageType.QUEUE_EMPTY);

  }
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

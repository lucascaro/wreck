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

export interface Message {
  type: string;
  payload?: any;
}

export const enum MessageType {
  READY = 'ready',
  WORK = 'work',
  DONE = 'done',
  CLAIM = 'claim',
  RELEASE = 'release',
  DEQUEUE = 'dequeue',
  QUEUE_EMPTY = 'queue_empty',
  ERROR = 'error',
}

export class GenericMessage implements Message {
  constructor(public type: string, public payload?: any) {}
  toString() {
    return `type: ${this.type}, payload: ${this.payload}`;
  }
}

export class ReadyMessage extends GenericMessage {
  payload: never;
  constructor(public type = MessageType.READY) {
    super(type);
  }
}

export interface WorkPayload {
  url: string;
  referrer: string;
  depth: number;
  workerNo?: number;
}
export class WorkMessage extends GenericMessage {
  constructor(public payload: WorkPayload) {
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
  constructor(public payload: ResultPayload) {
    super(MessageType.DONE, payload);
  }
}

export interface ClaimPayload {
  workerNo: number;
}
export class ClaimMessage extends GenericMessage {
  constructor(public payload: ClaimPayload) {
    super(MessageType.CLAIM, payload);
  }
}
export class ReleaseMessage extends GenericMessage {
  constructor(public payload: WorkPayload) {
    super(MessageType.RELEASE, payload);
  }
}

export class DequeueMessage extends GenericMessage {
  constructor(public payload: string) {
    super(MessageType.DEQUEUE, payload);
  }
}

export class QueueEmptyMessage extends GenericMessage {
  public payload: never;
  constructor() {
    super(MessageType.QUEUE_EMPTY);

  }
}

export class ErrorMessage extends GenericMessage {
  constructor(public payload: string) {
    super(MessageType.ERROR, payload);
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
    case MessageType.ERROR:
      return new ErrorMessage(obj.payload);
    default:
      const type = obj.type || 'unknown';
      const payload = obj.payload || obj;

      return new GenericMessage(type, payload);
  }
}

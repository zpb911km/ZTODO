import { Injectable } from '@angular/core';

export enum MessageType {
  INFO = "INFO",
  SUCCESS = "SUCCESS",
  WARNING = "WARNING",
  ERROR = "ERROR",
  DEBUG = "DEBUG"
}

export interface Message {
  message: string;
  timestamp: Date;
  type: MessageType;
  timeout: number;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private messages: Message[] = [];
  private messageCount: { [key in MessageType]: number } = {
    [MessageType.INFO]: 0,
    [MessageType.SUCCESS]: 0,
    [MessageType.WARNING]: 0,
    [MessageType.ERROR]: 0,
    [MessageType.DEBUG]: 0
  };

  addMessage(message: string, type: MessageType = MessageType.INFO, timeout?: number) {
    if (timeout === undefined) {
      switch (type) {
        case MessageType.INFO:
          timeout = 10;
          break;
        case MessageType.SUCCESS:
          timeout = 5;
          break;
        case MessageType.WARNING:
          timeout = 10;
          break;
        case MessageType.ERROR:
          timeout = 15;
          break;
        default:
          timeout = 10;
          break;
      }
    }
    this.messageCount[type]++;
    this.messages.push({
      message: `${String(type)} ${this.messageCount[type]}. ${message}`,
      timestamp: new Date(),
      type: type,
      timeout: timeout
    });
    
  }

  getMessages(): Message[] {
    const now = new Date().getTime();
    const messages = this.messages.filter(
      msg => now - msg.timestamp.getTime() <= msg.timeout * 1000
    );
    return messages;
  }

  clearMessages() {
    this.messages = [];
  }

  removeMessage(message_message: string) {
    this.messages = this.messages.filter(msg => msg.message!== message_message);
  }

  constructor() { }
}

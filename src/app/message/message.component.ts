import { Component, OnInit } from '@angular/core';
import { Message, MessageService, MessageType } from '../core/services/message.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './message.component.html',
  styleUrl: './message.component.css'
})
export class MessageComponent implements OnInit {
  messages: Message[] = [];
  progressValues: {[key: string]: number} = {};
  MessageType = MessageType;

  constructor(public messageService: MessageService) { }

  ngOnInit() {
    this.updateMessages();
    // // 添加普通消息(默认10秒)
    // this.messageService.addMessage('普通消息');

    // // 添加成功消息(5秒)
    // this.messageService.addMessage('操作成功', MessageType.SUCCESS, 5);

    // // 添加警告消息(15秒)
    // this.messageService.addMessage('警告', MessageType.WARNING, 20);

    // // 添加错误消息(默认10秒)
    // this.messageService.addMessage('错误', MessageType.ERROR);
    setInterval(() => this.updateMessages(), 10);
  }

  async updateMessages() {
    const now = new Date().getTime();
    this.messages = this.messageService.getMessages().filter(msg => {
      const elapsed = (now - msg.timestamp.getTime()) / 1000;
      return elapsed <= (msg.timeout);
    });

    if (this.messages.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }
    
    this.messages.forEach(msg => {
      const elapsed = (now - msg.timestamp.getTime()) / 1000;
      const timeout = msg.timeout;
      this.progressValues[msg.message] = (timeout - elapsed) / timeout * 100;
    });
  }

  closeMessage(message_message: string) {
    this.messageService.removeMessage(message_message);
    this.updateMessages();
  }

  getMessageClass(message: Message): string {
    switch(message.type) {
      case MessageType.SUCCESS: return 'message-success';
      case MessageType.WARNING: return 'message-warning';
      case MessageType.ERROR: return 'message-error';
      case MessageType.DEBUG: return 'message-debug';
      default: return 'message-info';
    }
  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task } from '../core/interface/task';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService } from '../core/services/message.service';

@Component({
  selector: 'app-task-edit',
  templateUrl: './task-edit.component.html',
  styleUrls: ['./task-edit.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class TaskEditComponent {
  @Input() task: Task | null = null;
  @Output() save = new EventEmitter<Task>();
  @Output() delete = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  constructor(private messageService: MessageService) {}

  formatDateInput(date: Date): string {
    return new Date(date).toISOString().split('T')[0];
  }

  formatTimeInput(date: Date): string {
    const d = new Date(date);
    return `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}`;
  }

  updateDatePart(field: 'start' | 'end', event: Event): void {
    if (!this.task) return;
    const input = event.target as HTMLInputElement;
    const date = new Date(input.value);
    const oldDate = new Date(this.task[field]);
    
    date.setHours(oldDate.getHours());
    date.setMinutes(oldDate.getMinutes());
    
    this.task[field] = date;
  }

  updateTimePart(field: 'start' | 'end', event: Event): void {
    if (!this.task) return;
    const input = event.target as HTMLInputElement;
    const [hours, minutes] = input.value.split(':').map(Number);
    const date = new Date(this.task[field]);
    
    date.setHours(hours);
    date.setMinutes(minutes);
    
    this.task[field] = date;
  }

  addOtherField(): void {
    if (!this.task) return;
    if (!this.task.others) {
      this.task.others = [];
    }
    this.task.others.push({ key: '', value: '' });
  }

  removeOtherField(index: number): void {
    if (!this.task?.others) return;
    this.task.others.splice(index, 1);
  }

  pad(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }

  onSave(): void {
    if (!this.task) return;
    this.save.emit(this.task);
  }

  onDelete(): void {
    this.delete.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task, OtherField } from '../core/interface/task';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService, MessageType } from '../core/services/message.service';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-task-edit',
  templateUrl: './task-edit.component.html',
  styleUrls: ['./task-edit.component.css'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule
  ]
})
export class TaskEditComponent {
  @Input() task: Task | null = null;
  @Input() allTasks: Task[] = []; // 所有task数据
  @Output() save = new EventEmitter<Task>();
  @Output() delete = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  allKeys: string[] = []; // 所有可能的key
  keyValueMap: {[key: string]: string[]} = {}; // key到value的映射

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {
    console.log('Initializing task edit component with allTasks:', this.allTasks);
    this.collectAllKeysAndValues();
    console.log('Collected keys:', this.allKeys);
    console.log('Collected value map:', this.keyValueMap);
  }

  // 收集所有task中的key和对应的value
  collectAllKeysAndValues(): void {
    this.allKeys = [];
    this.keyValueMap = {};

    this.allTasks.forEach(task => {
      if (task.others) {
        task.others.forEach((item: OtherField) => {
          if (!this.allKeys.includes(item.key)) {
            this.allKeys.push(item.key);
          }
          if (!this.keyValueMap[item.key]) {
            this.keyValueMap[item.key] = [];
          }
          if (!this.keyValueMap[item.key].includes(item.value)) {
            this.keyValueMap[item.key].push(item.value);
          }
        });
      }
    });
  }

  // 过滤key选项
  filterKeys(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.allKeys.filter(key => 
      key.toLowerCase().includes(filterValue)
    );
  }

  // 过滤value选项
  filterValues(key: string, value: string): string[] {
    if (!key || !this.keyValueMap[key]) return [];
    const filterValue = value.toLowerCase();
    return this.keyValueMap[key].filter(v => 
      v.toLowerCase().includes(filterValue)
    );
  }

  ngAfterViewInit(): void {
    const descriptionElement = document.getElementsByName('description')[0];
    if (!descriptionElement) {
      this.messageService.addMessage('Description element not found', MessageType.ERROR);
      return;
    }
    const content_lines = Math.max(4, this.task?.description.split('\n').length || 1);
    const computedStyle = window.getComputedStyle(descriptionElement);
    const fontSize = parseFloat(computedStyle.fontSize.replace("px", '')) || 16;
    const lineHeight = fontSize * 1.25;
    const content_height = (content_lines * lineHeight);
    // this.messageService.addMessage(`Task content height: ${content_height}px`, MessageType.DEBUG);
    descriptionElement.style.height = `${content_height}px`;
  }

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

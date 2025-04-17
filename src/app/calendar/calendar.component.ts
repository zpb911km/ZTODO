import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  NgModule,
  Input,
  ChangeDetectorRef,
  OnChanges,
} from "@angular/core";
import { Task } from "../core/interface/task";
import { invoke } from "@tauri-apps/api/core";

@Component({
  selector: "app-calendar",
  templateUrl: "./calendar.component.html",
  styleUrls: ["./calendar.component.css"],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class CalendarComponent implements AfterViewInit, OnChanges {
  @ViewChild("calendarBody") calendarBody!: ElementRef;
  @Input() tasks: Task[] = [];

  dates: Date[] = [];
  currentPrecision: string = "day";
  cellWidth: number = 100; // 初始单元格宽度
  precisionLevels = ["year", "month", "week", "day", "hour", "minute"]; // 添加周、小时和分钟
  precisionIndex: number = 3; // 初始精度为 'day'
  editingTask: Task | null = null; // 当前编辑的任务
  darkMode: boolean = false;

  constructor(private cdr: ChangeDetectorRef) {
    this.currentPrecision = this.precisionLevels[this.precisionIndex];
    setTimeout(() => {
      this.scrollToCurrentDate();
    }, 100);
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('calendarTheme');
    if (savedTheme) {
      this.darkMode = savedTheme === 'dark';
      // Delay theme application to avoid change detection issues
      setTimeout(() => this.applyTheme(), 0);
    }
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    this.applyTheme();
    // Save theme preference
    localStorage.setItem('calendarTheme', this.darkMode ? 'dark' : 'light');
  }

  private applyTheme() {
    // 实际应用主题样式
    const calendarElement = this.calendarBody?.nativeElement?.parentElement;
    if (calendarElement) {
      if (this.darkMode) {
        calendarElement.classList.add('dark-theme');
        calendarElement.classList.remove('light-theme');
      } else {
        calendarElement.classList.add('light-theme');
        calendarElement.classList.remove('dark-theme');
      }
    }
    this.cdr.markForCheck();
  }

  getTaskPosition(task: Task): {left: number, width: number, top: number, isIndicator: boolean, color: string} {
    if (!this.taskLayout) return {left: 0, width: 0, top: 0, isIndicator: false, color: '#9e9e9e'};
    
    const layout = this.taskLayout.find(t => t.id === task.id);
    return layout ? {
      left: layout.left, 
      width: layout.width, 
      top: layout.top,
      isIndicator: layout.isIndicator,
      color: layout.color
    } : {left: 0, width: 0, top: 0, isIndicator: false, color: '#9e9e9e'};
  }

  private taskLayout: Array<{
    id: number, 
    left: number, 
    width: number, 
    top: number,
    isIndicator: boolean,
    color: string
  }> = [];



  private findDateIndex(date: Date): number {
    return this.dates.findIndex(d => {
      const precision = this.currentPrecision;
      const targetDate = new Date(date);
      
      // 根据当前精度调整比较方式
      switch(precision) {
        case 'year':
          targetDate.setMonth(0, 1);
          targetDate.setHours(0, 0, 0, 0);
          d.setMonth(0, 1);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === targetDate.getTime();
          
        case 'month':
          targetDate.setDate(1);
          targetDate.setHours(0, 0, 0, 0);
          d.setDate(1);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === targetDate.getTime();
          
        case 'week': {
          // 获取周的第一天(周日)
          const weekStart = new Date(targetDate);
          weekStart.setDate(targetDate.getDate() - targetDate.getDay());
          weekStart.setHours(0, 0, 0, 0);
          
          const compareWeekStart = new Date(d);
          compareWeekStart.setDate(d.getDate() - d.getDay());
          compareWeekStart.setHours(0, 0, 0, 0);
          
          return weekStart.getTime() === compareWeekStart.getTime();
        }
        
        case 'day':
          targetDate.setHours(0, 0, 0, 0);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === targetDate.getTime();
          
        case 'hour':
          targetDate.setMinutes(0, 0, 0);
          d.setMinutes(0, 0, 0);
          return d.getTime() === targetDate.getTime();
          
        case 'minute':
          targetDate.setSeconds(0, 0);
          d.setSeconds(0, 0);
          return d.getTime() === targetDate.getTime();
          
        default: 
          return false;
      }
    });
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  ngAfterViewInit() {
    this.importTasks();
    this.dates = [];
    this.taskLayout = [];
    this.generateDates();
    this.scrollToCurrentDate();
    this.calculateTaskLayout();
    this.updateTaskPositions();
    this.cdr.detectChanges();
  }

  ngOnChanges() {
    if (this.tasks) {
      this.tasks = [...this.tasks]; // 触发变更检测
      // this.calculateTaskLayout();
    }
  }

  zoomIn() {
    if (this.precisionIndex + 1 < this.precisionLevels.length) {
      this.precisionIndex++;
      this.currentPrecision = this.getPrecision();
      const facingTime = this.getFacingTime();
      // 完全重置日期和布局
      this.dates = [];
      this.taskLayout = [];
      this.generateDates();
      this.calculateTaskLayout();
      // this.updateTaskPositions();
      this.cdr.detectChanges();
      this.scrollToTime(facingTime);
    }
  }

  zoomOut() {
    if (this.precisionIndex - 1 >= 0) {
      this.precisionIndex--;
      this.currentPrecision = this.getPrecision();
      const facingTime = this.getFacingTime();
      // 完全重置日期和布局
      this.dates = [];
      this.taskLayout = [];
      this.generateDates();
      this.calculateTaskLayout();
      // this.updateTaskPositions();
      this.cdr.detectChanges();
      this.scrollToTime(facingTime);
    }
  }

  private calculateTaskLayout() {
    if (!this.tasks || this.tasks.length === 0 || !this.calendarBody?.nativeElement) {
      this.taskLayout = [];
      return;
    }

    // 确保DOM已更新
    this.cdr.detectChanges();
    
    // 使用setTimeout确保DOM渲染完成
    setTimeout(() => {
      // 获取所有日期单元格元素
      const dateElements = this.calendarBody.nativeElement.querySelectorAll('.date-cell');
      if (dateElements.length === 0) {
        this.taskLayout = [];
        return;
      }

      // 按优先级(降序)和开始时间(升序)排序
      const sortedTasks = [...this.tasks].sort((a, b) => {
        // if (a.priority !== b.priority) return b.priority - a.priority;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.start.getTime() - b.start.getTime();
      });

      // 根据时间精度决定显示方式
      const indicatorTasksMap = new Map<number, Task[]>();
      const normalTasks: Task[] = [];
        
      // 先处理完全包含的任务(小方块)
      sortedTasks.forEach(task => {
        const precision = this.currentPrecision;
        let isContained = false;
        
        // 根据当前精度判断任务是否被一个单元格包含
        switch(precision) {
          case 'year':
            // 年视图：判断是否在同一年
            isContained = task.start.getFullYear() === task.end.getFullYear();
            break;
          case 'month':
            // 月视图：判断是否在同一年同一月
            isContained = task.start.getFullYear() === task.end.getFullYear() && 
                          task.start.getMonth() === task.end.getMonth();
            break;
          case 'week':
            // 周视图：判断是否在同一周
            isContained = this.getWeekNumber(task.start) === this.getWeekNumber(task.end);
            break;
          case 'day':
            // 日视图：判断是否在同一天
            isContained = task.start.getFullYear() === task.end.getFullYear() && 
                          task.start.getMonth() === task.end.getMonth() && 
                          task.start.getDate() === task.end.getDate();
            break;
          case 'hour':
            // 时视图：判断是否在同一小时
            isContained = task.start.getFullYear() === task.end.getFullYear() && 
                          task.start.getMonth() === task.end.getMonth() && 
                          task.start.getDate() === task.end.getDate() && 
                          task.start.getHours() === task.end.getHours();
            break;
          case 'minute':
            // 分视图：判断是否在同一分钟
            isContained = task.start.getFullYear() === task.end.getFullYear() && 
                          task.start.getMonth() === task.end.getMonth() && 
                          task.start.getDate() === task.end.getDate() && 
                          task.start.getHours() === task.end.getHours() && 
                          task.start.getMinutes() === task.end.getMinutes();
            break;
          default:
            break;
        }
        
        if (isContained) {
          const cellIndex = this.findDateIndex(task.start);
          if (cellIndex >= 0) {
            if (!indicatorTasksMap.has(cellIndex)) {
              indicatorTasksMap.set(cellIndex, []);
            }
            indicatorTasksMap.get(cellIndex)!.push(task);
          }
          // console.log(task.title, 'is contained in cell', cellIndex);
        } else {
          // 跨单元格的任务正常显示
          normalTasks.push(task);
          // console.log(task.title, 'is not contained in cell');
        }
      });


      // 处理跨单元格的正常任务
      const lanes: Array<Array<Task>> = [[]];
      const containerRect = this.calendarBody.nativeElement.getBoundingClientRect();
      const scrollLeft = this.calendarBody.nativeElement.scrollLeft;

      // 对normalTasks按开始时间排序
      const sortedNormalTasks = [...normalTasks].sort((a, b) => a.start.getTime() - b.start.getTime());

      
      // 分配任务到不同的行
      for (const task of sortedNormalTasks) {
        // console.log('Processing task:', task.title);
        let placed = false;
        const taskStart = task.start.getTime();
        const taskEnd = task.end.getTime();
        let min_diff = 0; // 最小时间差
        switch(this.currentPrecision) {
          case 'year':
            min_diff = 365 * 24 * 60 * 60 * 1000; // 1年
            break;
          case 'month':
            min_diff = 30 * 24 * 60 * 60 * 1000; // 1月
            break;
          case 'week':
            min_diff = 7 * 24 * 60 * 60 * 1000; // 1周
            break;
          case 'day':
            min_diff = 24 * 60 * 60 * 1000; // 1天
            break;
          case 'hour':
            min_diff = 60 * 60 * 1000; // 1小时
            break;
          case 'minute':
            min_diff = 60 * 1000; // 1分钟              
        }

        // 尝试放入已有行
        for (const lane of lanes) {
          let canPlace = true;
          for (const t of lane) {
            const tStart = t.start.getTime() - min_diff;
            const tEnd = t.end.getTime() + min_diff;
            if (
              (taskStart <= tStart && taskEnd <= tStart) ||
              (taskStart >= tEnd && taskEnd >= tEnd)             
            ) {
              // console.log(task.title, ":", task.start.getTime(), task.end.getTime(), "和", t.title, ":", t.start.getTime(), t.end.getTime(), "不重叠");
              canPlace = true;
            } else {
              canPlace = false;
              // console.log(task.title, 'and', t.title, '重叠了');
            }
          }
          
          // console.log(task.title, 'canPlace:', canPlace);

          if (canPlace) {
            lane.push(task);
            placed = true;
            break;
          }
        }


        // 创建新行
        if (!placed) {
          lanes.push([task]);
        }
      }
        

      // 计算任务位置
      lanes.forEach((lane, laneIndex) => {
        lane.forEach(task => {
          let startIndex = this.findDateIndex(task.start);
          let endIndex = this.findDateIndex(task.end);
          // console.log(task.title, ':', startIndex, endIndex);
          if (startIndex === -1 && endIndex === -1) return;
          if (startIndex === -1) {
            startIndex = 0;
          }
          if (endIndex === -1) {
            endIndex = dateElements.length - 1;
          }
          const startCell = dateElements[startIndex >= 0 ? startIndex : 0];
          const endCell = dateElements[endIndex >= 0 ? endIndex : dateElements.length - 1];

          if (!startCell || !endCell) return;

          const startRect = startCell.getBoundingClientRect();
          const endRect = endCell.getBoundingClientRect();

          const left = startRect.left - containerRect.left + scrollLeft;
          const width = Math.max(endRect.right - startRect.left, startRect.width * 0.5);
          const top = 30 + laneIndex * 30; // 每行30px高度

          this.taskLayout.push({
            id: task.id,
            left,
            width,
            top,
            isIndicator: false,
            color: this.getTaskColor(task)
          });
        });
      });
      indicatorTasksMap.forEach((tasks: Task[], cellIndex: number) => {
        const cell = dateElements[cellIndex];
        if (!cell) return;

        const cellRect = cell.getBoundingClientRect();
        const containerRect = this.calendarBody.nativeElement.getBoundingClientRect();
        
        // 计算小方块位置（均匀分布在单元格内）
        const cellLeft = cellRect.left - containerRect.left + this.calendarBody.nativeElement.scrollLeft;
        const cellTop = cellRect.top - containerRect.top;
        const cellWidth = cellRect.width;
        
        // 每个小方块占用8px宽度，间隔2px
        const indicatorWidth = 8;
        const indicatorSpacing = 2;
        const indicatorsPerRow = Math.max(1, Math.floor(cellWidth / (indicatorWidth + indicatorSpacing)));
        
        tasks.forEach((task: Task, taskIndex: number) => {
          const row = Math.floor(taskIndex / indicatorsPerRow);
          const col = taskIndex % indicatorsPerRow;
          
          const left = cellLeft + col * (indicatorWidth + indicatorSpacing);
          const top = cellTop + row * (indicatorWidth + indicatorSpacing);
          
          this.taskLayout.push({
            id: task.id,
            left,
            width: indicatorWidth,
            top,
            isIndicator: true,
            color: this.getTaskColor(task)
          });
        });
      });
      // 强制更新视图
      this.updateTaskPositions();
    }, 100);
  }

  private updateTaskPositions() {
    // 强制更新视图
    this.cdr.detectChanges();
  }

  getTaskColor(task: Task): string {
    if (task.others.find(o => o.key === 'color')) {
      return task.others.find(o => o.key === 'color')!.value;
    }
    switch(task.status) {
      case 'todo': return '#ddaa00';  // Darker orange
      case 'inProgress': return '#1a78e2';  // Darker blue
      case 'done': return '#3dab40';  // Darker green
      default: return '#757575';  // Darker gray
    }
  }

  getPriorityColor(task: Task): string {
    let hue = 0;
    switch(task.priority) {
      case 1: hue = 0; break;
      case 2: hue = 60; break;
      case 3: hue = 120; break;
      default: hue = 120 + 120 / (task.priority - 2); break;
    };
    const color_str = 'hsl(' + hue + ', 70%, 40%)';
    return color_str;
  }

  generateDates() {
    const today = new Date();
    const precision = this.getPrecision();

    this.dates = [];
    const offset = 100; // 向左和向右各生成100个单元格

    // 生成过去的日期
    for (let i = -offset; i < 0; i++) {
      this.dates.push(this.addTime(today, i, precision));
    }

    // 生成当前日期
    this.dates.push(today);

    // 生成未来的日期
    for (let i = 1; i <= offset; i++) {
      this.dates.push(this.addTime(today, i, precision));
    }

    this.adjustCellWidth();
  }

  addTime(date: Date, offset: number, precision: string): Date {
    const newDate = new Date(date);
    switch (precision) {
      case "day":
        newDate.setDate(newDate.getDate() + offset);
        break;
      case "week":
        newDate.setDate(newDate.getDate() + offset * 7);
        break;
      case "month":
        newDate.setMonth(newDate.getMonth() + offset);
        break;
      case "year":
        newDate.setFullYear(newDate.getFullYear() + offset);
        break;
      case "hour":
        newDate.setHours(newDate.getHours() + offset);
        break;
      case "minute":
        newDate.setMinutes(newDate.getMinutes() + offset);
        break;
    }
    return newDate;
  }

  getPrecision(): string {
    return this.precisionLevels[this.precisionIndex];
  }

  // 添加新任务
  addNewTask(): void {
    const now = new Date();
    const newTask: Task = {
      id: Date.now(), // 使用时间戳作为临时ID
      title: '新任务',
      description: '',
      status: 'todo',
      priority: 5,
      start: new Date(now),
      end: new Date(now.setHours(now.getHours() + 1)),
      others: []
    };
    this.openEditDialog(newTask);
  }

  // 打开编辑对话框
  openEditDialog(task: Task): void {
    this.editingTask = {...task}; // 创建副本避免直接修改
    if (!this.editingTask.others) {
      this.editingTask.others = [];
    }
  }

  // 保存任务
  saveTask(): void {
    if (!this.editingTask) return;
    
    const index = this.tasks.findIndex(t => t.id === this.editingTask!.id);
    if (index >= 0) {
      // 更新现有任务
      this.tasks[index] = this.editingTask;
    } else {
      // 添加新任务
      this.tasks.push(this.editingTask);
    }
    this.closeDialog();
    this.calculateTaskLayout(); // 刷新任务显示
  }

  // 删除任务
  deleteTask(): void {
    if (!this.editingTask) return;
    
    this.tasks = this.tasks.filter(t => t.id !== this.editingTask!.id);
    this.closeDialog();
    this.calculateTaskLayout(); // 刷新任务显示
  }

  // 关闭对话框
  closeDialog(): void {
    this.editingTask = null;
  }

  async exportTasks(): Promise<void> {
    // 转换Date对象为字符串
    const tasksWithStringDates = this.tasks.map(task => ({
      ...task,
      start: task.start.toISOString(),
      end: task.end.toISOString()
    }));
    
    const json = JSON.stringify(tasksWithStringDates, null, 4);
    // console.log('Exported tasks:', json);
    
    invoke<void>("post_data", { url: 'http://172.18.91.245:12345/api/tasks', data: json }).then(_ => {
      // console.log('Export success', json);
    }).catch(error => {
      alert('post failed' + error);
    });
    // this.http.post('http://118.202.30.22:12345/api/tasks', json).subscribe(
    //   response => {
    //     // console.log('HTTP POST Response:', response);
    //     alert('Export success');
    //   },
    //   error => {
    //     console.error('HTTP POST Error:', error);
    //     alert('Export failed');
    //   }
    // );
  }

  async importTasks(): Promise<void> {
    let json = "[]";
    await invoke<string>("fetch_data", { url: 'http://172.18.91.245:12345/api/tasks' }).then(result => {
      // console.log('Read file result:', result);
      json = result;
    }).catch(error => {
      alert('fetch error:' + error);
    });
    // await this.http.get('http://118.202.30.22:12345/api/tasks').subscribe(
    //   response => {
    //     // console.log('HTTP GET Response:', response);
    //     if (!response) {
    //       alert('读取文件失败');
    //       return;
    //     }
    //     json = response.toString();
    //   },
    //   error => {
    //     console.error('HTTP GET Error:', error);
    //     alert('读取文件失败');
    //   }
    // );

    
    try {
      const parsed = JSON.parse(json);
      // console.log('Importing tasks:', parsed);
      // 转换字符串为Date对象
      const tasksWithDates = parsed.map((task: any) => ({
        ...task,
        start: new Date(task.start),
        end: new Date(task.end)
      }));
      
      this.tasks = tasksWithDates;
      this.calculateTaskLayout();
      // console.log('Imported tasks:', this.tasks);
    } catch (e) {
      console.error('导入失败:', e);
      alert('导入失败，请检查JSON格式');
    }
  }

  // 添加其他字段
  addOtherField(): void {
    if (this.editingTask) {
      this.editingTask.others.push({key: '', value: ''});
    }
  }

  // 删除其他字段
  removeOtherField(index: number): void {
    if (this.editingTask) {
      this.editingTask.others.splice(index, 1);
    }
  }

  // 格式化日期部分(yyyy-MM-dd)
  formatDateInput(date: Date): string {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
  }

  // 格式化时间部分(HH:mm)
  formatTimeInput(date: Date): string {
    return `${this.pad(date.getHours())}:${this.pad(date.getMinutes())}`;
  }

  // 更新日期部分
  updateDatePart(field: 'start' | 'end', event: Event): void {
    if (!this.editingTask) return;
    
    const dateString = (event.target as HTMLInputElement).value;
    const [year, month, day] = dateString.split('-').map(Number);
    const oldDate = this.editingTask[field];
    const newDate = new Date(year, month - 1, day, oldDate.getHours(), oldDate.getMinutes());
    this.editingTask[field] = newDate;
  }

  // 更新时间部分
  updateTimePart(field: 'start' | 'end', event: Event): void {
    if (!this.editingTask) return;
    
    const timeString = (event.target as HTMLInputElement).value;
    const [hours, minutes] = timeString.split(':').map(Number);
    const oldDate = this.editingTask[field];
    const newDate = new Date(oldDate.getFullYear(), oldDate.getMonth(), oldDate.getDate(), hours, minutes);
    this.editingTask[field] = newDate;
  }



  formatDate(date: Date): string {
    switch (this.currentPrecision) {
      case "year":
        return `${date.getFullYear()}`;
      case "month":
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}`;
      case "week": {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // 获取周的第一天(周日)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // 获取周的最后一天(周六)
        return `${weekStart.getFullYear()}-${this.pad(weekStart.getMonth() + 1)}-${this.pad(weekStart.getDate())}~${this.pad(weekEnd.getDate())}`;
      }
      case "day":
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
      case "hour":
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())} ${this.pad(date.getHours())}:00`;
      case "minute":
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())} ${this.pad(date.getHours())}:${this.pad(date.getMinutes())}`;
      default:
        return "";
    }
  }

  pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  adjustCellWidth() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    context.font = '16px Arial'; // 根据你的样式调整字体

    let maxWidth = 0;
    this.dates.forEach(date => {
      const text = this.formatDate(date);
      const textWidth = context.measureText(text).width;
      if (textWidth > maxWidth) {
        maxWidth = textWidth;
      }
    });

    // 增加一些额外的宽度以确保文本不会重叠
    this.cellWidth = maxWidth + 10; // 30 是额外的 margin
  }

  onScroll(event: Event) {
    const scrollElement = event.target as HTMLElement;

    // 检查是否需要生成更多日期
    if (
      scrollElement.scrollLeft >=
      scrollElement.scrollWidth -
      scrollElement.clientWidth
    ) {
      this.appendDates();
    } else if (scrollElement.scrollLeft <= 0) {
      this.prependDates();
    }
  }

  onWheel(event: WheelEvent) {
    const element = this.calendarBody.nativeElement;
    // 滚轮滚动的竖向距离
    const deltaY = event.deltaY;
    // 将竖向滚动的距离映射为横向滚动的距离
    element.scrollLeft += deltaY;
    // 阻止默认的竖向滚动行为
    event.preventDefault();
    // this.onScroll(event);
  }

  appendDates() {
    const precision = this.getPrecision();
    const lastDate = this.dates[this.dates.length - 1];

    for (let i = 1; i <= 100; i++) {
      this.dates.push(this.addTime(lastDate, i, precision));
    }
    // console.log('Appended dates:', this.dates);
    
    // 更新任务位置
    const facingTime = this.getFacingTime();
    // 完全重置日期和布局
    this.taskLayout = [];
    this.calculateTaskLayout();
    // this.updateTaskPositions();
    this.cdr.detectChanges();
    this.scrollToTime(facingTime);
  }

  prependDates() {
    const precision = this.getPrecision();
    const firstDate = this.dates[0];

    for (let i = -1; i >= -100; i--) {
      this.dates.unshift(this.addTime(firstDate, i, precision));
    }
    // console.log('Prepended dates:', this.dates, this.dates.length);
    
    // 更新任务位置
    const facingTime = this.getFacingTime();
    // 完全重置日期和布局
    this.taskLayout = [];
    this.calculateTaskLayout();
    // this.updateTaskPositions();
    this.cdr.detectChanges();
    this.scrollToTime(facingTime);
  }

  scrollToCurrentDate() {
    this.scrollToTime(new Date());
  }

  scrollToTime(date: Date) {
    if (!date || !this.dates || this.dates.length === 0) return;
    
    const precision = this.getPrecision();
    const startDate = this.dates[0];
    if (!startDate) return;
    
    // 计算两个日期之间的差值（单位取决于当前精度）
    let diff = 0;
    switch(precision) {
        case 'year':
            diff = date.getFullYear() - startDate.getFullYear();
            break;
        case 'month':
            diff = (date.getFullYear() - startDate.getFullYear()) * 12 + 
                   (date.getMonth() - startDate.getMonth());
            break;
        case 'week':
            diff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            break;
        case 'day':
            diff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            break;
        case 'hour':
            diff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60));
            break;
        case 'minute':
            diff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60));
            break;
    }
    
    // 获取所有日期单元格元素
    const dateElements = this.calendarBody.nativeElement.querySelectorAll('.date-cell');
    
    if (dateElements.length > 0 && diff >= 0 && diff < dateElements.length) {
        // 计算目标元素的左边界位置
        const targetElement = dateElements[diff];
        const containerRect = this.calendarBody.nativeElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        
        // 滚动到使目标元素居中
        const scrollLeft = targetRect.left - containerRect.left + 
                          this.calendarBody.nativeElement.scrollLeft - 
                          (containerRect.width / 2) + 
                          (targetRect.width / 2);
        
        this.calendarBody.nativeElement.scrollLeft = scrollLeft;
    }
  }


  isSamePrecision(date1: Date, date2: Date): boolean {
    switch (this.currentPrecision) {
      case "year":
        return date1.getFullYear() === date2.getFullYear();
      case "month":
        return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth();
      case "week": {
        const week1 = this.getWeekNumber(date1);
        const week2 = this.getWeekNumber(date2);
        return date1.getFullYear() === date2.getFullYear() && week1 === week2;
      }
      case "day":
        return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate();
      case "hour":
        return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate() && date1.getHours() === date2.getHours();
      case "minute":
        return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate() && date1.getHours() === date2.getHours() && date1.getMinutes() === date2.getMinutes();
      default:
        return false;
    }
  }

  getFacingTime(): Date {
    if (!this.calendarBody?.nativeElement) {
      return new Date();
    }

    const container = this.calendarBody.nativeElement;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;
    
    // 获取所有日期单元格
    const dateElements = container.querySelectorAll('.date-cell');
    let centerDate: Date | null = null;
    
    // 找到中心位置对应的单元格
    for (const cell of dateElements) {
      const cellRect = cell.getBoundingClientRect();
      if (cellRect.left <= centerX && cellRect.right >= centerX) {
        const cellIndex = Array.from(dateElements).indexOf(cell);
        centerDate = this.dates[cellIndex];
        break;
      }
    }

    // 如果没有找到精确匹配的单元格，取最接近的
    if (!centerDate) {
      let minDistance = Infinity;
      let closestIndex = 0;
      
      for (let i = 0; i < dateElements.length; i++) {
        const cellRect = dateElements[i].getBoundingClientRect();
        const cellCenter = cellRect.left + cellRect.width / 2;
        const distance = Math.abs(cellCenter - centerX);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
      
      centerDate = this.dates[closestIndex];
    }

    // 根据当前精度返回对应时间
    const date = new Date(centerDate);
    switch (this.currentPrecision) {
      case "year":
        date.setMonth(0, 1);
        date.setHours(0, 0, 0, 0);
        break;
      case "month":
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
      case "week":
        date.setHours(0, 0, 0, 0);
        break;
      case "day":
        date.setHours(0, 0, 0, 0);
        break;
      case "hour":
        date.setMinutes(0, 0, 0);
        break;
      case "minute":
        date.setSeconds(0, 0);
        break;
    }
    
    return date;
  }

  getTaskProgress(task: Task): number {
    // console.log(task.title, task.others);
    if (task.others.find(o => o.key === 'progress')) {
      const progress = task.others.find(o => o.key === 'progress')!.value;
      return Number(progress);
    } else {
      return 0;
    }
  }

  getTaskTag(task: Task): string | undefined {
    if (task.others.find(o => o.key === 'tag')) {
      const tag = task.others.find(o => o.key === 'tag')!.value;
      return tag;
    } else {
      return undefined;
    }
  }
}

@NgModule({
  imports: [CommonModule, CalendarComponent],
  exports: [CalendarComponent],
})
export class CalendarModule { }

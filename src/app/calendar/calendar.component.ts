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
import {
  writeTextFile,
  readTextFile,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { MessageService, MessageType } from "../core/services/message.service";
import { TaskEditComponent } from "../task-edit/task-edit.component";

@Component({
  selector: "app-calendar",
  templateUrl: "./calendar.component.html",
  styleUrls: ["./calendar.component.css"],
  standalone: true,
  imports: [CommonModule, FormsModule, TaskEditComponent],
})
export class CalendarComponent implements AfterViewInit, OnChanges {
  @ViewChild("calendarBody") calendarBody!: ElementRef;
  @Input() tasks: Task[] = [];

  centerLineShow: boolean = true;
  dates: Date[] = [];
  currentPrecision: string = "day";
  cellWidth: number = 100; // 初始单元格宽度
  precisionLevels = ["year", "month", "week", "day", "hour", "minute"]; // 添加周、小时和分钟
  precisionIndex: number = 3; // 初始精度为 'day'
  editingTask: Task | null = null; // 当前编辑的任务
  darkMode: boolean = false;
  private taskLayout: Array<{
    id: number;
    left: number;
    width: number;
    top: number;
    isIndicator: boolean;
    color: string;
  }> = [];

  constructor(
    private cdr: ChangeDetectorRef,
    private messageService: MessageService
  ) {
    this.currentPrecision = this.precisionLevels[this.precisionIndex];
    setTimeout(() => {
      this.scrollToCurrentDate();
    }, 100);
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem("calendarTheme");
    if (savedTheme) {
      this.darkMode = savedTheme === "dark";
      // Delay theme application to avoid change detection issues
      setTimeout(() => this.applyTheme(), 0);
    }
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    this.applyTheme();
    // Save theme preference
    localStorage.setItem("calendarTheme", this.darkMode ? "dark" : "light");
  }

  private applyTheme() {
    // 实际应用主题样式
    const calendarElement = this.calendarBody?.nativeElement?.parentElement;
    if (calendarElement) {
      if (this.darkMode) {
        calendarElement.classList.add("dark-theme");
        calendarElement.classList.remove("light-theme");
      } else {
        calendarElement.classList.add("light-theme");
        calendarElement.classList.remove("dark-theme");
      }
    }
    this.cdr.markForCheck();
  }

  getTaskPosition(task: Task): {
    left: number;
    width: number;
    top: number;
    isIndicator: boolean;
    color: string;
  } {
    if (!this.taskLayout)
      return {
        left: 0,
        width: 0,
        top: 0,
        isIndicator: false,
        color: "#9e9e9e",
      };

    const layout = this.taskLayout.find((t) => t.id === task.id);
    return layout
      ? {
        left: layout.left,
        width: layout.width,
        top: layout.top,
        isIndicator: layout.isIndicator,
        color: layout.color,
      }
      : {
        left: 0,
        width: 0,
        top: 0,
        isIndicator: false,
        color: "#9e9e9e",
      };
  }

  timeToPrecision(time: Date): Date {
    const newDate = new Date(time);
    switch (this.currentPrecision) {
      case "year":
        newDate.setMonth(0, 1);
        newDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        newDate.setDate(1);
        newDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        const weekStart = new Date(newDate);
        weekStart.setDate(newDate.getDate() - newDate.getDay());
        weekStart.setHours(0, 0, 0, 0);
        newDate.setTime(weekStart.getTime());
        break;
      case "day":
        newDate.setHours(0, 0, 0, 0);
        break;
      case "hour":
        newDate.setMinutes(0, 0, 0);
        break;
      case "minute":
        newDate.setSeconds(0, 0);
        break;
      default:
        break;
    }
    return newDate;
  }

  private findDateIndex(date: Date): number {
    return this.dates.findIndex((d) => {
      const targetDate = new Date(date);
      return (
        this.timeToPrecision(d).getTime() ===
        this.timeToPrecision(targetDate).getTime()
      );
    });
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  ngAfterViewInit() {
    this.importTasks();
    this.dates = [];
    this.taskLayout = [];
    this.generateDates();
    this.scrollToCurrentDate();
    this.calculateTaskLayout();
    this.cdr.detectChanges();
  }

  ngOnChanges() {
    if (this.tasks) {
      this.tasks = [...this.tasks]; // 触发变更检测
      // this.calculateTaskLayout();
    }
  }

  async totalViewUpdate() {
    const facingTime = this.getFacingTime();
    // this.messageService.addMessage('1', MessageType.DEBUG, 1);
    // await new Promise(resolve => setTimeout(resolve, 1000));
    this.currentPrecision = this.getPrecision();
    // this.messageService.addMessage('2', MessageType.DEBUG, 1);
    // await new Promise(resolve => setTimeout(resolve, 1000));
    // 完全重置日期和布局
    this.dates = [];
    this.taskLayout = [];
    this.generateDates();
    // this.messageService.addMessage('3', MessageType.DEBUG, 1);
    // await new Promise(resolve => setTimeout(resolve, 1000));
    this.calculateTaskLayout();
    // this.messageService.addMessage('4', MessageType.DEBUG, 1);
    // await new Promise(resolve => setTimeout(resolve, 1000));
    this.cdr.detectChanges();
    // this.messageService.addMessage('5', MessageType.DEBUG, 1);
    // await new Promise(resolve => setTimeout(resolve, 1000));
    this.scrollToTime(facingTime);
    // this.messageService.addMessage('6', MessageType.DEBUG, 1);
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }

  zoomIn() {
    if (this.precisionIndex + 1 < this.precisionLevels.length) {
      this.precisionIndex++;
      this.totalViewUpdate();
    }
  }

  zoomOut() {
    if (this.precisionIndex - 1 >= 0) {
      this.precisionIndex--;
      this.totalViewUpdate();
    }
  }

  private calculateTaskLayout() {
    if (
      !this.tasks ||
      this.tasks.length === 0 ||
      !this.calendarBody?.nativeElement
    ) {
      this.taskLayout = [];
      return;
    }

    // 确保DOM已更新
    this.cdr.detectChanges();

    // 使用setTimeout确保DOM渲染完成
    setTimeout(() => {
      // 获取所有日期单元格元素
      const dateElements =
        this.calendarBody.nativeElement.querySelectorAll(".date-cell");
      if (dateElements.length === 0) {
        this.taskLayout = [];
        return;
      }

      // 按优先级(降序)和结束时间(升序)排序
      const sortedTasks = [...this.tasks].sort((a, b) => {
        // if (a.priority !== b.priority) return b.priority - a.priority;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.end.getTime() - b.end.getTime();
      });

      // 根据时间精度决定显示方式
      const indicatorTasksMap = new Map<number, Task[]>();
      const normalTasks: Task[] = [];

      // 先处理完全包含的任务(小方块)
      sortedTasks.forEach((task) => {
        const precision = this.currentPrecision;
        let isContained = false;

        // 根据当前精度判断任务是否被一个单元格包含
        switch (precision) {
          case "year":
            // 年视图：判断是否在同一年
            isContained =
              task.start.getFullYear() === task.end.getFullYear();
            break;
          case "month":
            // 月视图：判断是否在同一年同一月
            isContained =
              task.start.getFullYear() ===
              task.end.getFullYear() &&
              task.start.getMonth() === task.end.getMonth();
            break;
          case "week":
            // 周视图：判断是否在同一周
            isContained =
              this.getWeekNumber(task.start) ===
              this.getWeekNumber(task.end);
            break;
          case "day":
            // 日视图：判断是否在同一天
            isContained =
              task.start.getFullYear() ===
              task.end.getFullYear() &&
              task.start.getMonth() === task.end.getMonth() &&
              task.start.getDate() === task.end.getDate();
            break;
          case "hour":
            // 时视图：判断是否在同一小时
            isContained =
              task.start.getFullYear() ===
              task.end.getFullYear() &&
              task.start.getMonth() === task.end.getMonth() &&
              task.start.getDate() === task.end.getDate() &&
              task.start.getHours() === task.end.getHours();
            break;
          case "minute":
            // 分视图：判断是否在同一分钟
            isContained =
              task.start.getFullYear() ===
              task.end.getFullYear() &&
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
      const containerRect =
        this.calendarBody.nativeElement.getBoundingClientRect();
      const scrollLeft = this.calendarBody.nativeElement.scrollLeft;

      // 对normalTasks按结束时间排序
      const sortedNormalTasks = [...normalTasks].sort(
        (a, b) => a.end.getTime() - b.end.getTime()
      );

      // 分配任务到不同的行
      for (const task of sortedNormalTasks) {
        // console.log('Processing task:', task.title);
        let placed = false;
        const taskStart = task.start.getTime();
        const taskEnd = task.end.getTime();
        let min_diff = this.getTimeSpanOfPrecision(); // 最小时间差

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
        lane.forEach((task) => {
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
          const startCell =
            dateElements[startIndex >= 0 ? startIndex : 0];
          const endCell =
            dateElements[
            endIndex >= 0 ? endIndex : dateElements.length - 1
            ];

          if (!startCell || !endCell) return;

          const startRect = startCell.getBoundingClientRect();
          const startRect_time = this.timeToPrecision(task.start);
          const endRect = endCell.getBoundingClientRect();
          const endRect_time = this.timeToPrecision(task.end);
          // this.messageService.addMessage(`${task.title} startRect_time: ${startRect_time}, endRect_time: ${endRect_time}`, MessageType.DEBUG, 20);

          const start_time_diff =
            task.start.getTime() - startRect_time.getTime();
          const precision_time_span = this.getTimeSpanOfPrecision();
          const start_ratio = start_time_diff / precision_time_span;
          const end_time_diff =
            task.end.getTime() - endRect_time.getTime();
          const end_ratio = end_time_diff / precision_time_span;
          // this.messageService.addMessage(`start_ratio: ${start_ratio}, end_ratio: ${end_ratio}`, MessageType.DEBUG, 20);

          // const width_ratio = (task.end.getTime() - task.start.getTime()) / precision_time_span;

          const left =
            startRect.left -
            containerRect.left +
            scrollLeft +
            startRect.width * start_ratio;
          const right =
            endRect.left -
            containerRect.left +
            scrollLeft +
            endRect.width * end_ratio;
          // const width = width_ratio * startRect.width - 20; // 2倍的margin+padding
          const width = right - left - 20; // 2倍的margin+padding
          const top = 30 + laneIndex * 30; // 每行30px高度

          this.taskLayout.push({
            id: task.id,
            left,
            width,
            top,
            isIndicator: false,
            color: this.getTaskColor(task),
          });
        });
      });
      indicatorTasksMap.forEach((tasks: Task[], cellIndex: number) => {
        const cell = dateElements[cellIndex];
        if (!cell) return;

        const cellRect = cell.getBoundingClientRect();
        const containerRect =
          this.calendarBody.nativeElement.getBoundingClientRect();

        // 计算小方块位置（均匀分布在单元格内）
        const cellLeft =
          cellRect.left -
          containerRect.left +
          this.calendarBody.nativeElement.scrollLeft;
        const cellTop = cellRect.top - containerRect.top;
        const cellWidth = cellRect.width;

        // 每个小方块占用8px宽度，间隔2px
        const indicatorWidth = 8;
        const indicatorSpacing = 2;
        const indicatorsPerRow = Math.max(
          1,
          Math.floor(cellWidth / (indicatorWidth + indicatorSpacing))
        );

        tasks.forEach((task: Task, taskIndex: number) => {
          const row = Math.floor(taskIndex / indicatorsPerRow);
          const col = taskIndex % indicatorsPerRow;

          const left =
            cellLeft + col * (indicatorWidth + indicatorSpacing);
          const top =
            cellTop + row * (indicatorWidth + indicatorSpacing);

          this.taskLayout.push({
            id: task.id,
            left,
            width: indicatorWidth,
            top,
            isIndicator: true,
            color: this.getTaskColor(task),
          });
        });
      });
      // 强制更新视图
      this.cdr.detectChanges();
    }, 100);
  }

  private getTimeSpanOfPrecision() {
    let precision_time_span = 0;
    switch (this.currentPrecision) {
      case "year":
        precision_time_span = 365 * 24 * 60 * 60 * 1000; // 1年
        break;
      case "month":
        precision_time_span = 30 * 24 * 60 * 60 * 1000; // 1月
        break;
      case "week":
        precision_time_span = 7 * 24 * 60 * 60 * 1000; // 1周
        break;
      case "day":
        precision_time_span = 24 * 60 * 60 * 1000; // 1天
        break;
      case "hour":
        precision_time_span = 60 * 60 * 1000; // 1小时
        break;
      case "minute":
        precision_time_span = 60 * 1000; // 1分钟
    }
    return precision_time_span;
  }

  getTaskColor(task: Task): string {
    if (task.others.find((o) => o.key === "color")) {
      return task.others.find((o) => o.key === "color")!.value;
    }
    switch (task.status) {
      case "todo":
        return "#ddaa00"; // Darker orange
      case "inProgress":
        return "#1a78e2"; // Darker blue
      case "done":
        return "#3dab40"; // Darker green
      case "cancelled":
        return "#9e9e9e"; // Darker gray
      default:
        return "#757575"; // Darker gray
    }
  }

  getPriorityColor(task: Task): string {
    let hue = 0;
    switch (task.priority) {
      case 1:
        hue = 0;
        break;
      case 2:
        hue = 60;
        break;
      case 3:
        hue = 120;
        break;
      default:
        hue = 120 + 120 / (task.priority - 2);
        break;
    }
    const color_str = "hsl(" + hue + ", 70%, 40%)";
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
      title: "新任务",
      description: "",
      status: "todo",
      priority: 5,
      start: new Date(now),
      end: new Date(now.setHours(now.getHours() + 1)),
      others: [],
    };
    this.openEditDialog(newTask);
  }

  // 打开编辑对话框
  openEditDialog(task: Task): void {
    this.editingTask = { ...task }; // 创建副本避免直接修改
    if (!this.editingTask.others) {
      this.editingTask.others = [];
    }
  }

  // 关闭对话框
  closeDialog(): void {
    this.editingTask = null;
    this.totalViewUpdate();
  }

  onTaskSave(updatedTask: Task): void {
    const index = this.tasks.findIndex((t) => t.id === updatedTask.id);
    if (index !== -1) {
      this.tasks[index] = updatedTask;
    } else {
      this.tasks.push(updatedTask);
    }
    this.exportTasks();
    this.closeDialog();
  }

  onTaskDelete(): void {
    if (this.editingTask) {
      this.tasks = this.tasks.filter(
        (t) => t.id !== this.editingTask?.id
      );
      this.closeDialog();
    }
  }

  async REINIT_profile(): Promise<void> {
    this.messageService.addMessage(
      "重置配置文件,操作不当可能损失全部数据!",
      MessageType.WARNING,
      10
    );
    this.messageService.addMessage(
      "请在更改完成后趁全部视图还存在时点击**上传(⭱)**按钮",
      MessageType.WARNING,
      10
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    if (confirm("确认重置配置文件？")) {
      this.init_local_profile();
    }
  }

  init_local_profile(): string {
    const remote = prompt("请输入远程位置(如果没有则留空):");
    if (remote) {
      writeTextFile("profile.json", remote, {
        baseDir: BaseDirectory.AppLocalData,
      })
        .then((_) => {
          console.log("Write profile result:", remote);
        })
        .catch((error) => {
          // alert('write error:' + error);
          this.messageService.addMessage(
            "写入配置文件失败" + error,
            MessageType.ERROR
          );
        });
      return remote;
    } else {
      alert("没有远程位置，将存储在本地");
      writeTextFile("profile.json", "", {
        baseDir: BaseDirectory.AppLocalData,
      })
        .then((_) => {
          console.log("local profile created");
        })
        .catch((error) => {
          // alert('write error:' + error);
          this.messageService.addMessage(
            "创建配置文件失败" + error,
            MessageType.ERROR
          );
        });
      return "";
    }
  }

  async read_local_profile(): Promise<string> {
    return await readTextFile("profile.json", {
      baseDir: BaseDirectory.AppLocalData,
    })
      .then((result) => {
        console.log("Read profile result:", result);
        try {
          return result;
        } catch (e) {
          console.error("读取配置文件失败:", e);
          // alert('读取配置文件失败，请检查JSON格式');
          this.messageService.addMessage(
            "读取配置文件失败，请检查JSON格式",
            MessageType.ERROR
          );
          return "";
        }
      })
      .catch((error) => {
        console.error("读取配置文件失败:", error);
        // alert('需要初始化配置文件');
        this.messageService.addMessage(
          "需要初始化配置文件",
          MessageType.WARNING
        );
        return this.init_local_profile();
      });
  }

  async read_local_file(): Promise<string> {
    return await readTextFile("Tasks.json", {
      baseDir: BaseDirectory.AppLocalData,
    })
      .then((result) => {
        console.log("Read file result:", result);
        return result;
      })
      .catch((error) => {
        console.error("读取文件失败:", error);
        // alert('没有找到文件');
        this.messageService.addMessage(
          "没有找到文件",
          MessageType.ERROR
        );
        return "[]";
      });
  }

  async write_local_file(json: string): Promise<void> {
    return await writeTextFile("Tasks.json", json, {
      baseDir: BaseDirectory.AppLocalData,
    })
      .then((_) => {
        console.log("Write file result:", json);
      })
      .catch((error) => {
        console.error("写入文件失败:", error);
        // alert('写入文件失败');
        this.messageService.addMessage(
          "写入文件失败",
          MessageType.ERROR
        );
      });
  }

  async exportTasks(): Promise<void> {
    // 转换Date对象为字符串
    const tasksWithStringDates = this.tasks.map((task) => ({
      ...task,
      start: task.start.toISOString(),
      end: task.end.toISOString(),
    }));

    const json = JSON.stringify(tasksWithStringDates, null, 4);
    // console.log('Exported tasks:', json);

    const remote = await this.read_local_profile();
    if (remote.startsWith("http://") || remote.startsWith("https://")) {
      // 上传到远程
      invoke<void>("post_data", { url: remote, data: json })
        .then((_) => {
          // console.log('Export success', json);
        })
        .catch((error) => {
          alert("post failed" + error);
        });
    } else {
      // 保存到本地
      await this.write_local_file(json);
    }
    this.messageService.addMessage("导出成功", MessageType.SUCCESS);
    this.calculateTaskLayout();
    this.cdr.detectChanges();
  }

  async importTasks(): Promise<void> {
    const remote = await this.read_local_profile();
    let json = "";
    if (remote.startsWith("http://") || remote.startsWith("https://")) {
      // 从远程导入
      setTimeout(async () => {
        await invoke<string>("fetch_data", { url: remote })
          .then((result) => {
            // console.log('Read file result:', result);
            json = result;
          })
          .catch((error) => {
            alert("fetch error:" + error);
          });
      }, 1000);
    } else {
      json = await this.read_local_file();
    }

    try {
      const parsed = JSON.parse(json);
      // console.log('Importing tasks:', parsed);
      // 转换字符串为Date对象
      const tasksWithDates = parsed.map((task: any) => ({
        ...task,
        start: new Date(task.start),
        end: new Date(task.end),
      }));

      this.tasks = tasksWithDates;
      this.messageService.addMessage("导入成功", MessageType.SUCCESS);
      this.calculateTaskLayout();
      this.cdr.detectChanges();
    } catch (e) {
      console.error("导入失败:", e);
      // alert('导入失败，请检查JSON格式');
      this.messageService.addMessage(
        "导入失败，请检查JSON格式",
        MessageType.ERROR
      );
    }
  }

  // 添加其他字段
  addOtherField(): void {
    if (this.editingTask) {
      this.editingTask.others.push({ key: "", value: "" });
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
    return `${date.getFullYear()}-${this.pad(
      date.getMonth() + 1
    )}-${this.pad(date.getDate())}`;
  }

  // 格式化时间部分(HH:mm)
  formatTimeInput(date: Date): string {
    return `${this.pad(date.getHours())}:${this.pad(date.getMinutes())}`;
  }

  // 更新日期部分
  updateDatePart(field: "start" | "end", event: Event): void {
    if (!this.editingTask) return;

    const dateString = (event.target as HTMLInputElement).value;
    const [year, month, day] = dateString.split("-").map(Number);
    const oldDate = this.editingTask[field];
    const newDate = new Date(
      year,
      month - 1,
      day,
      oldDate.getHours(),
      oldDate.getMinutes()
    );
    this.editingTask[field] = newDate;
  }

  // 更新时间部分
  updateTimePart(field: "start" | "end", event: Event): void {
    if (!this.editingTask) return;

    const timeString = (event.target as HTMLInputElement).value;
    const [hours, minutes] = timeString.split(":").map(Number);
    const oldDate = this.editingTask[field];
    const newDate = new Date(
      oldDate.getFullYear(),
      oldDate.getMonth(),
      oldDate.getDate(),
      hours,
      minutes
    );
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
        return `${weekStart.getFullYear()}-${this.pad(
          weekStart.getMonth() + 1
        )}-${this.pad(weekStart.getDate())}~${this.pad(
          weekEnd.getDate()
        )}`;
      }
      case "day":
        return `${date.getFullYear()}-${this.pad(
          date.getMonth() + 1
        )}-${this.pad(date.getDate())}`;
      case "hour":
        return `${date.getFullYear()}-${this.pad(
          date.getMonth() + 1
        )}-${this.pad(date.getDate())} ${this.pad(date.getHours())}:00`;
      case "minute":
        return `${date.getFullYear()}-${this.pad(
          date.getMonth() + 1
        )}-${this.pad(date.getDate())} ${this.pad(
          date.getHours()
        )}:${this.pad(date.getMinutes())}`;
      default:
        return "";
    }
  }

  pad(value: number): string {
    return value.toString().padStart(2, "0");
  }

  adjustCellWidth() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    // 获取字体
    const font = getComputedStyle(document.body).getPropertyValue("font");
    context.font = font;
    // this.messageService.addMessage(font, MessageType.DEBUG);

    let maxWidth = 0;
    this.dates.forEach((date) => {
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
      scrollElement.scrollWidth - scrollElement.clientWidth
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

  async scrollToTime(date: Date) {
    // this.messageService.addMessage(`scroll to time ${date.toString()}`, MessageType.DEBUG, 10);
    if (!date || !this.dates || this.dates.length === 0) return;
    const startDate = this.dates[0];
    if (!startDate) return;

    // 计算两个日期之间的差值（单位取决于当前精度）
    let diff = date.getTime() - startDate.getTime();
    diff = diff / this.getTimeSpanOfPrecision();

    // 获取所有日期单元格元素
    const dateElements =
      this.calendarBody.nativeElement.querySelectorAll(".date-cell");

    if (
      dateElements.length > 0 &&
      diff >= 0 &&
      diff < dateElements.length
    ) {
      // 计算目标元素的左边界位置
      const targetElement = dateElements[Math.floor(diff)];
      const containerRect =
        this.calendarBody.nativeElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      // 滚动到使目标元素居中
      const scrollLeft =
        targetRect.left -
        containerRect.left +
        this.calendarBody.nativeElement.scrollLeft -
        containerRect.width / 2 +
        targetRect.width * (diff % 1);
      this.calendarBody.nativeElement.scrollLeft = scrollLeft;
    }
    let sig = true;
    while (sig) {
      const diff = this.getFacingTime().getTime() - date.getTime();
      const ratio = Math.abs(diff) / this.getTimeSpanOfPrecision();
      let scrollLeft = this.calendarBody.nativeElement.scrollLeft;
      if (diff > 0) {
        scrollLeft -= this.cellWidth * ratio;
        if (scrollLeft < 0) {
          scrollLeft = 0;
          const precision = this.getPrecision();
          const firstDate = this.dates[0];

          for (let i = -1; i >= -100; i--) {
            this.dates.unshift(
              this.addTime(firstDate, i, precision)
            );
          }
          // 完全重置日期和布局
          this.taskLayout = [];
          this.calculateTaskLayout();
          // this.updateTaskPositions();
          this.cdr.detectChanges();
        }
      } else {
        scrollLeft += this.cellWidth * ratio;
        if (
          scrollLeft >
          this.calendarBody.nativeElement.scrollWidth -
          this.calendarBody.nativeElement.clientWidth
        ) {
          scrollLeft =
            this.calendarBody.nativeElement.scrollWidth -
            this.calendarBody.nativeElement.clientWidth;
          const precision = this.getPrecision();
          const lastDate = this.dates[this.dates.length - 1];

          for (let i = 1; i <= 100; i++) {
            this.dates.push(this.addTime(lastDate, i, precision));
          }
          // 完全重置日期和布局
          this.taskLayout = [];
          this.calculateTaskLayout();
          // this.updateTaskPositions();
          this.cdr.detectChanges();
        }
      }
      if (this.cellWidth * ratio < 1) {
        sig = false;
      }
      this.calendarBody.nativeElement.scrollLeft = scrollLeft;
      // this.messageService.addMessage(`scroll left ${scrollLeft}`, MessageType.DEBUG, 1);
      // await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  isSamePrecision(date1: Date, date2: Date): boolean {
    switch (this.currentPrecision) {
      case "year":
        return date1.getFullYear() === date2.getFullYear();
      case "month":
        return (
          date1.getFullYear() === date2.getFullYear() &&
          date1.getMonth() === date2.getMonth()
        );
      case "week": {
        const week1 = this.getWeekNumber(date1);
        const week2 = this.getWeekNumber(date2);
        return (
          date1.getFullYear() === date2.getFullYear() &&
          week1 === week2
        );
      }
      case "day":
        return (
          date1.getFullYear() === date2.getFullYear() &&
          date1.getMonth() === date2.getMonth() &&
          date1.getDate() === date2.getDate()
        );
      case "hour":
        return (
          date1.getFullYear() === date2.getFullYear() &&
          date1.getMonth() === date2.getMonth() &&
          date1.getDate() === date2.getDate() &&
          date1.getHours() === date2.getHours()
        );
      case "minute":
        return (
          date1.getFullYear() === date2.getFullYear() &&
          date1.getMonth() === date2.getMonth() &&
          date1.getDate() === date2.getDate() &&
          date1.getHours() === date2.getHours() &&
          date1.getMinutes() === date2.getMinutes()
        );
      default:
        return false;
    }
  }

  // 我实在没明白为啥会有那么奇怪的差异
  getMagicNumber(precision: string): number {
    switch (precision) {
      case "year":
        return 53 / 365;
      case "month":
        return 1 / 30;
      case "week":
        return 20 / 24 / 7;
      case "day":
        return -5 / 24;
      case "hour":
        return -5 / 60;
      case "minute":
        return -21 / 60;
      default:
        return 0;
    }
  }

  getFacingTime(): Date {
    if (!this.calendarBody?.nativeElement) {
      return new Date();
    }

    const container = this.calendarBody.nativeElement;
    const containerRect = container.getBoundingClientRect();
    let centerX = containerRect.left + containerRect.width / 2;

    // 获取所有日期单元格
    const dateElements = container.querySelectorAll(".date-cell");
    let centerDate: Date | null = null;

    // 找到中心位置对应的单元格
    for (const cell of dateElements) {
      const cellRect = cell.getBoundingClientRect();
      if (cellRect.left <= centerX && cellRect.right >= centerX) {
        const cellIndex = Array.from(dateElements).indexOf(cell);
        centerDate = this.dates[cellIndex];

        // 计算中心位置在当前单元格中的精确偏移比例
        const offset =
          centerX -
          cellRect.left -
          cellRect.width / 2 +
          cellRect.width * this.getMagicNumber(this.currentPrecision);
        const ratio = offset / cellRect.width;

        // 根据当前精度计算出精确的时间
        const precisionTimeSpan = this.getTimeSpanOfPrecision();
        const timeOffset = precisionTimeSpan * ratio;

        const newDate = new Date(centerDate);
        newDate.setTime(newDate.getTime() + timeOffset);

        return newDate;
      }
    }

    // 如果没有找到对应的单元格，返回当前日期
    return new Date();
  }

  getTaskProgress(task: Task): number {
    // console.log(task.title, task.others);
    if (task.others.find((o) => o.key === "progress")) {
      const progress = task.others.find(
        (o) => o.key === "progress"
      )!.value;
      return Number(progress);
    } else {
      return 0;
    }
  }

  getTaskTag(task: Task): string | undefined {
    if (task.others.find((o) => o.key === "tag")) {
      const tag = task.others.find((o) => o.key === "tag")!.value;
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

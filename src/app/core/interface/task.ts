export interface Task {
    id: number;
    title: string;
    description: string;
    status: 'todo' | 'inProgress' | 'done';
    priority: number;
    start: Date;
    end: Date;
    others: any[];
}
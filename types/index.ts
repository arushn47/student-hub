// User Profile (extends Supabase auth.users)
export interface Profile {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    created_at: string
}

// Note
export interface Note {
    id: string
    user_id: string
    title: string
    content: string | null
    plain_text: string | null
    is_pinned: boolean
    created_at: string
    updated_at: string
}

// Task
export interface Task {
    id: string
    user_id: string
    title: string
    description: string | null
    status: 'todo' | 'in-progress' | 'done'
    priority: 'low' | 'medium' | 'high'
    due_date: string | null
    parent_task_id: string | null
    created_at: string
    updated_at: string
}

// Class Schedule
export interface ClassSchedule {
    id: string
    user_id: string
    name: string
    short_name: string | null
    instructor: string | null
    location: string | null
    color: string
    day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6
    start_time: string
    end_time: string
    semester_id: string | null
    created_at: string
}

// Semester
export interface Semester {
    id: string
    user_id: string
    name: string
    start_date: string
    end_date: string
    is_active: boolean
    created_at: string
}

// Semester Break (holidays, exam periods, etc.)
export interface SemesterBreak {
    id: string
    semester_id: string
    user_id: string
    name: string
    start_date: string
    end_date: string
    break_type: 'holiday' | 'exam_period' | 'break'
}

// Attendance Record
export interface AttendanceRecord {
    id: string
    user_id: string
    class_schedule_id: string | null
    date: string
    status: 'present' | 'absent' | 'cancelled'
    semester_id: string | null
    created_at: string
}

// Chat Message
export interface ChatMessage {
    id: string
    user_id: string
    role: 'user' | 'assistant'
    content: string
    created_at: string
}

// Quiz Question (for AI-generated quizzes)
export interface QuizQuestion {
    question: string
    options: string[]
    correctAnswer: number
    explanation?: string
}

// AI Task Breakdown
export interface TaskBreakdown {
    subtasks: {
        title: string
        estimatedMinutes?: number
    }[]
}

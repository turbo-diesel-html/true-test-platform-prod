import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://fkdkrjljyximquiwhuqy.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZGtyamxqeXhpbXF1aXdodXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4ODQ4NjIsImV4cCI6MjA2NDQ2MDg2Mn0.CXoIkZ2h1y2dgDbJheQT8SH8ChUOXWanV-xSyV9lemg"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  email: string
  full_name: string | null
  role: "admin" | "teacher" | "student"
  created_at: string
  updated_at: string
}

export type Course = {
  id: string
  title: string
  description: string | null
  teacher_id: string
  registration_code: string
  created_at: string
  updated_at: string
}

export type Test = {
  id: string
  course_id: string
  title: string
  description: string | null
  time_limit: number
  created_by: string
  created_at: string
  updated_at: string
}

export type Question = {
  id: string
  test_id: string
  question_text: string
  type: "single_choice" | "multiple_choice"
  options: string[]
  correct_answer: string | string[]
  points: number // Додаємо бали
  order_index: number
  created_at: string
}

export type TestAttempt = {
  id: string
  test_id: string
  student_id: string
  score: number | null
  total_questions: number | null
  correct_answers: number | null
  total_points: number | null // Додаємо загальну кількість балів
  earned_points: number | null // Додаємо отримані бали
  answers: Record<string, string | string[]> | null
  started_at: string
  completed_at: string | null
}

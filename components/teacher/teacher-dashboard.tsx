"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase, type Course, type Test } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, BookOpen, FileText, Users, Sparkles, GraduationCap } from "lucide-react"
import CourseManagement from "./course-management"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateCourse, setShowCreateCourse] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [creating, setCreating] = useState(false)

  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
  })

  useEffect(() => {
    fetchCourses()
    fetchTests()
    fetchTotalStudents()
  }, [])

  const fetchCourses = async () => {
    try {
      setError(null)
      console.log("Fetching courses...")

      const { data: user } = await supabase.auth.getUser()
      console.log("Current user:", user.user?.id)

      if (!user.user) {
        setError("Користувач не авторизований")
        return
      }

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("teacher_id", user.user.id)
        .order("created_at", { ascending: false })

      console.log("Courses query result:", { data, error })

      if (error) {
        console.error("Error fetching courses:", error)
        setError(`Помилка отримання курсів: ${error.message}`)
        return
      }

      setCourses(data || [])
      console.log("Courses set:", data?.length || 0)
    } catch (error: any) {
      console.error("Error fetching courses:", error)
      setError(`Помилка отримання курсів: ${error.message || "Невідома помилка"}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchTests = async () => {
    try {
      console.log("Fetching tests...")

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase
        .from("tests")
        .select(`
          *,
          course:courses(title)
        `)
        .eq("created_by", user.user.id)
        .order("created_at", { ascending: false })

      console.log("Tests query result:", { data, error })

      if (error) {
        console.error("Error fetching tests:", error)
        setError(`Помилка отримання тестів: ${error.message}`)
        return
      }

      setTests(data || [])
    } catch (error: any) {
      console.error("Error fetching tests:", error)
      setError(`Помилка отримання тестів: ${error.message || "Невідома помилка"}`)
    }
  }

  const fetchTotalStudents = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Отримуємо всіх студентів з усіх курсів викладача
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          student_id,
          course:courses!inner(teacher_id)
        `)
        .eq("course.teacher_id", user.user.id)

      if (error) {
        console.error("Error fetching students count:", error)
        return
      }

      // Підраховуємо унікальних студентів
      const uniqueStudents = new Set(data?.map((enrollment: any) => enrollment.student_id) || [])
      setTotalStudents(uniqueStudents.size)
    } catch (error) {
      console.error("Error fetching total students:", error)
    }
  }

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCreating(true)

    try {
      console.log("Creating course...")

      const { data: user } = await supabase.auth.getUser()
      console.log("User for course creation:", user.user?.id)

      if (!user.user) {
        setError("Користувач не авторизований")
        return
      }

      // Generate registration code
      const registrationCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      console.log("Generated registration code:", registrationCode)

      const courseData = {
        title: courseForm.title,
        description: courseForm.description,
        teacher_id: user.user.id,
        registration_code: registrationCode,
      }

      console.log("Course data to insert:", courseData)

      const { data, error } = await supabase.from("courses").insert(courseData).select().single()

      console.log("Course creation result:", { data, error })

      if (error) {
        console.error("Error creating course:", error)
        setError(`Помилка створення курсу: ${error.message}`)
        return
      }

      setCourses([data, ...courses])
      setCourseForm({ title: "", description: "" })
      setShowCreateCourse(false)

      alert(`Курс створено! Код реєстрації: ${registrationCode}`)
    } catch (error: any) {
      console.error("Error creating course:", error)
      setError(`Помилка створення курсу: ${error.message || "Невідома помилка"}`)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Завантаження...</div>
        </div>
      </div>
    )
  }

  if (selectedCourse) {
    return (
      <CourseManagement
        course={selectedCourse}
        onBack={() => setSelectedCourse(null)}
        onTestCreated={fetchTests}
        onStudentsUpdated={fetchTotalStudents}
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Панель викладача
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Створюйте курси, розробляйте тести та відстежуйте прогрес своїх студентів у сучасному інтерфейсі
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Мої курси</CardTitle>
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{courses.length}</div>
            <p className="text-xs text-blue-600 mt-1">активних курсів</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Мої тести</CardTitle>
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{tests.length}</div>
            <p className="text-xs text-purple-600 mt-1">створених тестів</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Студенти</CardTitle>
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{totalStudents}</div>
            <p className="text-xs text-green-600 mt-1">записаних студентів</p>
          </CardContent>
        </Card>
      </div>

      {/* Courses Section */}
      <Card className="bg-white/70 backdrop-blur-sm border-gray-200 shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                Мої курси
              </CardTitle>
              <CardDescription className="text-gray-600">
                Керуйте своїми курсами та створюйте нові навчальні програми
              </CardDescription>
            </div>
            <Dialog open={showCreateCourse} onOpenChange={setShowCreateCourse}>
              <DialogTrigger asChild>
                <Button
                  disabled={creating}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Створити курс
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle className="text-xl text-gray-900">Створити новий курс</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Заповніть інформацію про новий курс для ваших студентів
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={createCourse} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-gray-700 font-medium">
                      Назва курсу
                    </Label>
                    <Input
                      id="title"
                      value={courseForm.title}
                      onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                      required
                      disabled={creating}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Введіть назву курсу"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-gray-700 font-medium">
                      Опис курсу
                    </Label>
                    <Textarea
                      id="description"
                      value={courseForm.description}
                      onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                      rows={3}
                      disabled={creating}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Опишіть зміст та цілі курсу"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateCourse(false)}
                      disabled={creating}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Скасувати
                    </Button>
                    <Button
                      type="submit"
                      disabled={creating}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                    >
                      {creating ? "Створення..." : "Створити курс"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Поки немає курсів</h3>
              <p className="text-gray-600 mb-6">Створіть свій перший курс та почніть навчати студентів!</p>
              <Button
                onClick={() => setShowCreateCourse(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Створити перший курс
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Card
                  key={course.id}
                  className="bg-white hover:shadow-lg transition-all duration-300 border-gray-200 hover:border-blue-300 cursor-pointer group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-3">
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                        Активний
                      </span>
                    </div>
                    <CardTitle className="text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600 line-clamp-2">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Код реєстрації</p>
                        <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                          {course.registration_code}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setSelectedCourse(course)}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                      >
                        Керувати
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

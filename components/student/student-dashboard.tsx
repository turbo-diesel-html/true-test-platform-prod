"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase, type Course, type Test, type TestAttempt } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { BookOpen, Clock, CheckCircle, Play, Users, Plus, FileX, Star, Award } from "lucide-react"
import TestTaking from "./test-taking"
import { useToastContext } from "@/components/providers/toast-provider"

export default function StudentDashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedTest, setSelectedTest] = useState<Test | null>(null)
  const [loading, setLoading] = useState(true)
  const [showJoinCourse, setShowJoinCourse] = useState(false)
  const [registrationCode, setRegistrationCode] = useState("")
  const [completedTestsCount, setCompletedTestsCount] = useState(0)
  const [pendingTestsCount, setPendingTestsCount] = useState(0)
  const toast = useToastContext()

  useEffect(() => {
    fetchCourses()
    fetchTestStats()
  }, [])

  const fetchCourses = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          course:courses(
            *,
            teacher:profiles(full_name)
          )
        `)
        .eq("student_id", user.user.id)

      if (error) throw error
      setCourses(data?.map((enrollment: any) => enrollment.course).filter(Boolean) || [])
    } catch (error) {
      console.error("Error fetching courses:", error)
      toast.error("Помилка завантаження", "Не вдалося завантажити курси")
    } finally {
      setLoading(false)
    }
  }

  const fetchTestStats = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Отримуємо всі тести з курсів студента
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("course_enrollments")
        .select("course_id")
        .eq("student_id", user.user.id)

      if (enrollmentsError) throw enrollmentsError

      const courseIds = enrollments?.map((e) => e.course_id) || []

      if (courseIds.length === 0) {
        setCompletedTestsCount(0)
        setPendingTestsCount(0)
        return
      }

      // Отримуємо всі тести з цих курсів
      const { data: allTests, error: testsError } = await supabase.from("tests").select("id").in("course_id", courseIds)

      if (testsError) throw testsError

      const totalTests = allTests?.length || 0

      // Отримуємо завершені тести
      const { data: completedTests, error: completedError } = await supabase
        .from("test_attempts")
        .select("id")
        .eq("student_id", user.user.id)
        .not("completed_at", "is", null)

      if (completedError) throw completedError

      const completed = completedTests?.length || 0
      const pending = totalTests - completed

      setCompletedTestsCount(completed)
      setPendingTestsCount(pending)
    } catch (error) {
      console.error("Error fetching test stats:", error)
    }
  }

  const joinCourse = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Find course by registration code
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("registration_code", registrationCode.toUpperCase())
        .single()

      if (courseError || !course) {
        toast.error("Курс не знайдено", "Перевірте правильність коду реєстрації")
        return
      }

      // Check if already enrolled
      const { data: existing } = await supabase
        .from("course_enrollments")
        .select("*")
        .eq("course_id", course.id)
        .eq("student_id", user.user.id)
        .single()

      if (existing) {
        toast.warning("Вже записані", "Ви вже записані на цей курс")
        return
      }

      // Enroll in course
      const { error: enrollError } = await supabase.from("course_enrollments").insert({
        course_id: course.id,
        student_id: user.user.id,
      })

      if (enrollError) throw enrollError

      await fetchCourses()
      await fetchTestStats()
      setRegistrationCode("")
      setShowJoinCourse(false)

      toast.success("Успішно записані", `Ви успішно записалися на курс "${course.title}"`)
    } catch (error) {
      console.error("Error joining course:", error)
      toast.error("Помилка запису", "Не вдалося записатися на курс")
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

  // Якщо обрано тест для проходження
  if (selectedTest) {
    return (
      <TestTaking
        test={selectedTest}
        course={selectedCourse!}
        onBack={() => {
          setSelectedTest(null)
          setSelectedCourse(null)
        }}
        onComplete={() => {
          setSelectedTest(null)
          setSelectedCourse(null)
          fetchTestStats() // Оновлюємо статистику після завершення тесту
        }}
      />
    )
  }

  // Якщо обрано курс для перегляду тестів
  if (selectedCourse) {
    return <CourseView course={selectedCourse} onBack={() => setSelectedCourse(null)} onTestSelect={setSelectedTest} />
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mb-4">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
          Панель студента
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Приєднуйтеся до курсів, проходьте тести та відстежуйте свій прогрес у навчанні
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Мої курси</CardTitle>
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{courses.length}</div>
            <p className="text-xs text-green-600 mt-1">активних курсів</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Пройдені тести</CardTitle>
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{completedTestsCount}</div>
            <p className="text-xs text-blue-600 mt-1">завершених тестів</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Непройдені тести</CardTitle>
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <FileX className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900">{pendingTestsCount}</div>
            <p className="text-xs text-orange-600 mt-1">очікують виконання</p>
          </CardContent>
        </Card>
      </div>

      {/* Courses */}
      <Card className="bg-white/70 backdrop-blur-sm border-gray-200 shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-500" />
                Мої курси
              </CardTitle>
              <CardDescription className="text-gray-600">Оберіть курс для перегляду доступних тестів</CardDescription>
            </div>
            <Dialog open={showJoinCourse} onOpenChange={setShowJoinCourse}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                  <Plus className="w-4 h-4 mr-2" />
                  Приєднатися до курсу
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle className="text-xl text-gray-900">Приєднатися до курсу</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Введіть код реєстрації, отриманий від викладача
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={joinCourse} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="registrationCode" className="text-gray-700 font-medium">
                      Код реєстрації
                    </Label>
                    <Input
                      id="registrationCode"
                      value={registrationCode}
                      onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
                      placeholder="Введіть код"
                      required
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 font-mono text-center text-lg"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowJoinCourse(false)}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Скасувати
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white"
                    >
                      Приєднатися
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
              <div className="w-16 h-16 bg-gradient-to-r from-green-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Поки немає курсів</h3>
              <p className="text-gray-600 mb-6">Приєднайтеся до курсу за допомогою коду реєстрації від викладача</p>
              <Button
                onClick={() => setShowJoinCourse(true)}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Приєднатися до першого курсу
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Card
                  key={course.id}
                  className="bg-white hover:shadow-lg transition-all duration-300 border-gray-200 hover:border-green-300 cursor-pointer group"
                  onClick={() => setSelectedCourse(course)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center mb-3">
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                        Активний
                      </span>
                    </div>
                    <CardTitle className="text-lg text-gray-900 group-hover:text-green-600 transition-colors">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600 line-clamp-2">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Викладач</p>
                        <span className="text-sm font-medium text-gray-800">{course.teacher?.full_name}</span>
                      </div>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white"
                      >
                        Відкрити
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

// Компонент для перегляду курсу та його тестів
function CourseView({
  course,
  onBack,
  onTestSelect,
}: {
  course: Course
  onBack: () => void
  onTestSelect: (test: Test) => void
}) {
  const [tests, setTests] = useState<Test[]>([])
  const [attempts, setAttempts] = useState<TestAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToastContext()

  useEffect(() => {
    fetchTests()
    fetchAttempts()
  }, [course.id])

  const fetchTests = async () => {
    try {
      const { data, error } = await supabase.from("tests").select("*").eq("course_id", course.id).order("created_at")

      if (error) throw error
      setTests(data || [])
    } catch (error) {
      console.error("Error fetching tests:", error)
      toast.error("Помилка завантаження", "Не вдалося завантажити тести")
    } finally {
      setLoading(false)
    }
  }

  const fetchAttempts = async () => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data, error } = await supabase.from("test_attempts").select("*").eq("student_id", user.user.id)

      if (error) throw error
      setAttempts(data || [])
    } catch (error) {
      console.error("Error fetching attempts:", error)
    }
  }

  const getTestAttempt = (testId: string) => {
    return attempts.find((attempt) => attempt.test_id === testId)
  }

  const getGrade = (earnedPoints: number, totalPoints: number) => {
    if (!earnedPoints || !totalPoints || totalPoints === 0) {
      return { label: "Не оцінено", color: "text-gray-500", bgColor: "bg-gray-100" }
    }

    const percentage = (earnedPoints / totalPoints) * 100
    if (percentage >= 90) return { label: "Відмінно", color: "text-green-600", bgColor: "bg-green-100" }
    if (percentage >= 75) return { label: "Добре", color: "text-blue-600", bgColor: "bg-blue-100" }
    if (percentage >= 60) return { label: "Задовільно", color: "text-yellow-600", bgColor: "bg-yellow-100" }
    return { label: "Незадовільно", color: "text-red-600", bgColor: "bg-red-100" }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Завантаження тестів...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack} className="border-gray-300 text-gray-700 hover:bg-gray-50">
            ← Назад до курсів
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-600">{course.description}</p>
          </div>
        </div>
      </div>

      {/* Tests */}
      <Card className="bg-white/70 backdrop-blur-sm border-gray-200 shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-gray-900 flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-500" />
            Тести курсу
          </CardTitle>
          <CardDescription className="text-gray-600">Оберіть тест для проходження</CardDescription>
        </CardHeader>
        <CardContent>
          {tests.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Поки немає тестів</h3>
              <p className="text-gray-600">Викладач ще не створив тести для цього курсу</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tests.map((test) => {
                const attempt = getTestAttempt(test.id)
                const grade = attempt ? getGrade(attempt.earned_points || 0, attempt.total_points || 0) : null

                return (
                  <Card
                    key={test.id}
                    className="bg-white hover:shadow-md transition-all duration-300 border-gray-200 hover:border-blue-300"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                              <Play className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{test.title}</h3>
                              <p className="text-sm text-gray-600">{test.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {test.time_limit} хв
                            </span>
                            {attempt && (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Пройдено
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {attempt ? (
                            <div className="space-y-2">
                              {/* Оцінка - великий бейдж */}
                              <div
                                className={`inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold ${grade?.bgColor} ${grade?.color}`}
                              >
                                <Award className="w-4 h-4" />
                                {grade?.label}
                              </div>

                              {/* Бали */}
                              <div className="text-2xl font-bold text-gray-900">
                                {attempt.earned_points || 0}/{attempt.total_points || 0}
                              </div>

                              {/* Відсоток */}
                              <div className="flex items-center justify-end gap-1 text-sm text-gray-600">
                                <Star className="w-3 h-3" />
                                {attempt.total_points && attempt.total_points > 0
                                  ? Math.round(((attempt.earned_points || 0) / attempt.total_points) * 100)
                                  : 0}
                                %
                              </div>

                              {/* Правильні відповіді */}
                              <div className="flex items-center justify-end gap-1 text-sm">
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                {attempt.correct_answers || 0}/{attempt.total_questions || 0} правильних
                              </div>
                            </div>
                          ) : (
                            <Button
                              onClick={() => onTestSelect(test)}
                              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Розпочати тест
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

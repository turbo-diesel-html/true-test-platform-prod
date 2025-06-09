"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase, type Course, type Test, type Profile, type TestAttempt } from "@/lib/supabase"
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
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, FileText, Users, Mail, Trophy, CheckCircle, Clock } from "lucide-react"
import TestCreator from "./test-creator"

interface CourseManagementProps {
  course: Course
  onBack: () => void
  onTestCreated: () => void
  onStudentsUpdated?: () => void
}

interface StudentWithResults extends Profile {
  test_attempts: TestAttempt[]
}

export default function CourseManagement({ course, onBack, onTestCreated, onStudentsUpdated }: CourseManagementProps) {
  const [tests, setTests] = useState<Test[]>([])
  const [students, setStudents] = useState<StudentWithResults[]>([])
  const [showCreateTest, setShowCreateTest] = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [selectedTest, setSelectedTest] = useState<Test | null>(null)
  const [studentEmail, setStudentEmail] = useState("")

  useEffect(() => {
    fetchTests()
    fetchStudents()
  }, [course.id])

  const fetchTests = async () => {
    try {
      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .eq("course_id", course.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTests(data || [])
    } catch (error) {
      console.error("Error fetching tests:", error)
    }
  }

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select(`
          student:profiles(*),
          course_id
        `)
        .eq("course_id", course.id)

      if (error) throw error

      const studentsData = data?.map((enrollment: any) => enrollment.student).filter(Boolean) || []

      // Отримуємо результати тестів для кожного студента
      const studentsWithResults = await Promise.all(
        studentsData.map(async (student: Profile) => {
          const { data: attempts, error: attemptsError } = await supabase
            .from("test_attempts")
            .select(`
              *,
              test:tests(title, course_id)
            `)
            .eq("student_id", student.id)
            .in("test.course_id", [course.id])

          if (attemptsError) {
            console.error("Error fetching attempts for student:", student.id, attemptsError)
            return { ...student, test_attempts: [] }
          }

          return { ...student, test_attempts: attempts || [] }
        }),
      )

      setStudents(studentsWithResults)
    } catch (error) {
      console.error("Error fetching students:", error)
    }
  }

  const addStudentByEmail = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Find student by email
      const { data: student, error: studentError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", studentEmail)
        .eq("role", "student")
        .single()

      if (studentError || !student) {
        alert("Студента не знайдено або користувач не має роль студента")
        return
      }

      // Check if already enrolled
      const { data: existing } = await supabase
        .from("course_enrollments")
        .select("*")
        .eq("course_id", course.id)
        .eq("student_id", student.id)
        .single()

      if (existing) {
        alert("Студент вже записаний на курс")
        return
      }

      // Enroll student
      const { error: enrollError } = await supabase.from("course_enrollments").insert({
        course_id: course.id,
        student_id: student.id,
      })

      if (enrollError) throw enrollError

      await fetchStudents()
      if (onStudentsUpdated) onStudentsUpdated()
      setStudentEmail("")
      setShowAddStudent(false)

      alert(`${student.full_name} успішно записаний на курс`)
    } catch (error) {
      console.error("Error adding student:", error)
      alert("Помилка при додаванні студента")
    }
  }

  const getStudentTestResult = (student: StudentWithResults, testId: string) => {
    return student.test_attempts.find((attempt) => attempt.test_id === testId)
  }

  const getGradeInfo = (score: number, total: number) => {
    const percentage = (score / total) * 100
    if (percentage >= 90) return { label: "Відмінно", color: "bg-green-100 text-green-800", percentage }
    if (percentage >= 75) return { label: "Добре", color: "bg-blue-100 text-blue-800", percentage }
    if (percentage >= 60) return { label: "Задовільно", color: "bg-yellow-100 text-yellow-800", percentage }
    return { label: "Незадовільно", color: "bg-red-100 text-red-800", percentage }
  }

  if (selectedTest) {
    return (
      <TestCreator
        test={selectedTest}
        course={course}
        onBack={() => setSelectedTest(null)}
        onSaved={() => {
          setSelectedTest(null)
          fetchTests()
          onTestCreated()
        }}
      />
    )
  }

  if (showCreateTest) {
    return (
      <TestCreator
        course={course}
        onBack={() => setShowCreateTest(false)}
        onSaved={() => {
          setShowCreateTest(false)
          fetchTests()
          onTestCreated()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack} className="border-gray-300 text-gray-700 hover:bg-gray-50">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-600">{course.description}</p>
            <p className="text-sm text-gray-500">Код реєстрації: {course.registration_code}</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateTest(true)}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Створити тест
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Тести</CardTitle>
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{tests.length}</div>
            <p className="text-xs text-purple-600 mt-1">створених тестів</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Студенти</CardTitle>
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{students.length}</div>
            <p className="text-xs text-green-600 mt-1">записаних студентів</p>
          </CardContent>
        </Card>
      </div>

      {/* Tests */}
      <Card className="bg-white/70 backdrop-blur-sm border-gray-200 shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            Тести курсу
          </CardTitle>
          <CardDescription className="text-gray-600">Керуйте тестами цього курсу</CardDescription>
        </CardHeader>
        <CardContent>
          {tests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">У цьому курсі поки немає тестів. Створіть перший тест!</div>
          ) : (
            <div className="space-y-4">
              {tests.map((test) => (
                <Card key={test.id} className="bg-white hover:shadow-md transition-all duration-300 border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{test.title}</h3>
                          <p className="text-sm text-gray-600">{test.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">{test.time_limit} хв</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setSelectedTest(test)}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                      >
                        Редагувати
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students */}
      <Card className="bg-white/70 backdrop-blur-sm border-gray-200 shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-500" />
                Студенти курсу
              </CardTitle>
              <CardDescription className="text-gray-600">
                Керуйте студентами та переглядайте їх результати
              </CardDescription>
            </div>
            <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                  <Mail className="w-4 h-4 mr-2" />
                  Додати студента
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle className="text-xl text-gray-900">Додати студента</DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Введіть email студента для запису на курс
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={addStudentByEmail} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="studentEmail" className="text-gray-700 font-medium">
                      Email студента
                    </Label>
                    <Input
                      id="studentEmail"
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      required
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="student@example.com"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddStudent(false)}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Скасувати
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white"
                    >
                      Додати
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">На курс поки не записаний жоден студент.</div>
          ) : (
            <div className="space-y-4">
              {students.map((student) => (
                <Card key={student.id} className="bg-white hover:shadow-md transition-all duration-300 border-gray-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {student.full_name?.charAt(0) || student.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{student.full_name || "Без імені"}</h3>
                          <p className="text-sm text-gray-600">{student.email}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Студент
                      </Badge>
                    </div>

                    {/* Результати тестів */}
                    {tests.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          Результати тестів
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {tests.map((test) => {
                            const result = getStudentTestResult(student, test.id)

                            if (!result) {
                              return (
                                <div key={test.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="text-sm font-medium text-gray-900 mb-1">{test.title}</div>
                                  <div className="text-xs text-gray-500">Не пройдено</div>
                                </div>
                              )
                            }

                            const gradeInfo = getGradeInfo(result.earned_points || 0, result.total_points || 1)

                            return (
                              <div key={test.id} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                                <div className="text-sm font-medium text-gray-900 mb-2">{test.title}</div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-lg font-bold text-gray-900">
                                    {result.earned_points}/{result.total_points} балів
                                  </span>
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">{Math.round(gradeInfo.percentage)}%</span>
                                  <Badge className={`text-xs ${gradeInfo.color}`}>{gradeInfo.label}</Badge>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
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

"use client"

import { useState, useEffect } from "react"
import { supabase, type Course, type Test, type Question } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, CheckCircle, AlertCircle, Star } from "lucide-react"
import { useToastContext } from "@/components/providers/toast-provider"

interface TestTakingProps {
  test: Test
  course: Course
  onBack: () => void
  onComplete: () => void
}

export default function TestTaking({ test, course, onBack, onComplete }: TestTakingProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [timeLeft, setTimeLeft] = useState(test.time_limit * 60) // в секундах
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToastContext()

  useEffect(() => {
    fetchQuestions()
  }, [test.id])

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      // Час вийшов, автоматично відправляємо тест
      handleSubmit()
    }
  }, [timeLeft])

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase.from("questions").select("*").eq("test_id", test.id).order("order_index")

      if (error) throw error

      // Парсимо правильні відповіді для multiple_choice
      const formattedQuestions =
        data?.map((q) => {
          let correctAnswer: string | string[] = q.correct_answer

          // Перевіряємо, чи це multiple_choice і чи потрібно парсити JSON
          if (q.type === "multiple_choice") {
            try {
              if (typeof q.correct_answer === "string") {
                correctAnswer = JSON.parse(q.correct_answer)
              }
            } catch (e) {
              // Якщо не вдалося розпарсити, залишаємо як є
              console.error("Error parsing correct_answer:", e)
            }
          }

          return {
            ...q,
            correct_answer: correctAnswer,
            points: q.points || 1, // Встановлюємо 1 бал за замовчуванням
          }
        }) || []

      console.log("Loaded questions:", formattedQuestions) // Для дебагу
      setQuestions(formattedQuestions)
    } catch (error) {
      console.error("Error fetching questions:", error)
      toast.error("Помилка завантаження", "Не вдалося завантажити питання тесту")
    } finally {
      setLoading(false)
    }
  }

  const handleSingleChoiceAnswer = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer })
  }

  const handleMultipleChoiceAnswer = (questionId: string, answer: string, checked: boolean) => {
    const currentAnswers = Array.isArray(answers[questionId]) ? [...(answers[questionId] as string[])] : []

    if (checked) {
      if (!currentAnswers.includes(answer)) {
        currentAnswers.push(answer)
      }
    } else {
      const index = currentAnswers.indexOf(answer)
      if (index > -1) {
        currentAnswers.splice(index, 1)
      }
    }

    setAnswers({ ...answers, [questionId]: currentAnswers })
  }

  const isAnswerSelected = (questionId: string, answer: string) => {
    const questionAnswer = answers[questionId]
    if (Array.isArray(questionAnswer)) {
      return questionAnswer.includes(answer)
    }
    return questionAnswer === answer
  }

  const hasAnswer = (questionId: string) => {
    const answer = answers[questionId]
    if (Array.isArray(answer)) {
      return answer.length > 0
    }
    return !!answer
  }

  const calculateResults = () => {
    let correctAnswers = 0
    let earnedPoints = 0
    let totalPoints = 0

    console.log("Calculating results for questions:", questions) // Для дебагу
    console.log("User answers:", answers) // Для дебагу

    questions.forEach((question) => {
      const questionPoints = question.points || 1
      totalPoints += questionPoints

      const userAnswer = answers[question.id]
      const correctAnswer = question.correct_answer

      console.log(`Question ${question.id}:`, {
        userAnswer,
        correctAnswer,
        points: questionPoints,
        type: question.type,
      }) // Для дебагу

      if (question.type === "single_choice") {
        if (userAnswer === correctAnswer) {
          correctAnswers++
          earnedPoints += questionPoints
        }
      } else {
        // multiple_choice
        const userAnswersArray = Array.isArray(userAnswer) ? userAnswer : []
        const correctAnswersArray = Array.isArray(correctAnswer) ? correctAnswer : []

        // Перевіряємо чи співпадають масиви (порядок не важливий)
        if (
          userAnswersArray.length === correctAnswersArray.length &&
          userAnswersArray.every((answer) => correctAnswersArray.includes(answer))
        ) {
          correctAnswers++
          earnedPoints += questionPoints
        }
      }
    })

    const results = {
      correctAnswers,
      totalQuestions: questions.length,
      earnedPoints,
      totalPoints,
      score: totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0,
    }

    console.log("Calculated results:", results) // Для дебагу
    return results
  }

  const handleSubmit = async () => {
    setSubmitting(true)

    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      // Підрахунок результатів
      const results = calculateResults()

      console.log("Submitting results:", results) // Для дебагу

      // Збереження результату
      const { data, error } = await supabase
        .from("test_attempts")
        .insert({
          test_id: test.id,
          student_id: user.user.id,
          score: results.score,
          total_questions: results.totalQuestions,
          correct_answers: results.correctAnswers,
          earned_points: results.earnedPoints,
          total_points: results.totalPoints,
          answers,
          completed_at: new Date().toISOString(),
        })
        .select()

      if (error) {
        console.error("Error saving test attempt:", error)
        throw error
      }

      console.log("Saved test attempt:", data) // Для дебагу

      toast.success(
        "Тест завершено",
        `Ваш результат: ${results.correctAnswers}/${results.totalQuestions} правильних відповідей, ${results.earnedPoints}/${results.totalPoints} балів (${Math.round(results.score)}%)`,
      )
      onComplete()
    } catch (error) {
      console.error("Error submitting test:", error)
      toast.error("Помилка збереження", "Не вдалося зберегти результати тесту")
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Завантаження тесту...</div>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Помилка завантаження</h3>
        <p className="text-gray-600 mb-6">Не вдалося завантажити питання тесту</p>
        <Button onClick={onBack}>Повернутися назад</Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="bg-white border-gray-200 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl text-gray-900">{test.title}</CardTitle>
              <CardDescription className="text-gray-600">{course.title}</CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${timeLeft < 300 ? "text-red-600" : "text-blue-600"}`}>
                <Clock className="w-5 h-5 inline mr-2" />
                {formatTime(timeLeft)}
              </div>
              <p className="text-sm text-gray-500">залишилося часу</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Питання {currentQuestionIndex + 1} з {questions.length}
            </span>
            <span className="text-sm text-gray-500">{Math.round(progress)}% завершено</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Question */}
      <Card className="bg-white border-gray-200 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg text-gray-900">Питання {currentQuestionIndex + 1}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                <Star className="w-3 h-3" />
                {currentQuestion.points || 1} {(currentQuestion.points || 1) === 1 ? "бал" : "балів"}
              </div>
              {currentQuestion.type === "single_choice" ? (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                  Одна відповідь
                </span>
              ) : (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
                  Декілька відповідей
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-gray-800 text-lg leading-relaxed">{currentQuestion.question_text}</div>

          <div className="space-y-3">
            {currentQuestion.type === "single_choice" ? (
              // Одна правильна відповідь
              currentQuestion.options.map((option, index) => (
                <label
                  key={index}
                  className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={option}
                    checked={isAnswerSelected(currentQuestion.id, option)}
                    onChange={(e) => handleSingleChoiceAnswer(currentQuestion.id, e.target.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-gray-800 flex-1">{option}</span>
                </label>
              ))
            ) : (
              // Декілька правильних відповідей
              <div className="space-y-3">
                <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                  💡 Оберіть одну або декілька правильних відповідей
                </div>
                {currentQuestion.options.map((option, index) => (
                  <label
                    key={index}
                    className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={isAnswerSelected(currentQuestion.id, option)}
                      onCheckedChange={(checked) => handleMultipleChoiceAnswer(currentQuestion.id, option, !!checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-800 flex-1">{option}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              ← Попереднє
            </Button>

            <div className="flex space-x-3">
              {currentQuestionIndex === questions.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !hasAnswer(currentQuestion.id)}
                  className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {submitting ? "Збереження..." : "Завершити тест"}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                  disabled={!hasAnswer(currentQuestion.id)}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                >
                  Наступне →
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

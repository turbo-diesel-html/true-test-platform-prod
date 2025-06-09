"use client"

import { useState, useEffect } from "react"
import { supabase, type Course, type Test } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2, Check, Star, CheckCircle2, Circle } from "lucide-react"
import { useToastContext } from "@/components/providers/toast-provider"

interface TestCreatorProps {
  course: Course
  test?: Test
  onBack: () => void
  onSaved: () => void
}

interface QuestionForm {
  id?: string
  question_text: string
  type: "single_choice" | "multiple_choice"
  options: string[]
  correct_answer: string | string[]
  points: number
}

export default function TestCreator({ course, test, onBack, onSaved }: TestCreatorProps) {
  const [loading, setLoading] = useState(false)
  const toast = useToastContext()

  const [testForm, setTestForm] = useState({
    title: test?.title || "",
    description: test?.description || "",
    time_limit: test?.time_limit || 30,
  })

  const [questions, setQuestions] = useState<QuestionForm[]>([])

  useEffect(() => {
    if (test) {
      fetchQuestions()
    }
  }, [test])

  const fetchQuestions = async () => {
    if (!test) return

    try {
      const { data, error } = await supabase.from("questions").select("*").eq("test_id", test.id).order("order_index")

      if (error) throw error

      const formattedQuestions =
        data?.map((q) => {
          let correctAnswer: string | string[] = q.correct_answer

          // Перевіряємо, чи це multiple_choice і чи потрібно парсити JSON
          if (q.type === "multiple_choice") {
            try {
              correctAnswer = JSON.parse(q.correct_answer)
            } catch (e) {
              // Якщо не вдалося розпарсити, залишаємо як є
              console.error("Error parsing correct_answer:", e)
              correctAnswer = []
            }
          }

          return {
            id: q.id,
            question_text: q.question_text,
            type: q.type,
            options: q.options || [],
            correct_answer: correctAnswer,
            points: q.points || 1,
          }
        }) || []

      setQuestions(formattedQuestions)
    } catch (error) {
      console.error("Error fetching questions:", error)
      toast.error("Помилка завантаження", "Не вдалося завантажити питання тесту")
    }
  }

  const addQuestion = () => {
    const newQuestion: QuestionForm = {
      question_text: "",
      type: "multiple_choice", // Змінено з "single_choice" на "multiple_choice"
      options: ["", "", "", ""],
      correct_answer: [], // Змінено з "" на []
      points: 1,
    }
    setQuestions([...questions, newQuestion])
  }

  const updateQuestion = (index: number, field: keyof QuestionForm, value: any) => {
    const updatedQuestions = [...questions]
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value }
    setQuestions(updatedQuestions)
  }

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updatedQuestions = [...questions]
    const options = [...updatedQuestions[questionIndex].options]
    options[optionIndex] = value
    updatedQuestions[questionIndex] = { ...updatedQuestions[questionIndex], options }
    setQuestions(updatedQuestions)
  }

  const addOption = (questionIndex: number) => {
    const updatedQuestions = [...questions]
    updatedQuestions[questionIndex].options.push("")
    setQuestions(updatedQuestions)
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updatedQuestions = [...questions]
    const question = updatedQuestions[questionIndex]

    if (question.options.length <= 2) {
      toast.warning("Попередження", "Має бути принаймні 2 варіанти відповіді")
      return
    }

    const removedOption = question.options[optionIndex]
    question.options.splice(optionIndex, 1)

    // Оновлюємо правильні відповіді якщо видалили варіант
    if (question.type === "single_choice") {
      if (question.correct_answer === removedOption) {
        question.correct_answer = ""
      }
    } else {
      const correctAnswers = Array.isArray(question.correct_answer) ? question.correct_answer : []
      question.correct_answer = correctAnswers.filter((answer) => answer !== removedOption)
    }

    setQuestions(updatedQuestions)
  }

  const handleSingleChoiceAnswer = (questionIndex: number, answer: string) => {
    const updatedQuestions = [...questions]
    updatedQuestions[questionIndex].correct_answer = answer
    setQuestions(updatedQuestions)
  }

  const handleMultipleChoiceAnswer = (questionIndex: number, answer: string, checked: boolean) => {
    const updatedQuestions = [...questions]
    const question = updatedQuestions[questionIndex]
    let correctAnswers = Array.isArray(question.correct_answer) ? [...question.correct_answer] : []

    if (checked) {
      if (!correctAnswers.includes(answer)) {
        correctAnswers.push(answer)
      }
    } else {
      correctAnswers = correctAnswers.filter((a) => a !== answer)
    }

    question.correct_answer = correctAnswers
    setQuestions(updatedQuestions)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const getTotalPoints = () => {
    return questions.reduce((total, question) => total + question.points, 0)
  }

  const saveTest = async () => {
    if (!testForm.title.trim()) {
      toast.error("Помилка валідації", "Введіть назву тесту")
      return
    }

    if (questions.length === 0) {
      toast.error("Помилка валідації", "Додайте хоча б одне питання")
      return
    }

    // Валідація питань
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_text.trim()) {
        toast.error("Помилка валідації", `Введіть текст питання ${i + 1}`)
        return
      }

      if (q.options.some((opt) => !opt.trim())) {
        toast.error("Помилка валідації", `Заповніть всі варіанти відповідей для питання ${i + 1}`)
        return
      }

      if (q.points <= 0) {
        toast.error("Помилка валідації", `Кількість балів для питання ${i + 1} має бути більше 0`)
        return
      }

      if (q.type === "single_choice") {
        if (!q.correct_answer || typeof q.correct_answer !== "string") {
          toast.error("Помилка валідації", `Оберіть правильну відповідь для питання ${i + 1}`)
          return
        }
      } else {
        const correctAnswers = Array.isArray(q.correct_answer) ? q.correct_answer : []
        if (correctAnswers.length === 0) {
          toast.error("Помилка валідації", `Оберіть принаймні одну правильну відповідь для питання ${i + 1}`)
          return
        }
      }
    }

    setLoading(true)

    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      let testId = test?.id

      if (!test) {
        // Create new test
        const { data: newTest, error: testError } = await supabase
          .from("tests")
          .insert({
            course_id: course.id,
            title: testForm.title,
            description: testForm.description,
            time_limit: testForm.time_limit,
            created_by: user.user.id,
          })
          .select()
          .single()

        if (testError) throw testError
        testId = newTest.id
      } else {
        // Update existing test
        const { error: updateError } = await supabase
          .from("tests")
          .update({
            title: testForm.title,
            description: testForm.description,
            time_limit: testForm.time_limit,
          })
          .eq("id", test.id)

        if (updateError) throw updateError

        // Delete existing questions
        const { error: deleteError } = await supabase.from("questions").delete().eq("test_id", test.id)

        if (deleteError) throw deleteError
      }

      // Insert questions
      const questionsToInsert = questions.map((q, index) => ({
        test_id: testId,
        question_text: q.question_text,
        type: q.type,
        options: q.options,
        correct_answer: q.type === "multiple_choice" ? JSON.stringify(q.correct_answer) : q.correct_answer,
        points: q.points,
        order_index: index,
      }))

      const { error: questionsError } = await supabase.from("questions").insert(questionsToInsert)

      if (questionsError) throw questionsError

      toast.success(
        test ? "Тест оновлено" : "Тест створено",
        `Тест "${testForm.title}" успішно ${test ? "оновлено" : "створено"}. Загальна кількість балів: ${getTotalPoints()}`,
      )
      onSaved()
    } catch (error) {
      console.error("Error saving test:", error)
      toast.error("Помилка збереження", "Не вдалося зберегти тест. Спробуйте ще раз.")
    } finally {
      setLoading(false)
    }
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
            <h1 className="text-2xl font-bold text-gray-900">{test ? "Редагувати тест" : "Створити тест"}</h1>
            <p className="text-gray-600">Курс: {course.title}</p>
            {questions.length > 0 && (
              <p className="text-sm text-blue-600 flex items-center gap-1">
                <Star className="w-4 h-4" />
                Загальна кількість балів: {getTotalPoints()}
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={saveTest}
          disabled={loading}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
        >
          {loading ? "Збереження..." : "Зберегти тест"}
        </Button>
      </div>

      {/* Test Info */}
      <Card className="bg-white border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Інформація про тест</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-gray-700 font-medium">
              Назва тесту
            </Label>
            <Input
              id="title"
              value={testForm.title}
              onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
              placeholder="Введіть назву тесту"
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-700 font-medium">
              Опис тесту
            </Label>
            <Textarea
              id="description"
              value={testForm.description}
              onChange={(e) => setTestForm({ ...testForm, description: e.target.value })}
              placeholder="Введіть опис тесту"
              rows={3}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeLimit" className="text-gray-700 font-medium">
              Обмеження часу (хвилини)
            </Label>
            <Input
              id="timeLimit"
              type="number"
              min="1"
              value={testForm.time_limit}
              onChange={(e) => setTestForm({ ...testForm, time_limit: Number.parseInt(e.target.value) || 30 })}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card className="bg-white border-gray-200 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg text-gray-900">Питання</CardTitle>
              <CardDescription className="text-gray-600">Додайте питання до тесту</CardDescription>
            </div>
            <Button
              onClick={addQuestion}
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Додати питання
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Додайте перше питання до тесту</div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, questionIndex) => (
                <Card key={questionIndex} className="bg-gray-50 border-gray-200">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg text-gray-900">Питання {questionIndex + 1}</CardTitle>
                        <div className="flex items-center gap-1 text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                          <Star className="w-3 h-3" />
                          {question.points} {question.points === 1 ? "бал" : "балів"}
                        </div>
                        <div className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                          {question.type === "single_choice" ? "Одна відповідь" : "Кілька відповідей"}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeQuestion(questionIndex)}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-3 space-y-2">
                        <Label className="text-gray-700 font-medium">Текст питання</Label>
                        <Textarea
                          value={question.question_text}
                          onChange={(e) => updateQuestion(questionIndex, "question_text", e.target.value)}
                          placeholder="Введіть текст питання"
                          rows={2}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-700 font-medium">Бали</Label>
                        <Input
                          type="number"
                          min="1"
                          value={question.points}
                          onChange={(e) =>
                            updateQuestion(questionIndex, "points", Number.parseInt(e.target.value) || 1)
                          }
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-700 font-medium">Тип питання</Label>
                      <Select
                        value={question.type}
                        onValueChange={(value: "single_choice" | "multiple_choice") => {
                          updateQuestion(questionIndex, "type", value)
                          updateQuestion(questionIndex, "correct_answer", value === "multiple_choice" ? [] : "")
                        }}
                      >
                        <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_choice">Декілька правильних відповідей</SelectItem>
                          <SelectItem value="single_choice">Одна правильна відповідь</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-gray-700 font-medium">Варіанти відповідей</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(questionIndex)}
                          className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Додати варіант
                        </Button>
                      </div>

                      {question.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200"
                        >
                          <div className="flex-1">
                            <Input
                              value={option}
                              onChange={(e) => updateQuestionOption(questionIndex, optionIndex, e.target.value)}
                              placeholder={`Варіант ${optionIndex + 1}`}
                              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            {question.type === "single_choice" ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`correct-${questionIndex}`}
                                  checked={question.correct_answer === option}
                                  onChange={() => handleSingleChoiceAnswer(questionIndex, option)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-600">Правильна</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={
                                    Array.isArray(question.correct_answer) && question.correct_answer.includes(option)
                                  }
                                  onCheckedChange={(checked) =>
                                    handleMultipleChoiceAnswer(questionIndex, option, !!checked)
                                  }
                                  className="w-4 h-4"
                                />
                                <span className="text-sm text-gray-600">Правильна</span>
                              </div>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeOption(questionIndex, optionIndex)}
                              disabled={question.options.length <= 2}
                              className="text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Показуємо обрані правильні відповіді */}
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            {question.type === "single_choice" ? "Правильна відповідь:" : "Правильні відповіді:"}
                          </span>
                        </div>
                        <div className="text-sm text-blue-700">
                          {question.type === "single_choice" ? (
                            question.correct_answer ? (
                              <span className="bg-blue-100 px-2 py-1 rounded">{question.correct_answer}</span>
                            ) : (
                              <span className="text-gray-500">Не обрано</span>
                            )
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(question.correct_answer) && question.correct_answer.length > 0 ? (
                                question.correct_answer.map((answer, idx) => (
                                  <span key={idx} className="bg-blue-100 px-2 py-1 rounded">
                                    {answer}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-500">Не обрано</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {question.type === "single_choice" ? (
                          <div className="flex items-center gap-2">
                            <Circle className="w-4 h-4 text-gray-500" />
                            Оберіть одну правильну відповідь (радіо-кнопка)
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-gray-500" />
                            Оберіть одну або декілька правильних відповідей (чекбокси)
                          </div>
                        )}
                      </div>
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

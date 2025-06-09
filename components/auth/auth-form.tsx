"use client"

import type React from "react"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GraduationCap, Mail, Lock, User, Chrome, AlertCircle, CheckCircle } from "lucide-react"
import { useToastContext } from "@/components/providers/toast-provider"

export default function AuthForm() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const toast = useToastContext()

  const getErrorMessage = (error: any) => {
    switch (error.message) {
      case "Invalid login credentials":
        return "Невірний email або пароль. Перевірте правильність введених даних."
      case "Email not confirmed":
        return "Email не підтверджено. Перевірте свою пошту та підтвердіть реєстрацію."
      case "Too many requests":
        return "Забагато спроб входу. Спробуйте пізніше."
      case "User not found":
        return "Користувача з таким email не знайдено. Перевірте email або зареєструйтеся."
      case "Invalid email":
        return "Невірний формат email адреси."
      case "Password should be at least 6 characters":
        return "Пароль повинен містити принаймні 6 символів."
      case "Signup disabled":
        return "Реєстрація тимчасово відключена."
      case "Email rate limit exceeded":
        return "Перевищено ліміт відправки email. Спробуйте пізніше."
      default:
        return error.message || "Невідома помилка. Спробуйте ще раз."
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    // Валідація на клієнті
    if (!email || !password) {
      toast.error("Помилка валідації", "Будь ласка, заповніть всі поля")
      setLoading(false)
      return
    }

    if (!email.includes("@")) {
      toast.error("Помилка валідації", "Введіть правильний email адрес")
      setLoading(false)
      return
    }

    try {
      console.log("Attempting sign in with:", { email })

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        console.error("Auth error:", error)
        const errorMessage = getErrorMessage(error)
        toast.error("Помилка входу", errorMessage)
        setError(errorMessage)
        return
      }

      console.log("Sign in successful:", data)

      // Перевіряємо чи створився профіль
      if (data.user) {
        console.log("User data:", data.user)

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single()

        console.log("Profile check:", { profile, profileError })

        if (profileError && profileError.code === "PGRST116") {
          // Профіль не існує, створюємо його
          console.log("Creating new profile...")
          const { error: createError } = await supabase.from("profiles").insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || "",
            role: "student",
          })

          if (createError) {
            console.error("Error creating profile:", createError)
            toast.error("Помилка створення профілю", "Не вдалося створити профіль користувача")
            setError("Помилка створення профілю користувача")
            return
          }
          console.log("Profile created successfully")
        }
      }

      toast.success("Вхід успішний", "Ви успішно увійшли в систему")
      setMessage("Вхід успішний!")
    } catch (error: any) {
      console.error("Unexpected error:", error)
      const errorMessage = getErrorMessage(error)
      toast.error("Помилка входу", errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    // Валідація на клієнті
    if (!email || !password || !fullName) {
      toast.error("Помилка валідації", "Будь ласка, заповніть всі поля")
      setLoading(false)
      return
    }

    if (!email.includes("@")) {
      toast.error("Помилка валідації", "Введіть правильний email адрес")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      toast.error("Помилка валідації", "Пароль повинен містити принаймні 6 символів")
      setLoading(false)
      return
    }

    try {
      console.log("Attempting sign up with:", { email, fullName })

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      })

      if (error) {
        console.error("Sign up error:", error)
        const errorMessage = getErrorMessage(error)
        toast.error("Помилка реєстрації", errorMessage)
        setError(errorMessage)
        return
      }

      console.log("Sign up result:", data)

      if (data.user && !data.user.email_confirmed_at) {
        toast.success("Перевірте пошту", "Перевірте свою пошту для підтвердження реєстрації")
        setMessage("Перевірте свою пошту для підтвердження реєстрації!")
      } else if (data.user) {
        toast.success("Реєстрація успішна", "Ви успішно зареєструвалися в системі")
        setMessage("Реєстрація успішна!")
      }
    } catch (error: any) {
      console.error("Unexpected sign up error:", error)
      const errorMessage = getErrorMessage(error)
      toast.error("Помилка реєстрації", errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}`,
        },
      })

      if (error) {
        console.error("Google sign in error:", error)
        const errorMessage = getErrorMessage(error)
        toast.error("Помилка входу через Google", errorMessage)
        setError(errorMessage)
      }
    } catch (error: any) {
      console.error("Unexpected Google error:", error)
      const errorMessage = getErrorMessage(error)
      toast.error("Помилка входу через Google", errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Система тестування
          </h1>
          <p className="text-gray-600">Сучасна платформа для навчання та тестування</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl text-gray-900">Вітаємо!</CardTitle>
            <CardDescription className="text-gray-600">Увійдіть або створіть новий акаунт</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {message && (
              <Alert className="mb-4 bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription className="text-green-800">{message}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                <TabsTrigger value="signin" className="data-[state=active]:bg-white">
                  Вхід
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-white">
                  Реєстрація
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700 font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-700 font-medium">
                      Пароль
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={loading}
                  >
                    {loading ? "Завантаження..." : "Увійти"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-gray-700 font-medium">
                      Повне ім'я
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Ваше повне ім'я"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-700 font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-700 font-medium">
                      Пароль
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={loading}
                  >
                    {loading ? "Завантаження..." : "Зареєструватися"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Або</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full mt-4 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <Chrome className="w-4 h-4 mr-2" />
                Увійти через Google
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-6">
          Створюючи акаунт, ви погоджуєтеся з нашими умовами використання
        </p>
      </div>
    </div>
  )
}

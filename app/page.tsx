"use client"

import { useEffect, useState } from "react"
import { supabase, type Profile } from "@/lib/supabase"
import AuthForm from "@/components/auth/auth-form"
import AdminDashboard from "@/components/admin/admin-dashboard"
import TeacherDashboard from "@/components/teacher/teacher-dashboard"
import StudentDashboard from "@/components/student/student-dashboard"
import { Button } from "@/components/ui/button"
import { LogOut, User } from "lucide-react"

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      // Спочатку спробуємо отримати профіль
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

      if (error && error.code === "PGRST116") {
        // Профіль не існує, створюємо його через service role
        console.log("Profile not found, creating new profile...")

        const { data: user } = await supabase.auth.getUser()
        if (user.user) {
          // Використовуємо upsert для безпечного створення
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .upsert({
              id: userId,
              email: user.user.email!,
              full_name: user.user.user_metadata?.full_name || user.user.user_metadata?.name || "",
              role: "student",
            })
            .select()
            .single()

          if (createError) {
            console.error("Error creating profile:", createError)
            // Якщо не вдалося створити через RLS, спробуємо ще раз отримати
            const { data: retryData, error: retryError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userId)
              .single()

            if (retryError) {
              throw retryError
            }
            setProfile(retryData)
          } else {
            setProfile(newProfile)
          }
        }
      } else if (error) {
        throw error
      } else {
        setProfile(data)
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      // Якщо все не вдалося, створимо мінімальний профіль локально
      const { data: user } = await supabase.auth.getUser()
      if (user.user) {
        setProfile({
          id: userId,
          email: user.user.email!,
          full_name: user.user.user_metadata?.full_name || user.user.user_metadata?.name || "",
          role: "student",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800"
      case "teacher":
        return "bg-blue-100 text-blue-800"
      case "student":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Адміністратор"
      case "teacher":
        return "Викладач"
      case "student":
        return "Студент"
      default:
        return "Користувач"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Завантаження...</div>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return <AuthForm />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">TTS</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  TrueTestPlatform
                </h1>
                <p className="text-sm text-gray-500">Сучасна платформа для навчання</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-white rounded-full px-4 py-2 shadow-sm border border-gray-200">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{profile.full_name || "Користувач"}</p>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(profile.role)}`}
                  >
                    {getRoleLabel(profile.role)}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="bg-white hover:bg-gray-50 border-gray-200 text-gray-700 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Вийти
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {profile.role === "admin" && <AdminDashboard />}
        {profile.role === "teacher" && <TeacherDashboard />}
        {profile.role === "student" && <StudentDashboard />}
      </main>
    </div>
  )
}

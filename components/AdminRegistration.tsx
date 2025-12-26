'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Eye, EyeOff, Shield } from 'lucide-react'

interface AdminRegistrationProps {
  onBack: () => void
  onSuccess: () => void
}

export default function AdminRegistration({ onBack, onSuccess }: AdminRegistrationProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const validatePhoneNumber = (phone: string): boolean => {
    // Basic phone validation - accepts international format
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number')
      return
    }

    setLoading(true)

    try {
      // Check if username already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single()

      if (existingUser) {
        setError('Username already exists')
        setLoading(false)
        return
      }

      // Create admin account
      const { data, error: insertError } = await supabase
        .from('users')
        .insert({
          username,
          password, // In production, hash this!
          nickname: nickname || username,
          role: 'admin',
          phone_number: phoneNumber || null,
          avatar: `https://ui-avatars.com/api/?name=${nickname || username}&background=6366f1&color=fff`
        })
        .select()
        .single()

      if (insertError) throw insertError

      alert('Admin account created successfully!')
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to create admin account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <Shield className="h-8 w-8 text-blue-500 mr-2" />
          <h1 className="text-3xl font-bold">Admin Registration</h1>
        </div>
        
        <div className="bg-slate-800 rounded-lg shadow-xl p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Username *</label>
              <input
                className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none pr-10"
                  placeholder="Enter password (min 6 characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 cursor-pointer" onClick={() => setShowPassword(false)} />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 cursor-pointer" onClick={() => setShowPassword(true)} />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password *</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nickname</label>
              <input
                className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
                placeholder="Enter nickname (optional)"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <input
                type="tel"
                className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
                placeholder="+1234567890 (optional)"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
              />
              {phoneNumber && !validatePhoneNumber(phoneNumber) && (
                <p className="text-red-400 text-xs mt-1">Invalid phone number format</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 py-3 rounded hover:bg-blue-500 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Creating Admin Account...' : 'Create Admin Account'}
            </button>
          </form>

          <button
            onClick={onBack}
            className="w-full mt-4 text-gray-400 hover:text-white text-center"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}


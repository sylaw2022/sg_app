import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@/types'
import { Eye, EyeOff, Phone, Shield, Mail, RefreshCw } from 'lucide-react'
import AdminRegistration from './AdminRegistration'

interface AuthProps {
  onLogin: (user: User) => void
}

export default function Auth({ onLogin }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showAdminRegistration, setShowAdminRegistration] = useState(false)
  const [hasAdmin, setHasAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [sentOtpCode, setSentOtpCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Check if admin account exists
  useEffect(() => {
    const checkAdminExists = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .limit(1)

        if (error) throw error
        setHasAdmin((data && data.length > 0) || false)
      } catch (err: any) {
        console.error('Error checking admin:', err)
        // On error, assume admin exists to be safe
        setHasAdmin(true)
      } finally {
        setCheckingAdmin(false)
      }
    }

    checkAdminExists()
  }, [])

  // Reset phone number when switching between login/signup
  useEffect(() => {
    if (!isSignUp) {
      setPhoneNumber('')
      setOtp('')
      setOtpSent(false)
      setOtpVerified(false)
      setResendCooldown(0)
      setSentOtpCode(null)
    }
  }, [isSignUp])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current)
      }
    }
  }, [])

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      resendTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (resendTimerRef.current) {
              clearInterval(resendTimerRef.current)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current)
      }
    }

    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current)
      }
    }
  }, [resendCooldown])

  const validatePhoneNumber = (phone: string): boolean => {
    // Basic phone validation - accepts international format
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  const sendOTP = async () => {
    if (!phoneNumber || !phoneNumber.trim()) {
      alert('Please enter your phone number first')
      return
    }

    if (!validatePhoneNumber(phoneNumber)) {
      alert('Please enter a valid phone number')
      return
    }

    setSendingOtp(true)
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim()
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setOtpSent(true)
        setResendCooldown(60) // 60 seconds cooldown
        alert('OTP sent successfully to your phone number!')
        // Store OTP for display in development
        if (data.otp) {
          setSentOtpCode(data.otp)
        }
      } else {
        alert(data.error || 'Failed to send OTP. Please try again.')
      }
    } catch (error: any) {
      alert('Failed to send OTP: ' + error.message)
    } finally {
      setSendingOtp(false)
    }
  }

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      alert('Please enter the 6-digit OTP code')
      return
    }

    setVerifyingOtp(true)
    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          otp: otp
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setOtpVerified(true)
        alert('Phone number verified successfully!')
      } else {
        alert(data.error || 'Invalid OTP. Please try again.')
        setOtp('')
      }
    } catch (error: any) {
      alert('Failed to verify OTP: ' + error.message)
      setOtp('')
    } finally {
      setVerifyingOtp(false)
    }
  }

  const resendOTP = async () => {
    if (resendCooldown > 0) return
    await sendOTP()
  }


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        // Phone number is now mandatory
        if (!phoneNumber || !phoneNumber.trim()) {
          alert('Phone number is required. Please enter your mobile phone number.')
          setLoading(false)
          return
        }
        
        // Validate phone number format
        if (!validatePhoneNumber(phoneNumber)) {
          alert('Please enter a valid phone number')
          setLoading(false)
          return
        }

        // Check if OTP is verified
        if (!otpVerified) {
          alert('Please verify your phone number with OTP before registering.')
          setLoading(false)
          return
        }

        // Check if username already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .single()

        if (existingUser) {
          alert('Username already exists')
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('users')
          .insert({
            username,
            password, // In production, hash this!
            nickname: nickname || username,
            role: 'user',
            phone_number: phoneNumber.trim(),
            avatar: `https://ui-avatars.com/api/?name=${nickname || username}`
          })
          .select()
          .single()

        if (error) throw error
        alert('Account created! Please log in.')
        setIsSignUp(false)
        // Reset form
        setUsername('')
        setPassword('')
        setNickname('')
        setPhoneNumber('')
        setOtp('')
        setOtpSent(false)
        setOtpVerified(false)
        setResendCooldown(0)
        setSentOtpCode(null)
      } else {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .eq('password', password) // In production, verify hash!
          .single()

        if (error || !data) throw new Error('Invalid credentials')
        onLogin(data as User)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (showAdminRegistration) {
    return (
      <AdminRegistration
        onBack={() => setShowAdminRegistration(false)}
        onSuccess={() => {
          setShowAdminRegistration(false)
          setHasAdmin(true) // Update state to hide the button
          alert('Admin account created! You can now log in.')
        }}
      />
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-8 text-center">SG APP</h1>
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-center">{isSignUp ? 'Register' : 'Login'}</h2>
        

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full p-3 rounded bg-slate-700 border border-slate-600 pr-10 focus:border-blue-500 focus:outline-none"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400 cursor-pointer" onClick={() => setShowPassword(false)} />
              ) : (
                <Eye className="h-5 w-5 text-gray-400 cursor-pointer" onClick={() => setShowPassword(true)} />
              )}
            </div>
          </div>
          {isSignUp && (
            <>
              <input
                className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
                placeholder="Nickname (optional)"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="tel"
                      className="w-full pl-10 p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter your mobile phone number (e.g., +1234567890)"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      disabled={otpSent}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={sendOTP}
                    disabled={sendingOtp || !phoneNumber || !validatePhoneNumber(phoneNumber) || otpSent}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {sendingOtp ? 'Sending...' : otpSent ? 'Sent' : 'Send OTP'}
                  </button>
                </div>
                {phoneNumber && !validatePhoneNumber(phoneNumber) && (
                  <p className="text-red-400 text-xs mt-1">Invalid phone number format. Please enter a valid phone number.</p>
                )}
                {!phoneNumber && (
                  <p className="text-gray-400 text-xs mt-1">Phone number is required for registration</p>
                )}
                {otpSent && (
                  <p className="text-green-400 text-xs mt-1">✓ OTP sent to your phone number</p>
                )}
              </div>

              {/* OTP Verification Section */}
              {otpSent && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  {/* Development OTP Display */}
                  {sentOtpCode && (
                    <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-yellow-300 text-xs font-semibold mb-1">🔧 DEVELOPMENT MODE</p>
                          <p className="text-yellow-200 text-sm">Your OTP Code:</p>
                        </div>
                        <div className="bg-yellow-500/30 px-4 py-2 rounded border border-yellow-500/50">
                          <p className="text-yellow-100 text-2xl font-bold tracking-widest">{sentOtpCode}</p>
                        </div>
                      </div>
                      <p className="text-yellow-300/80 text-xs mt-2">This is only visible in development mode</p>
                    </div>
                  )}
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Enter OTP Code <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        className="w-full pl-10 pr-3 p-3 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 focus:outline-none text-center text-2xl font-bold tracking-widest"
                        placeholder="000000"
                        value={otp}
                        onChange={e => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                          setOtp(value)
                        }}
                        disabled={otpVerified}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={verifyOTP}
                      disabled={verifyingOtp || otp.length !== 6 || otpVerified}
                      className="px-4 py-3 bg-green-600 hover:bg-green-500 rounded text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {verifyingOtp ? 'Verifying...' : otpVerified ? '✓ Verified' : 'Verify'}
                    </button>
                  </div>
                  {otpVerified && (
                    <p className="text-green-400 text-xs mt-2 flex items-center gap-1">
                      <span>✓</span> Phone number verified successfully!
                    </p>
                  )}
                  {otpSent && !otpVerified && (
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-gray-400 text-xs">Didn't receive OTP?</p>
                      <button
                        type="button"
                        onClick={resendOTP}
                        disabled={resendCooldown > 0}
                        className="text-blue-400 hover:text-blue-300 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${resendCooldown > 0 ? 'animate-spin' : ''}`} />
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <button disabled={loading} className="w-full bg-blue-600 py-3 rounded hover:bg-blue-500 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition">
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>
        <div className="mt-4 space-y-2">
          <p className="text-center text-gray-400 cursor-pointer hover:text-white" onClick={() => {
            setIsSignUp(!isSignUp)
            setPhoneNumber('')
          }}>
            {isSignUp ? 'Already have an account? Log In' : 'Need an account? Register'}
          </p>
          {!isSignUp && !hasAdmin && !checkingAdmin && (
            <button
              onClick={() => setShowAdminRegistration(true)}
              className="w-full flex items-center justify-center space-x-2 text-gray-400 hover:text-white text-sm"
            >
              <Shield className="h-4 w-4" />
              <span>Create Admin Account</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


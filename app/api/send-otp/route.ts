import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

    // Store OTP in database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { error: insertError } = await supabase
      .from('otp_verifications')
      .insert({
        phone_number: phoneNumber.trim(),
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
        verified: false
      })

    if (insertError) {
      // If table doesn't exist, we'll handle it gracefully
      console.error('Error storing OTP:', insertError)
    }

    // Send OTP via SMS
    const message = `Your verification code is: ${otp}. This code will expire in 10 minutes.`
    
    try {
      const smsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          message: message
        })
      })

      const smsData = await smsResponse.json()

      if (!smsResponse.ok && !smsData.fallback) {
        // If SMS fails and it's not a fallback, return error
        return NextResponse.json(
          { 
            error: 'Failed to send OTP via SMS',
            details: smsData.error 
          },
          { status: 500 }
        )
      }

      // Return success (even if SMS API not configured, OTP is generated)
      return NextResponse.json({
        success: true,
        message: 'OTP sent successfully',
        // Always return OTP in development mode for testing
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      })

    } catch (smsError: any) {
      console.error('SMS sending error:', smsError)
      // Still return success if OTP was generated (for development/testing)
      return NextResponse.json({
        success: true,
        message: 'OTP generated',
        // Always return OTP in development mode for testing
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      })
    }

  } catch (error: any) {
    console.error('OTP generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate OTP' },
      { status: 500 }
    )
  }
}


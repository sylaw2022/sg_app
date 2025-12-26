import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, otp } = body

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      )
    }

    // Verify OTP from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone_number', phoneNumber.trim())
      .eq('otp_code', otp)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !otpRecord) {
      return NextResponse.json(
        { error: 'Invalid OTP code' },
        { status: 400 }
      )
    }

    // Check if OTP has expired
    const expiresAt = new Date(otpRecord.expires_at)
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Mark OTP as verified
    const { error: updateError } = await supabase
      .from('otp_verifications')
      .update({ verified: true })
      .eq('id', otpRecord.id)

    if (updateError) {
      console.error('Error updating OTP:', updateError)
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully'
    })

  } catch (error: any) {
    console.error('OTP verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}


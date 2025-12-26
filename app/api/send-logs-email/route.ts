import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { logs } = body

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: 'Logs array is required' },
        { status: 400 }
      )
    }

    // Format logs for email
    const logsText = logs.map((log: any) => {
      let logText = `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`
      if (log.args && log.args.length > 0) {
        try {
          const argsText = JSON.stringify(log.args, null, 2)
          logText += `\n\nArguments:\n${argsText}`
        } catch {
          logText += `\n\nArguments: [Unable to stringify]`
        }
      }
      return logText
    }).join('\n\n' + '='.repeat(50) + '\n\n')

    // Create email transporter
    // For development, you can use Gmail or any SMTP service
    // For production, configure these via environment variables
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
    })

    // Email content
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.EMAIL_USER || 'noreply@example.com',
      to: 'groklord@yahoo.com',
      subject: `Console Logs - ${new Date().toLocaleString()}`,
      text: `Console Logs Report\n\nGenerated at: ${new Date().toLocaleString()}\n\nTotal Logs: ${logs.length}\n\n${'='.repeat(50)}\n\n${logsText}`,
      html: `
        <div style="font-family: monospace; font-size: 12px; background: #1e1e1e; color: #d4d4d4; padding: 20px;">
          <h2 style="color: #4ec9b0;">Console Logs Report</h2>
          <p><strong>Generated at:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Logs:</strong> ${logs.length}</p>
          <hr style="border-color: #3e3e3e; margin: 20px 0;">
          <pre style="white-space: pre-wrap; word-wrap: break-word; background: #252526; padding: 15px; border-radius: 5px; overflow-x: auto;">${logsText.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')}</pre>
        </div>
      `,
    }

    // Check if email is configured
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      return NextResponse.json(
        { 
          error: 'Email service not configured. Please set up SMTP credentials in environment variables.',
          fallback: true,
          mailtoLink: `mailto:groklord@yahoo.com?subject=Console Logs - ${encodeURIComponent(new Date().toLocaleString())}&body=${encodeURIComponent(logsText)}`
        },
        { status: 503 }
      )
    }

    // Send email
    const info = await transporter.sendMail(mailOptions)

    return NextResponse.json({
      success: true,
      message: 'Logs sent to email successfully',
      messageId: info.messageId,
    })

  } catch (error: any) {
    console.error('Email sending error:', error)
    
    // If email fails, provide fallback mailto link
    const logs = (await request.json()).logs || []
    const logsText = logs.map((log: any) => 
      `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n\n')
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to send email',
        fallback: true,
        mailtoLink: `mailto:groklord@yahoo.com?subject=Console Logs - ${encodeURIComponent(new Date().toLocaleString())}&body=${encodeURIComponent(logsText)}`
      },
      { status: 500 }
    )
  }
}


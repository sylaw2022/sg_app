'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal, X, Trash2, ChevronDown, ChevronUp, Copy, Check, Mail, Loader2 } from 'lucide-react'

export default function ConsoleLogger() {
  // Initialize with a welcome log
  const initialLog = {
    time: new Date().toLocaleTimeString(),
    level: 'info' as const,
    message: 'Console Logger initialized - Only install button logs will be shown',
    args: [] as any[]
  }
  const [logs, setLogs] = useState<Array<{ time: string; level: string; message: string; args?: any[] }>>([initialLog])
  const [isOpen, setIsOpen] = useState(false) // Start closed, only open when install button is clicked
  const [isMinimized, setIsMinimized] = useState(false) // Start expanded
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [allCopied, setAllCopied] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const logsRef = useRef<Array<{ time: string; level: string; message: string; args?: any[] }>>([initialLog])
  
  // Helper to safely stringify args for keyword checking (handles circular references)
  const safeStringifyForCheck = (argsArray: any[]): string => {
    if (!argsArray || argsArray.length === 0) return ''
    
    try {
      const seen = new WeakSet()
      return JSON.stringify(argsArray, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]'
          seen.add(value)
          // Skip React internal properties
          if (key?.startsWith('__react') || key?.startsWith('__')) return '[React Internal]'
          // Skip DOM elements
          if (value instanceof HTMLElement || value instanceof Element) {
            return `[HTMLElement:${value.tagName}]`
          }
        }
        return value
      })
    } catch {
      // Fallback: try to stringify each arg individually
      try {
        return argsArray.map(arg => {
          if (typeof arg === 'string') return arg
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg)
            } catch {
              return String(arg)
            }
          }
          return String(arg)
        }).join(' ')
      } catch {
        return ''
      }
    }
  }

  // Filter function to check if log is install-related
  const isInstallRelatedLog = (message: string, args?: any[]): boolean => {
    const installKeywords = [
      'install',
      'pwa',
      'beforeinstallprompt',
      'deferredprompt',
      'appinstalled',
      'blue circular button',
      'install button',
      'install prompt',
      'service worker',
      'manifest',
      'standalone',
      '📱',
      '🔔',
      '✅'
    ]
    
    const lowerMessage = message.toLowerCase()
    const hasKeyword = installKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))
    
    // Also check args for install-related content (safely handle circular references)
    if (args && args.length > 0) {
      try {
        const argsString = safeStringifyForCheck(args).toLowerCase()
        const hasArgsKeyword = installKeywords.some(keyword => argsString.includes(keyword.toLowerCase()))
        if (hasArgsKeyword) return true
      } catch (error) {
        // If stringification fails, just check message (don't log to avoid recursion)
        // Silently fall back to message-only check
      }
    }
    
    return hasKeyword
  }
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isOpen && !isMinimized) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isOpen, isMinimized])

  // Debug when panel opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔵 Panel is now OPEN!')
      console.log('🔵 Panel should be visible')
      // Force a re-render to ensure visibility
      setTimeout(() => {
        const panel = document.querySelector('[data-console-logger]')
        if (panel) {
          console.log('🔵 Panel element found in DOM:', panel)
          console.log('🔵 Panel computed styles:', window.getComputedStyle(panel))
        } else {
          console.error('🔴 Panel element NOT found in DOM!')
        }
      }, 100)
    }
  }, [isOpen])

  // Batch log updates to avoid state updates during render
  const scheduleUpdate = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    updateTimeoutRef.current = setTimeout(() => {
      setLogs([...logsRef.current])
    }, 100) // Batch updates every 100ms
  }, [])

  useEffect(() => {
    console.log('📱 Console Logger component mounted')
    
    // Listen for install button click event to open console logger
    const handleInstallButtonClick = () => {
      console.log('🔵 Install button clicked, opening console logger')
      setIsOpen(true)
      setIsMinimized(false)
    }
    
    // Listen for custom event from PWA install button
    window.addEventListener('pwa-install-button-clicked', handleInstallButtonClick)
    
    // Override console methods to capture logs
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn
    const originalInfo = console.info
    const originalDebug = console.debug

    // Helper to check if error args contain empty/meaningless error objects
    const isEmptyErrorArgs = (...args: any[]): boolean => {
      if (args.length === 0) return false
      
      // Check for single empty object: {}
      if (args.length === 1) {
        const arg = args[0]
        return arg && typeof arg === 'object' && !Array.isArray(arg) && Object.keys(arg).length === 0
      }
      
      // Check for message with error object: ['Failed to load notifications:', {...}]
      if (args.length === 2 && typeof args[0] === 'string') {
        const message = args[0].toLowerCase()
        const errorObj = args[1]
        
        // ULTRA-AGGRESSIVE: If message is about "failed to load notifications", be very permissive
        if (message.includes('failed to load') && message.includes('notifications')) {
          // If error object is empty or stringifies to empty-looking pattern, suppress it
          if (!errorObj || (typeof errorObj === 'object' && !Array.isArray(errorObj))) {
            try {
              const stringified = JSON.stringify(errorObj)
              // Suppress if it looks empty ({} or variations with empty strings)
              if (stringified === '{}' || 
                  /^\{\s*"message"\s*:\s*""\s*(,\s*"code"\s*:\s*"")?\s*(,\s*"error"\s*:\s*\{\s*\})?\s*\}$/.test(stringified) ||
                  /^\{\s*"code"\s*:\s*""\s*(,\s*"message"\s*:\s*"")?\s*(,\s*"error"\s*:\s*\{\s*\})?\s*\}$/.test(stringified) ||
                  /^\{\s*"error"\s*:\s*\{\s*\}\s*(,\s*"message"\s*:\s*"")?\s*(,\s*"code"\s*:\s*"")?\s*\}$/.test(stringified)) {
                return true
              }
            } catch {
              // If stringify fails, continue with other checks
            }
          }
        }
        
        // Check if message is about notifications/database errors
        if ((message.includes('notifications') || message.includes('failed to load')) && 
            errorObj && typeof errorObj === 'object' && !Array.isArray(errorObj)) {
          // Aggressive check: if message contains "failed to load notifications", suppress empty errors
          if (message.includes('failed to load') && message.includes('notifications')) {
            // Check if it's an empty object
            if (Object.keys(errorObj).length === 0) {
              return true
            }
            
            // Quick check: if all top-level values are falsy/empty, consider it empty
            const allValuesEmpty = Object.values(errorObj).every(val => 
              val === null || 
              val === undefined || 
              val === '' || 
              (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0)
            )
            if (allValuesEmpty) {
              return true
            }
            
            // Special aggressive check for "Failed to load notifications:" pattern
            // If error object has message/code/error properties, check if they're all empty
            if (errorObj.hasOwnProperty('message') || errorObj.hasOwnProperty('code') || errorObj.hasOwnProperty('error')) {
              const messageVal = errorObj.message
              const codeVal = errorObj.code
              const errorVal = errorObj.error
              
              // Check if message is empty string or undefined/null
              const messageIsEmpty = messageVal === '' || messageVal === null || messageVal === undefined
              // Check if code is empty string or undefined/null
              const codeIsEmpty = codeVal === '' || codeVal === null || codeVal === undefined
              // Check if error is empty object or undefined/null
              const errorIsEmpty = !errorVal || 
                (typeof errorVal === 'object' && !Array.isArray(errorVal) && Object.keys(errorVal).length === 0)
              
              // If all three are empty (or missing), suppress it
              if (messageIsEmpty && codeIsEmpty && errorIsEmpty) {
                return true
              }
            }
          }
          
          // Check if it's an empty object
          if (Object.keys(errorObj).length === 0) {
            return true
          }
          
          // Helper to check if a value is empty/meaningless (recursive)
          const isEmptyValue = (val: any, depth = 0): boolean => {
            // Prevent infinite recursion
            if (depth > 3) return false
            
            if (val === null || val === undefined || val === '') return true
            if (typeof val === 'object' && !Array.isArray(val)) {
              // Check if it's an empty object
              if (Object.keys(val).length === 0) return true
              // Recursively check if all nested properties are empty
              return Object.values(val).every(v => isEmptyValue(v, depth + 1))
            }
            return false
          }
          
          // Check if all properties are empty/null/undefined/empty objects
          const allEmpty = Object.values(errorObj).every(val => isEmptyValue(val))
          if (allEmpty) {
            return true
          }
          
          // Special case: if error object has message/code/error properties and all are empty
          // This handles the pattern: {message: '', code: '', error: {}}
          const hasMessageProp = errorObj.hasOwnProperty('message')
          const hasCodeProp = errorObj.hasOwnProperty('code')
          const hasErrorProp = errorObj.hasOwnProperty('error')
          
          if (hasMessageProp || hasCodeProp || hasErrorProp) {
            const messageEmpty = !hasMessageProp || !errorObj.message || errorObj.message === '' || isEmptyValue(errorObj.message)
            const codeEmpty = !hasCodeProp || !errorObj.code || errorObj.code === '' || isEmptyValue(errorObj.code)
            const errorEmpty = !hasErrorProp || !errorObj.error || isEmptyValue(errorObj.error)
            
            // If all present properties are empty, it's an empty error
            const allPresentPropsEmpty = 
              (!hasMessageProp || messageEmpty) && 
              (!hasCodeProp || codeEmpty) && 
              (!hasErrorProp || errorEmpty)
            
            if (allPresentPropsEmpty) {
              return true
            }
          }
          
          // Additional check: try to stringify and see if it represents an empty error
          try {
            const stringified = JSON.stringify(errorObj)
            // If stringified is just "{}" or matches patterns like {"message":"","code":"","error":{}}
            if (stringified === '{}' || 
                stringified === '{"message":"","code":"","error":{}}' ||
                stringified === '{"message":"","code":""}' ||
                stringified === '{"error":{}}' ||
                /^\{\s*"message"\s*:\s*""\s*(,\s*"code"\s*:\s*"")?\s*(,\s*"error"\s*:\s*\{\s*\})?\s*\}$/.test(stringified)) {
              return true
            }
          } catch {
            // If stringification fails, continue with other checks
          }
        }
      }
      
      return false
    }

    // Helper to safely stringify objects, handling circular references
    const safeStringify = (obj: any, maxDepth = 3, currentDepth = 0): string => {
      if (currentDepth >= maxDepth) {
        return '[Max Depth Reached]'
      }
      
      try {
        // Handle null/undefined
        if (obj === null) return 'null'
        if (obj === undefined) return 'undefined'
        
        // Handle primitives
        if (typeof obj !== 'object') {
          return String(obj)
        }
        
        // Handle arrays
        if (Array.isArray(obj)) {
          return `[${obj.map(item => safeStringify(item, maxDepth, currentDepth + 1)).join(', ')}]`
        }
        
        // Handle DOM elements
        if (obj instanceof HTMLElement || obj instanceof Element) {
          return `<${obj.tagName.toLowerCase()}${obj.id ? ` id="${obj.id}"` : ''}${obj.className ? ` class="${obj.className}"` : ''}>`
        }
        
        // Handle React elements/components
        if (obj.$$typeof || obj._owner || obj.props) {
          return `[React Element/Component]`
        }
        
        // Try JSON.stringify with circular reference handler
        const seen = new WeakSet()
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular Reference]'
            }
            seen.add(value)
            
            // Skip React internal properties
            if (key === '__reactFiber$' || key === '__reactInternalInstance$' || key.startsWith('__react')) {
              return '[React Internal]'
            }
            
            // Skip DOM node references
            if (value instanceof HTMLElement || value instanceof Element) {
              return `<${value.tagName.toLowerCase()}>`
            }
          }
          return value
        }, 2)
      } catch (error) {
        // Fallback for any other errors
        try {
          return String(obj)
        } catch {
          return '[Unable to stringify]'
        }
      }
    }

    const addLog = (level: string, ...args: any[]) => {
      const time = new Date().toLocaleTimeString()
      const message = args.map(arg => {
        try {
          if (typeof arg === 'object' && arg !== null) {
            return safeStringify(arg)
          }
          // Preserve emoji and special characters - use direct string conversion
          // Don't use any encoding/decoding that might corrupt UTF-8
          return String(arg)
        } catch {
          return String(arg)
        }
      }).join(' ')
      
      // Only capture install-related logs
      if (!isInstallRelatedLog(message, args)) {
        // Don't store non-install logs
        return
      }
      
      // Store sanitized args (remove circular references)
      const sanitizedArgs = args.map(arg => {
        try {
          if (typeof arg === 'object' && arg !== null) {
            // Create a safe copy without circular references
            const seen = new WeakSet()
            const sanitize = (obj: any, depth = 0): any => {
              if (depth > 3) return '[Max Depth]'
              if (obj === null || obj === undefined) return obj
              if (typeof obj !== 'object') return obj
              if (seen.has(obj)) return '[Circular]'
              if (obj instanceof HTMLElement || obj instanceof Element) {
                return { type: 'HTMLElement', tagName: obj.tagName, id: obj.id, className: obj.className }
              }
              if (obj.$$typeof || obj._owner) {
                return { type: 'ReactElement' }
              }
              if (Array.isArray(obj)) {
                seen.add(obj)
                return obj.map(item => sanitize(item, depth + 1))
              }
              seen.add(obj)
              const result: any = {}
              for (const key in obj) {
                if (key.startsWith('__react') || key.startsWith('__')) continue
                try {
                  result[key] = sanitize(obj[key], depth + 1)
                } catch {
                  result[key] = '[Error]'
                }
              }
              return result
            }
            return sanitize(arg)
          }
          return arg
        } catch {
          return '[Unable to serialize]'
        }
      })
      
      // Update ref immediately (safe during render)
      logsRef.current = [...logsRef.current.slice(-199), { time, level, message, args: sanitizedArgs }]
      
      // Schedule state update (batched, not during render)
      scheduleUpdate()
    }

    console.log = (...args: any[]) => {
      // Check if it's an empty error object before logging
      const isEmptyError = isEmptyErrorArgs(...args)
      // Only call originalLog if it's not an empty error object and originalLog exists
      if (!isEmptyError && originalLog && typeof originalLog === 'function') {
        try {
          originalLog(...args)
        } catch (err) {
          // Silently ignore errors from originalLog to prevent breaking the override
        }
      }
      // Only capture if install-related
      // Preserve string args as-is to maintain emoji encoding
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg
        return String(arg)
      }).join(' ')
      if (isInstallRelatedLog(message, args)) {
        setTimeout(() => addLog('log', ...args), 0)
      }
    }

    console.error = (...args: any[]) => {
      // Check if it's an empty error object before logging
      // Empty error objects typically indicate missing database tables (expected)
      const isEmptyError = isEmptyErrorArgs(...args)
      
      // Only call originalError if it's not an empty error object and originalError exists
      if (!isEmptyError && originalError && typeof originalError === 'function') {
        try {
          originalError(...args)
        } catch (err) {
          // Silently ignore errors from originalError to prevent breaking the override
        }
      }
      
      // Only capture if install-related
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg
        return String(arg)
      }).join(' ')
      if (isInstallRelatedLog(message, args)) {
        setTimeout(() => addLog('error', ...args), 0)
      }
    }

    console.warn = (...args: any[]) => {
      // Check if it's an empty error object before logging
      const isEmptyError = isEmptyErrorArgs(...args)
      if (!isEmptyError && originalWarn && typeof originalWarn === 'function') {
        try {
          originalWarn(...args)
        } catch (err) {
          // Silently ignore errors from originalWarn to prevent breaking the override
        }
      }
      // Only capture if install-related
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg
        return String(arg)
      }).join(' ')
      if (isInstallRelatedLog(message, args)) {
        setTimeout(() => addLog('warn', ...args), 0)
      }
    }

    console.info = (...args: any[]) => {
      // Check if it's an empty error object before logging
      const isEmptyError = isEmptyErrorArgs(...args)
      if (!isEmptyError && originalInfo && typeof originalInfo === 'function') {
        try {
          originalInfo(...args)
        } catch (err) {
          // Silently ignore errors from originalInfo to prevent breaking the override
        }
      }
      // Only capture if install-related
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg
        return String(arg)
      }).join(' ')
      if (isInstallRelatedLog(message, args)) {
        setTimeout(() => addLog('info', ...args), 0)
      }
    }

    console.debug = (...args: any[]) => {
      // Check if it's an empty error object before logging
      const isEmptyError = isEmptyErrorArgs(...args)
      if (!isEmptyError && originalDebug && typeof originalDebug === 'function') {
        try {
          originalDebug(...args)
        } catch (err) {
          // Silently ignore errors from originalDebug to prevent breaking the override
        }
      }
      // Only capture if install-related
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg
        return String(arg)
      }).join(' ')
      if (isInstallRelatedLog(message, args)) {
        setTimeout(() => addLog('debug', ...args), 0)
      }
    }

    return () => {
      window.removeEventListener('pwa-install-button-clicked', handleInstallButtonClick)
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
      console.info = originalInfo
      console.debug = originalDebug
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [scheduleUpdate])

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-900/30 text-red-300 border-red-700/50'
      case 'warn': return 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50'
      case 'info': return 'bg-blue-900/30 text-blue-300 border-blue-700/50'
      case 'debug': return 'bg-purple-900/30 text-purple-300 border-purple-700/50'
      default: return 'bg-slate-800 text-gray-300 border-slate-700/50'
    }
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error': return '❌'
      case 'warn': return '⚠️'
      case 'info': return 'ℹ️'
      case 'debug': return '🐛'
      default: return '📝'
    }
  }

  const copyLogToClipboard = async (log: { time: string; level: string; message: string; args?: any[] }, index: number) => {
    try {
      let textToCopy = `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`
      
      if (log.args && log.args.length > 0) {
        try {
          const argsText = JSON.stringify(log.args, null, 2)
          textToCopy += `\n\nArguments:\n${argsText}`
        } catch {
          textToCopy += `\n\nArguments: [Unable to stringify]`
        }
      }
      
      await navigator.clipboard.writeText(textToCopy)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (error) {
      console.error('Failed to copy log:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopiedIndex(index)
        setTimeout(() => setCopiedIndex(null), 2000)
      } catch (err) {
        console.error('Fallback copy failed:', err)
      }
      document.body.removeChild(textArea)
    }
  }

  const copyAllLogsToClipboard = async () => {
    try {
      const allLogs = logs.length > 0 ? logs : logsRef.current
      const logsText = allLogs.map((log, index) => {
        let logText = `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`
        if (log.args && log.args.length > 0) {
          try {
            const argsText = JSON.stringify(log.args, null, 2)
            logText += `\n  Args: ${argsText}`
          } catch {
            logText += `\n  Args: [Unable to stringify]`
          }
        }
        return logText
      }).join('\n\n')
      
      await navigator.clipboard.writeText(logsText)
      setAllCopied(true)
      setTimeout(() => setAllCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy all logs:', error)
      // Fallback
      const textArea = document.createElement('textarea')
      const allLogs = logs.length > 0 ? logs : logsRef.current
      textArea.value = allLogs.map(log => `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`).join('\n\n')
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setAllCopied(true)
        setTimeout(() => setAllCopied(false), 2000)
      } catch (err) {
        console.error('Fallback copy failed:', err)
      }
      document.body.removeChild(textArea)
    }
  }

  const sendLogsToEmail = async () => {
    setSendingEmail(true)
    setEmailSent(false)
    
    try {
      const allLogs = logs.length > 0 ? logs : logsRef.current
      
      const response = await fetch('/api/send-logs-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: allLogs
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // If email service not configured, use mailto fallback
        if (data.fallback && data.mailtoLink) {
          window.location.href = data.mailtoLink
          setEmailSent(true)
          setTimeout(() => setEmailSent(false), 3000)
        } else {
          throw new Error(data.error || 'Failed to send email')
        }
      } else {
        setEmailSent(true)
        setTimeout(() => setEmailSent(false), 3000)
        console.log('📧 Logs sent to email successfully')
      }
    } catch (error: any) {
      console.error('Failed to send logs via email:', error)
      // Fallback to mailto
      const allLogs = logs.length > 0 ? logs : logsRef.current
      const logsText = allLogs.map((log) => 
        `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`
      ).join('\n\n')
      const mailtoLink = `mailto:groklord@yahoo.com?subject=Console Logs - ${encodeURIComponent(new Date().toLocaleString())}&body=${encodeURIComponent(logsText)}`
      window.location.href = mailtoLink
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } finally {
      setSendingEmail(false)
    }
  }

  const handleOpen = () => {
    console.log('🔵 Purple button clicked, opening console logger')
    console.log('🔵 Current logsRef length:', logsRef.current.length)
    console.log('🔵 Current logs state length:', logs.length)
    console.log('🔵 Current isOpen state:', isOpen)
    // Use functional update to ensure state change
    setIsOpen((prev) => {
      console.log('🔵 setIsOpen called, prev:', prev, 'setting to true')
      return true
    })
    setIsMinimized(false)
    // Force update to show existing logs immediately
    setTimeout(() => {
      console.log('🔵 After setIsOpen, forcing log update')
      const currentLogs = [...logsRef.current]
      console.log('🔵 Setting logs to:', currentLogs.length, 'items')
      setLogs(currentLogs)
    }, 50)
  }

  console.log('🔵 ConsoleLogger rendering, isOpen:', isOpen, 'isMinimized:', isMinimized, 'logs:', logs.length, 'logsRef:', logsRef.current.length)
  
  // Force a visual indicator that component is rendering
  if (isOpen) {
    console.log('🔵 RENDERING PANEL - isOpen is TRUE')
  }
  
  return (
    <>
      {/* Toggle button - always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-console-logger-button="true"
        className="fixed top-4 left-4 z-[999999] rounded-full bg-gradient-to-br from-purple-600 to-purple-500 text-white shadow-2xl shadow-purple-500/60 flex items-center justify-center touch-manipulation hover:from-purple-500 hover:to-purple-400 active:from-purple-700 active:to-purple-600 transition border-2 border-white/30"
        title={isOpen ? "Hide Console Logs" : "Show Console Logs"}
        aria-label={isOpen ? "Hide Console Logs" : "Show Console Logs"}
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 999999,
          display: 'flex',
          width: '56px',
          height: '56px',
          minWidth: '56px',
          minHeight: '56px',
          visibility: 'visible',
          opacity: '1',
          pointerEvents: 'auto',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <Terminal size={24} strokeWidth={2.5} />
      </button>

      {/* Panel - show when open, positioned below button */}
      {isOpen && (
    <div 
      data-console-logger="true"
      className={`fixed ${isMinimized ? 'top-20 left-4 w-80' : 'top-20 left-4 right-4 md:right-auto md:w-[600px]'} z-[999998] transition-all duration-300`}
      style={{
        position: 'fixed',
        top: '80px', // Position below the button
        left: isMinimized ? '1rem' : '1rem',
        right: isMinimized ? 'auto' : '1rem',
        zIndex: 999998,
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        pointerEvents: 'auto',
        backgroundColor: 'transparent',
        maxWidth: isMinimized ? '320px' : 'calc(100% - 2rem)',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)'
      }}
    >
      <div 
        className="bg-slate-900 border-2 border-purple-500 rounded-lg shadow-2xl flex flex-col" 
        style={{ 
          minHeight: isMinimized ? '60px' : '400px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          visibility: 'visible',
          opacity: '1',
          maxHeight: isMinimized ? '60px' : 'calc(100vh - 100px)',
          backgroundColor: '#0f172a',
          borderColor: '#a855f7',
          borderWidth: '3px',
          borderStyle: 'solid',
          boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-purple-400" />
            <h3 className="text-white font-bold text-sm">Console Logs</h3>
            <span className="text-xs text-gray-400">({logs.length || logsRef.current.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={sendLogsToEmail}
              disabled={sendingEmail}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={emailSent ? "Email sent!" : sendingEmail ? "Sending..." : "Send logs to email (groklord@yahoo.com)"}
            >
              {sendingEmail ? (
                <Loader2 size={16} className="animate-spin" />
              ) : emailSent ? (
                <Check size={16} className="text-green-400" />
              ) : (
                <Mail size={16} />
              )}
            </button>
            <button
              onClick={copyAllLogsToClipboard}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition"
              title={allCopied ? "Copied!" : "Copy All Logs"}
            >
              {allCopied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
            <button
              onClick={() => {
                logsRef.current = []
                setLogs([])
              }}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition"
              title="Clear Logs"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Logs Container - Always render, show/hide with display */}
        {!isMinimized && (
          <div 
            className="overflow-y-auto p-3 md:p-4 space-y-2 bg-slate-950"
            style={{ 
              display: 'block',
              minHeight: '200px',
              maxHeight: 'calc(100vh - 120px)',
              visibility: 'visible',
              opacity: '1',
              flex: '1',
              WebkitOverflowScrolling: 'touch',
              backgroundColor: '#020617',
              overflowX: 'hidden',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              touchAction: 'pan-y',
              position: 'relative',
              willChange: 'scroll-position'
            }}
          >
            {/* Always show test button at top */}
            <div className="mb-4 pb-4 border-b border-slate-800">
              <button
                onClick={() => {
                  console.log('✅ Test log message - Console logger is working!')
                  console.warn('⚠️ Test warning message')
                  console.error('❌ Test error message')
                  console.info('ℹ️ Test info message')
                  console.debug('🐛 Test debug message')
                  // Force update immediately
                  setTimeout(() => {
                    setLogs([...logsRef.current])
                  }, 100)
                }}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm rounded-lg font-semibold transition touch-manipulation shadow-lg"
                style={{
                  display: 'block',
                  visibility: 'visible',
                  opacity: '1',
                  minHeight: '44px',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                🧪 Test Console
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">Click to generate test logs</p>
            </div>

            {/* Show logs if they exist */}
            {logs.length > 0 || logsRef.current.length > 0 ? (
              <div className="space-y-1">
                {(logs.length > 0 ? logs : logsRef.current).map((log, index) => (
                  <div
                    key={index}
                    className={`text-xs p-2 rounded border font-mono ${getLogColor(log.level)}`}
                    style={{ 
                      display: 'block', 
                      visibility: 'visible',
                      opacity: '1'
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 shrink-0 text-[10px]">{log.time}</span>
                      <span className="shrink-0">{getLogIcon(log.level)}</span>
                      <span className="text-gray-400 shrink-0 text-[10px]">[{log.level}]</span>
                      <span className="break-words flex-1 text-xs">{log.message}</span>
                      <button
                        onClick={() => copyLogToClipboard(log, index)}
                        className="shrink-0 p-1 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition ml-auto"
                        title={copiedIndex === index ? "Copied!" : "Copy log"}
                      >
                        {copiedIndex === index ? (
                          <Check size={12} className="text-green-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                    {log.args && log.args.length > 0 && log.args.some(arg => typeof arg === 'object') && (
                      <details className="mt-2 ml-8">
                        <summary className="text-gray-400 text-[10px] cursor-pointer">View details</summary>
                        <pre className="mt-1 text-[10px] text-gray-400 overflow-x-auto">
                          {(() => {
                            try {
                              return JSON.stringify(log.args, null, 2)
                            } catch (error) {
                              // Fallback if still has circular references
                              try {
                                const seen = new WeakSet()
                                return JSON.stringify(log.args, (key, value) => {
                                  if (typeof value === 'object' && value !== null) {
                                    if (seen.has(value)) {
                                      return '[Circular Reference]'
                                    }
                                    seen.add(value)
                                  }
                                  return value
                                }, 2)
                              } catch {
                                return String(log.args)
                              }
                            }
                          })()}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">No logs yet. Click "Test Console" above to generate logs.</p>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
      )}
    </>
  )
}


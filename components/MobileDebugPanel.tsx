'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Bug } from 'lucide-react'

export default function MobileDebugPanel() {
  const [logs, setLogs] = useState<Array<{ time: string; level: string; message: string }>>([])
  const [isOpen, setIsOpen] = useState(false)
  const logsRef = useRef<Array<{ time: string; level: string; message: string }>>([])
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    // Override console methods to capture logs
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

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

    const addLog = (level: string, ...args: any[]) => {
      const time = new Date().toLocaleTimeString()
      const message = args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        } catch {
          return String(arg)
        }
      }).join(' ')
      
      // Update ref immediately (safe during render)
      logsRef.current = [...logsRef.current.slice(-49), { time, level, message }]
      
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
      // Use setTimeout to defer state update
      setTimeout(() => addLog('log', ...args), 0)
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
      setTimeout(() => addLog('error', ...args), 0)
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
      setTimeout(() => addLog('warn', ...args), 0)
    }

    return () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [scheduleUpdate])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-[999999] w-12 h-12 rounded-full bg-red-600 text-white shadow-lg flex items-center justify-center touch-manipulation"
        title="Show Debug Logs"
        aria-label="Show Debug Logs"
      >
        <Bug size={20} />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[999999] flex flex-col p-4">
      <div className="bg-slate-900 rounded-lg flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-white font-bold">Debug Console</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                logsRef.current = []
                setLogs([])
              }}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded"
            >
              Clear
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {logs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No logs yet</p>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`text-xs p-2 rounded font-mono ${
                  log.level === 'error' ? 'bg-red-900/30 text-red-300' :
                  log.level === 'warn' ? 'bg-yellow-900/30 text-yellow-300' :
                  'bg-slate-800 text-gray-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 shrink-0">{log.time}</span>
                  <span className="text-gray-400 shrink-0">[{log.level}]</span>
                  <span className="break-words flex-1">{log.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


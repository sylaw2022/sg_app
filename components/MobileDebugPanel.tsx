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
      originalLog(...args)
      // Use setTimeout to defer state update
      setTimeout(() => addLog('log', ...args), 0)
    }

    console.error = (...args: any[]) => {
      originalError(...args)
      setTimeout(() => addLog('error', ...args), 0)
    }

    console.warn = (...args: any[]) => {
      originalWarn(...args)
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


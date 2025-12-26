'use client'
import { useState, useEffect } from 'react'
import { Download, X, Info } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showManualInstructions, setShowManualInstructions] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [showInstalledMessage, setShowInstalledMessage] = useState(true)
  
  // Always show floating install icon on mobile (if not installed)
  // Define this early so it can be used anywhere in the component
  const showFloatingIcon = !isInstalled

  useEffect(() => {
    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent)
    const isAndroidDevice = /android/.test(userAgent)
    setIsIOS(isIOSDevice)
    setIsAndroid(isAndroidDevice)

    // Check if app is already installed
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return true
      }
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true)
        return true
      }
      return false
    }

    if (checkInstalled()) {
      console.log('📱 App already installed')
      // Check if installed message was previously dismissed
      const wasDismissed = sessionStorage.getItem('pwa-installed-message-dismissed') === 'true'
      setShowInstalledMessage(!wasDismissed)
      return
    }

    // Clear dismissed state on component mount to allow install prompt on fresh load/login
    // This ensures users can always try installing, even if they dismissed before
    const wasDismissed = sessionStorage.getItem('pwa-prompt-dismissed') === 'true'
    if (wasDismissed) {
      console.log('📱 Previously dismissed, clearing to allow fresh install attempt')
      // Clear dismissed state to allow install attempts on this session
      sessionStorage.removeItem('pwa-prompt-dismissed')
    }

    // Check PWA requirements
    const checkPWARequirements = async () => {
      try {
        // Check if service worker is registered
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration()
          console.log('📱 Service Worker registered:', !!registration)
        }
        
        // Check if manifest is accessible
        const manifestResponse = await fetch('/manifest.json')
        console.log('📱 Manifest accessible:', manifestResponse.ok)
        
        // Log PWA readiness
        console.log('📱 PWA Requirements Check:', {
          hasServiceWorker: 'serviceWorker' in navigator,
          hasManifest: manifestResponse.ok,
          isHTTPS: location.protocol === 'https:' || location.hostname === 'localhost'
        })
      } catch (error) {
        console.error('📱 PWA Requirements Check Error:', error)
      }
    }
    
    checkPWARequirements()

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🔔 beforeinstallprompt event fired!', e)
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      // Store in window for persistence across page reloads
      ;(window as any).deferredPrompt = promptEvent
      setDeferredPrompt(promptEvent)
      // Clear dismissed state when event fires (fresh install opportunity)
      sessionStorage.removeItem('pwa-prompt-dismissed')
      setShowPrompt(true)
      console.log('📱 Deferred prompt saved:', !!promptEvent)
      console.log('📱 Cleared dismissed state - install prompt is now available')
    }

    // Listen for early event captured by layout script
    const handleEarlyPrompt = (e: CustomEvent) => {
      console.log('🔔 Early beforeinstallprompt event received from layout script')
      const promptEvent = e.detail as BeforeInstallPromptEvent
      ;(window as any).deferredPrompt = promptEvent
      setDeferredPrompt(promptEvent)
      sessionStorage.removeItem('pwa-prompt-dismissed')
      setShowPrompt(true)
      console.log('📱 Early deferred prompt saved')
    }
    window.addEventListener('early-beforeinstallprompt', handleEarlyPrompt as EventListener)

    // Check if event already fired (captured by early script or previous load)
    if ((window as any).deferredPrompt) {
      console.log('📱 Found existing deferredPrompt in window')
      const existingPrompt = (window as any).deferredPrompt as BeforeInstallPromptEvent
      setDeferredPrompt(existingPrompt)
      sessionStorage.removeItem('pwa-prompt-dismissed')
      setShowPrompt(true)
    }

    // Add listener immediately - before page fully loads
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt, { passive: false, capture: true })
    // Also listen on document for early event capture
    document.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt, { passive: false, capture: true })
    console.log('📱 Added beforeinstallprompt listener')

    // Check if app was just installed
    const handleAppInstalled = () => {
      console.log('✅ App installed')
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    // Show prompt after a short delay if not already shown
    const timer = setTimeout(() => {
      // Re-check dismissed state (might have been cleared above)
      const isDismissed = sessionStorage.getItem('pwa-prompt-dismissed') === 'true'
      const installed = checkInstalled()
      // Check both state and window for deferred prompt
      const hasPrompt = !!(window as any).deferredPrompt
      
      console.log('📱 PWA Install Check:', {
        installed,
        isDismissed,
        hasDeferredPrompt: hasPrompt,
        willShow: !installed
      })
      
      // Always show floating icon button (it's always visible)
      // The prompt card will show if we have a deferred prompt or if not dismissed
      if (hasPrompt && !installed) {
        // If we have a deferred prompt, clear dismissed state and show prompt card
        sessionStorage.removeItem('pwa-prompt-dismissed')
        setShowPrompt(true)
        console.log('📱 Showing PWA install prompt (has deferredPrompt)')
      } else if (!installed) {
        // Even if dismissed, we still show the floating icon button
        // The prompt card won't show, but user can click the button
        console.log('📱 Floating icon button available (prompt card hidden due to dismissed state)')
      }
    }, 1500) // Increased delay to allow beforeinstallprompt to fire

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      document.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('early-beforeinstallprompt', handleEarlyPrompt as EventListener)
      window.removeEventListener('appinstalled', handleAppInstalled)
      clearTimeout(timer)
    }
  }, []) // Empty dependency array - only run once on mount

  const handleInstallClick = async () => {
    console.log('📱 Blue circular button clicked', {
      hasDeferredPrompt: !!deferredPrompt,
      isAndroid,
      isIOS
    })
    
    // Dispatch event to open console logger
    window.dispatchEvent(new CustomEvent('pwa-install-button-clicked'))
    
    // Clear dismissed state when user clicks install button (they want to install)
    sessionStorage.removeItem('pwa-prompt-dismissed')
    
    // Check both state and window for deferred prompt
    const promptToUse = deferredPrompt || (window as any).deferredPrompt
    
    if (promptToUse) {
      // Use browser's install prompt if available
      try {
        console.log('📱 Triggering install prompt from blue circular button')
        await promptToUse.prompt()
        const { outcome } = await promptToUse.userChoice
        console.log('📱 Install prompt outcome:', outcome)
        if (outcome === 'accepted') {
          setIsInstalled(true)
          setShowPrompt(false)
        }
        setDeferredPrompt(null)
        ;(window as any).deferredPrompt = null
        setShowPrompt(false)
      } catch (error) {
        console.error('❌ Error showing install prompt:', error)
        // Fallback to manual instructions
        setShowManualInstructions(true)
      }
    } else {
      // If no browser prompt available, show manual installation instructions
      console.log('📱 No browser install prompt available (deferredPrompt is null)')
      console.log('📱 Possible reasons:', {
        'beforeinstallprompt not fired': 'User may have dismissed before, or browser restrictions',
        'PWA criteria met': 'Service worker and manifest are OK',
        'Already installed': isInstalled,
        'Browser': isAndroid ? 'Android Chrome' : isIOS ? 'iOS Safari' : 'Other'
      })
      
      // For Android Chrome, provide specific instructions
      if (isAndroid) {
        console.log('📱 Showing Android Chrome manual install instructions')
        setShowManualInstructions(true)
      } else {
        setShowManualInstructions(true)
      }
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setShowManualInstructions(false)
    sessionStorage.setItem('pwa-prompt-dismissed', 'true')
  }

  // Show installed message if app is installed and message not dismissed
  if (isInstalled && showInstalledMessage) {
    console.log('📱 PWA: App already installed')
    return (
      <div 
        data-pwa-install-prompt="true"
        className="fixed top-4 right-4 w-80 md:w-96 z-50 animate-slide-down"
        style={{
          zIndex: 99998,
          position: 'fixed',
          top: '1rem',
          right: '1rem'
        }}
      >
        <div className="bg-green-800 border border-green-500 rounded-lg shadow-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Download className="h-5 w-5 text-green-400" />
              <h3 className="text-white font-bold text-sm">App Installed</h3>
            </div>
            <button
              onClick={() => {
                sessionStorage.setItem('pwa-installed-message-dismissed', 'true')
                setShowInstalledMessage(false)
              }}
              className="text-gray-400 hover:text-white transition p-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-green-200 text-xs">
            ✅ SG APP is installed and ready to use!
          </p>
        </div>
      </div>
    )
  }

  // Always show the floating icon button - users should always be able to try installing
  // The prompt card can be hidden if dismissed, but the button remains available
  const isDismissed = sessionStorage.getItem('pwa-prompt-dismissed') === 'true'
  const installedMessageDismissed = sessionStorage.getItem('pwa-installed-message-dismissed') === 'true'
  
  // Only hide everything if installed AND message dismissed AND not showing anything
  // But always show floating icon button for install attempts
  if (isInstalled && !showManualInstructions && !showPrompt && installedMessageDismissed) {
    console.log('📱 PWA: App installed and message dismissed')
    return null
  }

  console.log('📱 PWA: Rendering install prompt/icon', {
    showPrompt,
    showFloatingIcon,
    showManualInstructions,
    isDismissed
  })

  // Show manual instructions modal
  if (showManualInstructions) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-blue-500 rounded-lg shadow-2xl p-6 max-w-md w-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Info className="h-5 w-5 text-blue-400" />
              <h3 className="text-white font-bold text-lg">Install App</h3>
            </div>
            <button
              onClick={() => setShowManualInstructions(false)}
              className="text-gray-400 hover:text-white transition"
              title="Close instructions (you can still install)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {isIOS ? (
            <div className="space-y-3 text-gray-300 text-sm">
              <p className="font-semibold text-white">For iOS (Safari):</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Tap the <strong className="text-white">Share</strong> button <span className="text-blue-400">(□↑)</span> at the bottom</li>
                <li>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong></li>
                <li>Tap <strong className="text-white">"Add"</strong> in the top right</li>
              </ol>
            </div>
          ) : isAndroid ? (
            <div className="space-y-3 text-gray-300 text-sm">
              <p className="font-semibold text-white">For Android (Chrome):</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Tap the <strong className="text-white">Menu</strong> button <span className="text-blue-400">(⋮)</span> in the top right</li>
                <li>Tap <strong className="text-white">"Install app"</strong> or <strong className="text-white">"Add to Home screen"</strong></li>
                <li>Tap <strong className="text-white">"Install"</strong> to confirm</li>
              </ol>
              <p className="text-xs text-gray-400 mt-3">Or look for the install icon in your browser's address bar.</p>
            </div>
          ) : (
            <div className="space-y-3 text-gray-300 text-sm">
              <p className="font-semibold text-white">For Desktop:</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Look for the <strong className="text-white">install icon</strong> <span className="text-blue-400">(⊕)</span> in your browser's address bar</li>
                <li>Click it and follow the prompts</li>
                <li>Or use your browser's menu: <strong className="text-white">Menu → Install App</strong></li>
              </ol>
              <p className="text-xs text-gray-400 mt-3">Supported browsers: Chrome, Edge, Opera</p>
            </div>
          )}
          
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                // Clear dismissed state to allow retry
                sessionStorage.removeItem('pwa-prompt-dismissed')
                setShowManualInstructions(false)
                console.log('📱 Cleared dismissed state, reloading page to retry install')
                // Reload to potentially trigger beforeinstallprompt again
                window.location.reload()
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-semibold transition"
            >
              Retry Install
            </button>
            <button
              onClick={() => setShowManualInstructions(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  console.log('📱 PWA Floating Icon:', {
    showFloatingIcon,
    isInstalled,
    willRender: showFloatingIcon
  })

  return (
    <>
      {/* Floating Install Icon Button - Mobile Only (Top Right) */}
      {showFloatingIcon && (
        <button
          onClick={handleInstallClick}
          data-pwa-install-icon="true"
          className="
            md:hidden
            rounded-full
            bg-gradient-to-br from-blue-600 to-blue-500
            hover:from-blue-500 hover:to-blue-400
            active:from-blue-700 active:to-blue-600
            shadow-2xl shadow-blue-500/60
            flex items-center justify-center
            transition-all duration-300
            animate-bounce-subtle
            touch-manipulation
            border-2 border-white/30
          "
          title="Install App"
          aria-label="Install App"
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 999999,
            display: 'flex',
            width: '60px',
            height: '60px',
            minWidth: '60px',
            minHeight: '60px',
            visibility: 'visible',
            opacity: '1',
            pointerEvents: 'auto',
            backgroundColor: '#2563eb',
            boxShadow: '0 10px 25px rgba(37, 99, 235, 0.5)',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <Download className="h-8 w-8 text-white" strokeWidth={3} style={{ display: 'block', pointerEvents: 'none' }} />
        </button>
      )}

      {/* Install Prompt Card - Desktop Only (Mobile uses circular button) */}
      {showPrompt && (
        <div 
          data-pwa-install-prompt="true"
          className="hidden md:block fixed top-4 right-4 w-96 animate-slide-down"
          style={{
            zIndex: 99998,
            position: 'fixed',
            top: '1rem',
            right: '1rem'
          }}
        >
          <div className="bg-slate-800 border border-blue-500 rounded-lg shadow-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Download className="h-5 w-5 text-blue-400" />
                <h3 className="text-white font-bold text-sm">Install App</h3>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-white transition p-1"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-gray-300 text-xs mb-3">
              Install SG APP for a better experience. Access it from your home screen!
            </p>
            <div className="flex space-x-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded text-sm font-semibold transition"
              >
                {deferredPrompt ? 'Install Now' : 'Show Instructions'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded text-sm transition"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Install Prompt - Guide to Blue Circular Button */}
      {showPrompt && showFloatingIcon && (
        <div 
          data-pwa-install-prompt="true"
          className="md:hidden fixed top-4 right-4 left-4 animate-slide-down"
          style={{
            zIndex: 99997,
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            left: '1rem'
          }}
        >
          <div className="bg-slate-800 border border-blue-500 rounded-lg shadow-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Download className="h-5 w-5 text-blue-400" />
                <h3 className="text-white font-bold text-sm">Install App</h3>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-white transition p-1"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-gray-300 text-xs mb-3">
              👆 Tap the <strong className="text-blue-400">blue circular button</strong> in the top-right corner to install SG APP on your device!
            </p>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Download className="h-6 w-6 text-white" />
              </div>
              <p className="text-gray-300 text-xs flex-1">
                Look for this button in the top-right corner of your screen
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded text-sm transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}


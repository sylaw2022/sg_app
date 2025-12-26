import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SG APP",
  description: "Connect with friends, send messages, make video calls, and more",
  manifest: "/manifest.json",
  themeColor: "#1e40af",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SG APP",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#1e40af" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SG APP" />
        <style dangerouslySetInnerHTML={{
          __html: `
            [data-nextjs-toast],
            [data-nextjs-toast] *,
            .__next-dev-overlay,
            #__next-build-watcher,
            [data-nextjs-dialog],
            [data-nextjs-dialog-overlay],
            iframe[src*="__next"],
            iframe[src*="next"],
            div[data-nextjs-dialog],
            div[data-nextjs-dialog-overlay],
            div[id*="__next"],
            div[class*="__next"],
            div[class*="nextjs"],
            div[id*="nextjs"],
            body > div[style*="position: fixed"][style*="bottom"]:not([data-pwa-install-icon]):not([data-pwa-install-prompt]):not([data-console-logger]):not([data-console-logger-button]),
            body > div[style*="position: fixed"][style*="left"]:not([data-pwa-install-icon]):not([data-pwa-install-prompt]):not([data-console-logger]):not([data-console-logger-button]),
            body > div[style*="bottom: 0"]:not([data-pwa-install-icon]):not([data-pwa-install-prompt]):not([data-console-logger]):not([data-console-logger-button]),
            body > div[style*="left: 0"]:not([data-pwa-install-icon]):not([data-pwa-install-prompt]):not([data-console-logger]):not([data-console-logger-button]),
            div[style*="bottom: 0"][style*="left: 0"]:not([data-pwa-install-icon]):not([data-pwa-install-prompt]):not([data-console-logger]):not([data-console-logger-button]),
            div[style*="bottom: 0"][style*="left: 0"]:not([data-pwa-install-icon]):not([data-pwa-install-prompt]):not([data-console-logger]):not([data-console-logger-button]) * {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
              height: 0 !important;
              width: 0 !important;
              overflow: hidden !important;
              position: absolute !important;
              left: -9999px !important;
              bottom: -9999px !important;
            }
          `
        }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <script src="/register-sw.js" defer></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Capture beforeinstallprompt event early, before React loads
            (function() {
              if (typeof window === 'undefined') return;
              
              window.addEventListener('beforeinstallprompt', function(e) {
                console.log('🔔 Early beforeinstallprompt event captured!');
                e.preventDefault();
                // Store in window for React component to pick up
                window.deferredPrompt = e;
                // Dispatch custom event for React components
                window.dispatchEvent(new CustomEvent('early-beforeinstallprompt', { detail: e }));
              }, { passive: false, capture: true });
              
              console.log('📱 Early beforeinstallprompt listener added');
            })();
          `
        }} />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              // Always hide dev tools - persistent across sessions
              const ALWAYS_HIDE_DEV_TOOLS = true;
              
              if (!ALWAYS_HIDE_DEV_TOOLS) return;
              
              function hideElement(el) {
                if (!el || el.hidden || !el.nodeType || el.nodeType !== 1) return;
                
                try {
                  // Skip React components and app elements
                  if (el.hasAttribute && (
                    el.hasAttribute('data-reactroot') ||
                    el.hasAttribute('data-react-component') ||
                    el.hasAttribute('data-pwa-install-icon') ||
                    el.hasAttribute('data-pwa-install-prompt') ||
                    el.hasAttribute('data-chat-input') ||
                    el.hasAttribute('data-video-call') ||
                    el.hasAttribute('data-console-logger') ||
                    el.hasAttribute('data-console-logger-button') ||
                    el.closest('[data-reactroot]') ||
                    el.closest('[data-react-component]') ||
                    el.closest('[data-console-logger]')
                  )) {
                    return;
                  }
                  
                  // Check if element is still in the DOM and connected
                  if (!el.isConnected || !el.parentNode) return;
                  
                  // Only hide with CSS, don't remove from DOM to avoid conflicts with React
                  el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; height: 0 !important; width: 0 !important; position: absolute !important; left: -9999px !important; bottom: -9999px !important;';
                  el.hidden = true;
                  
                  // Don't call remove() - just hide it to avoid React conflicts
                  // React will handle DOM cleanup
                } catch(e) {
                  // Silently fail if element is already removed or operation fails
                }
              }
              
              function checkAndHide(element) {
                if (!element || element === document.body || element === document.documentElement) return false;
                
                // Skip React components and app elements
                if (element.hasAttribute && (
                  element.hasAttribute('data-reactroot') ||
                  element.hasAttribute('data-react-component') ||
                  element.hasAttribute('data-pwa-install-icon') ||
                  element.hasAttribute('data-pwa-install-prompt') ||
                  element.hasAttribute('data-chat-input') ||
                  element.hasAttribute('data-video-call') ||
                  element.closest('[data-reactroot]') ||
                  element.closest('[data-react-component]')
                )) {
                  return false;
                }
                
                try {
                  // Check if element is still connected to DOM
                  if (!element.isConnected) return false;
                  
                  const style = window.getComputedStyle(element);
                  const rect = element.getBoundingClientRect();
                  const text = (element.textContent?.trim() || '').toUpperCase();
                  
                  // Check if element is in bottom-left corner
                  const isBottomLeft = style.position === 'fixed' && 
                                       rect.bottom < window.innerHeight && 
                                       rect.bottom > window.innerHeight - 100 &&
                                       rect.left < 100;
                  
                  // Check for common Next.js dev indicator patterns
                  const isNextDev = element.id?.includes('__next') ||
                                   element.id?.includes('nextjs') ||
                                   element.className?.toString().includes('__next') ||
                                   element.className?.toString().includes('nextjs') ||
                                   element.getAttribute('data-nextjs-toast') ||
                                   element.getAttribute('data-nextjs-dialog') ||
                                   (text === 'N' && isBottomLeft) ||
                                   (text.length <= 2 && isBottomLeft && (text === 'N' || text.includes('N'))) ||
                                   (element.tagName === 'IFRAME' && element.src?.includes('__next'));
                  
                  if (isNextDev || (isBottomLeft && (text.length <= 3 || text === 'N'))) {
                    hideElement(element);
                    return true;
                  }
                } catch(e) {
                  // Element might be detached, ignore
                }
                return false;
              }
              
              function hideDevIndicator() {
                try {
                  // Only check elements that are not React-managed
                  const excludeSelector = ':not([data-reactroot]):not([data-react-component]):not([data-pwa-install-icon]):not([data-pwa-install-prompt]):not([data-chat-input]):not([data-video-call])';
                  
                  // Check all body children (excluding React components)
                  Array.from(document.body.children).forEach(child => {
                    if (child.isConnected && !child.hasAttribute('data-reactroot')) {
                      checkAndHide(child);
                    }
                  });
                  
                  // Check all elements with fixed position (excluding React components)
                  document.querySelectorAll('[style*="position: fixed"]' + excludeSelector + ', [style*="position:fixed"]' + excludeSelector).forEach(checkAndHide);
                  
                  // Check all divs, spans, and other elements in bottom-left (excluding React components)
                  document.querySelectorAll('body > div' + excludeSelector + ', body > span' + excludeSelector + ', body > a' + excludeSelector + ', body > button' + excludeSelector).forEach(el => {
                    try {
                      if (!el.isConnected) return;
                      const rect = el.getBoundingClientRect();
                      const style = window.getComputedStyle(el);
                      const text = (el.textContent?.trim() || '').toUpperCase();
                      if (style.position === 'fixed' && 
                          rect.bottom > window.innerHeight - 80 && 
                          rect.left < 80 &&
                          (text.length <= 3 || text === 'N' || el.id?.includes('next') || el.className?.toString().includes('next'))) {
                        hideElement(el);
                      }
                    } catch(e) {
                      // Ignore errors
                    }
                  });
                } catch(e) {
                  // Ignore errors
                }
              }
              
              // Use MutationObserver to catch elements as they're added
              let observer;
              try {
                observer = new MutationObserver(function(mutations) {
                  // Use requestAnimationFrame to defer DOM manipulation
                  // This prevents conflicts with React's DOM updates
                  requestAnimationFrame(function() {
                    mutations.forEach(function(mutation) {
                      mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                          // Skip if it's a React component or has React attributes
                          if (node.hasAttribute && (
                            node.hasAttribute('data-reactroot') ||
                            node.hasAttribute('data-react-component') ||
                            node.getAttribute('data-pwa-install-icon') ||
                            node.getAttribute('data-pwa-install-prompt') ||
                            node.getAttribute('data-chat-input')
                          )) {
                            return;
                          }
                          checkAndHide(node);
                          // Also check children, but skip React components
                          if (node.querySelectorAll) {
                            try {
                              node.querySelectorAll('*:not([data-reactroot]):not([data-react-component]):not([data-pwa-install-icon]):not([data-pwa-install-prompt]):not([data-chat-input])').forEach(checkAndHide);
                            } catch(e) {}
                          }
                        }
                      });
                    });
                    hideDevIndicator();
                  });
                });
                
                // Start observing
                if (document.body) {
                  observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: false,
                    characterData: false
                  });
                }
              } catch(e) {
                console.warn('MutationObserver not supported');
              }
              
              // Initial hide - run multiple times
              const runHide = () => {
                hideDevIndicator();
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', hideDevIndicator);
                }
              };
              
              runHide();
              
              // Run on various events
              document.addEventListener('DOMContentLoaded', hideDevIndicator);
              window.addEventListener('load', hideDevIndicator);
              window.addEventListener('resize', hideDevIndicator);
              
              // Run at multiple intervals
              setTimeout(hideDevIndicator, 0);
              setTimeout(hideDevIndicator, 50);
              setTimeout(hideDevIndicator, 100);
              setTimeout(hideDevIndicator, 200);
              setTimeout(hideDevIndicator, 500);
              setTimeout(hideDevIndicator, 1000);
              setTimeout(hideDevIndicator, 2000);
              
              // Also run periodically as backup (every 100ms)
              setInterval(hideDevIndicator, 100);
            })();
          `
        }} />
      </body>
    </html>
  );
}

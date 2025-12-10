import { useState, useEffect } from 'react'
import Spreadsheet from './components/Spreadsheet'
import ReceiverView from './components/ReceiverView'
import './index.css'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'
  })

  const [mode, setMode] = useState(null) // 'provider' or 'receiver'
  const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const handleInstallClick = () => {
    if (!installPrompt) return
    installPrompt.prompt()
    installPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null)
      }
    })
  }

  if (!mode) {
    return (
      <div className="flex items-center justify-center min-h-screen relative">
        <button
            className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-bg-secondary border border-border-color text-text-primary hover:bg-opacity-80 transition-all duration-200"
            onClick={toggleTheme}
            aria-label="Toggle theme"
        >
            {theme === 'light' ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
            )}
        </button>
        <div className="bg-bg-secondary p-10 rounded-2xl border border-border-color shadow-lg text-center">
          <h1 className="mb-6 text-2xl font-semibold">Choose Mode</h1>
          <div className="flex gap-4">
            <button
              className="p-5 rounded-xl border border-border-color bg-text-primary text-bg-primary cursor-pointer w-40 flex flex-col gap-2 transition-all duration-200 hover:-translate-y-0.5"
              onClick={() => setMode('provider')}
            >
              <span>Spreadsheet</span>
              <small className="text-[11px] opacity-80">View & Edit Data</small>
            </button>
            <button
              className="p-5 rounded-xl border border-border-color bg-bg-secondary text-text-primary cursor-pointer w-40 flex flex-col gap-2 transition-all duration-200 hover:-translate-y-0.5"
              onClick={() => setMode('receiver')}
            >
              <span>Camera</span>
              <small className="text-[11px] opacity-80">Take Photos for Spreadsheet</small>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {mode === 'provider' ? (
        <Spreadsheet
          theme={theme}
          onToggleTheme={toggleTheme}
          installPrompt={installPrompt}
          onInstall={handleInstallClick}
        />
      ) : (
        <ReceiverView />
      )}
    </div>
  )
}

export default App

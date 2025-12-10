import { useState, useEffect } from 'react'
import Spreadsheet from './components/Spreadsheet'
import ThemeToggle from './components/ThemeToggle'
import ReceiverView from './components/ReceiverView'
import './index.css'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'
  })

  const [mode, setMode] = useState(null) // 'provider' or 'receiver'

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  if (!mode) {
    return (
      <div className="flex items-center justify-center">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
        <Spreadsheet theme={theme} onToggleTheme={toggleTheme} />
      ) : (
        <ReceiverView />
      )}
    </div>
  )
}

export default App

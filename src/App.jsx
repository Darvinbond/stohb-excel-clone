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
      <div className="app mode-selection">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <div className="mode-card">
          <h1>Choose Mode</h1>
          <div className="mode-options">
            <button
              className="mode-btn primary"
              onClick={() => setMode('provider')}
            >
              Spreadsheet
              <small>View & Edit Data</small>
            </button>
            <button
              className="mode-btn secondary"
              onClick={() => setMode('receiver')}
            >
              Camera
              <small>Take Photos for Spreadsheet</small>
            </button>
          </div>
        </div>
        <style>{`
          .mode-selection {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .mode-card {
            background: var(--bg-cell);
            padding: 40px;
            border-radius: 16px;
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow-md);
            text-align: center;
          }
          .mode-card h1 {
            margin-bottom: 24px;
            font-size: 24px;
          }
          .mode-options {
            display: flex;
            gap: 16px;
          }
          .mode-btn {
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            background: var(--bg-secondary);
            color: var(--text-primary);
            cursor: pointer;
            width: 160px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: all 0.2s;
          }
          .mode-btn:hover {
            transform: translateY(-2px);
            background: var(--bg-cell-hover);
          }
          .mode-btn.primary {
            background: var(--text-header);
            color: var(--bg-primary);
          }
          .mode-btn small {
            font-size: 11px;
            opacity: 0.8;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="app">
      {mode === 'provider' ? (
        <>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Spreadsheet />
        </>
      ) : (
        <ReceiverView />
      )}
    </div>
  )
}

export default App

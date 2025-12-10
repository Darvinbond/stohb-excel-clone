import { memo } from 'react'

const ThemeToggle = memo(function ThemeToggle({ theme, onToggle }) {
    return (
        <button
            className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-bg-secondary border border-border-color text-text-primary hover:bg-opacity-80 transition-all duration-200"
            onClick={onToggle}
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
    )
})

export default ThemeToggle

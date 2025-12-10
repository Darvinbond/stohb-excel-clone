import { memo } from 'react'

const FloatingControls = memo(function FloatingControls({ onOpenDevices, theme, onToggleTheme, connectedCount }) {
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 p-1.5 bg-bg-primary/90 backdrop-blur-md border border-border-color rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all hover:scale-[1.02]">
             <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-text-primary text-bg-primary text-sm font-medium hover:opacity-90 transition-all active:scale-95"
                onClick={onOpenDevices}
            >
                <span>Devices</span>
                {connectedCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-bg-primary text-text-primary text-[10px] font-bold px-1.5">
                        {connectedCount}
                    </span>
                )}
            </button>
            <div className="w-px h-5 bg-border-color mx-1"></div>
            <button
                className="w-10 h-10 flex items-center justify-center rounded-full text-text-primary hover:bg-bg-secondary transition-colors active:scale-95"
                onClick={onToggleTheme}
                aria-label="Toggle theme"
            >
                {theme === 'light' ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                )}
            </button>
        </div>
    )
})

export default FloatingControls
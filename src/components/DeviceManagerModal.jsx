import { memo } from 'react'

const DeviceManagerModal = memo(function DeviceManagerModal({ 
    isOpen, 
    onClose, 
    peerId, 
    connections 
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000] animate-fadeIn" onClick={onClose}>
            <div 
                className="bg-bg-primary p-6 rounded-2xl w-[90%] max-w-[420px] shadow-lg border border-border-color flex flex-col gap-6" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold m-0 text-text-primary">Connect Devices</h2>
                        <p className="text-sm text-text-secondary m-0 mt-1">Pair your phone to take photos</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-secondary text-text-secondary transition-colors"
                    >
                        &times;
                    </button>
                </div>

                {/* Connection Code */}
                <div className="flex flex-col items-center gap-4 py-4 bg-bg-secondary rounded-xl border border-border-color">
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Pairing Code</span>
                    <div className="text-4xl font-mono font-bold text-text-primary tracking-[0.2em] selection:bg-accent-color selection:text-accent-fg">
                        {peerId || '...'}
                    </div>
                </div>

                {/* Instructions */}
                <div className="flex gap-4 text-sm text-text-secondary">
                    <div className="flex-1 p-3 rounded-lg bg-bg-secondary/50 border border-border-color">
                        <span className="block font-semibold text-text-primary mb-1">Step 1</span>
                        Open the app on your mobile device
                    </div>
                    <div className="flex-1 p-3 rounded-lg bg-bg-secondary/50 border border-border-color">
                        <span className="block font-semibold text-text-primary mb-1">Step 2</span>
                        Enter the pairing code shown above
                    </div>
                </div>

                {/* Connected Devices List */}
                <div className="border-t border-border-color pt-4">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-text-primary">Connected Devices</span>
                        <span className="text-xs text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-full border border-border-color">
                            {connections.length} active
                        </span>
                    </div>
                    
                    {connections.length === 0 ? (
                        <div className="text-center py-6 text-text-secondary text-sm italic">
                            No devices connected yet...
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 scrollbar-thin">
                            {connections.map((conn, i) => (
                                <div key={conn.peer || i} className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-secondary group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                            📱
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-text-primary">Device {conn.peer.substring(0, 4)}</span>
                                            <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Connected
                                            </span>
                                        </div>
                                    </div>
                                    <button 
                                        className="text-xs text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity px-2 py-1"
                                        onClick={() => conn.close()}
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
})

export default DeviceManagerModal
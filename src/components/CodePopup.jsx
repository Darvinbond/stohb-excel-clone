import { memo } from 'react'

const CodePopup = memo(function CodePopup({ code, onClose, onAssign, currentCell, connectedDevices = [] }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[2000] animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div className="bg-white p-6 rounded-[20px] w-[90%] max-w-[360px] shadow-[0_10px_40px_rgba(0,0,0,0.2)] text-center font-sans" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="m-0 text-xl font-bold">📱 Pair Device</h3>
          <button className="bg-transparent border-none text-2xl cursor-pointer text-gray-600" onClick={onClose}>&times;</button>
        </div>

        <div className="flex justify-center gap-5 mb-4 text-gray-600 text-sm">
          <div className="flex flex-col items-center gap-1">
            <span className="bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">1</span>
            <span>Open app on Phone</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">2</span>
            <span>Enter this code:</span>
          </div>
        </div>

        <div className="text-[42px] font-extrabold tracking-[4px] my-6 font-mono text-gray-900 bg-gray-100 p-4 rounded-xl select-all border-2 border-dashed border-gray-300">
          {code || <span>...</span>}
        </div>

        {connectedDevices.length > 0 ? (
          <div className="bg-emerald-50 p-4 rounded-xl mb-5 border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-600 font-bold mb-3 justify-center">
              <span className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse"></span>
              <span>Device Found!</span>
            </div>
            {connectedDevices.map((id, i) => (
              <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg shadow-sm">
                <span>📱 Device {id.substring(0, 4)}</span>
                <button className="bg-emerald-500 text-white border-none py-1.5 px-4 rounded-md font-semibold cursor-pointer" onClick={() => onAssign(id)}>Connect</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2.5 text-gray-600 mb-5 text-sm">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
            Listening for connection...
          </div>
        )}

        <button className="w-full py-3.5 bg-gray-100 text-gray-600 border-none rounded-xl font-semibold cursor-pointer transition-colors hover:bg-gray-200" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
})

export default CodePopup

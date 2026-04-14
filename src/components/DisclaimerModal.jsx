import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export default function DisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem('disclaimer_accepted')
    if (!accepted) {
      setIsOpen(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('disclaimer_accepted', 'true')
    setIsOpen(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-[#1e2128] border border-[#363b47] rounded-lg shadow-2xl p-6 max-w-lg w-full"
          >
            <div className="flex items-center gap-3 mb-4 text-[#eab308]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-lg font-semibold text-primary tracking-wide">Usage Disclaimer</h2>
            </div>

            <div className="space-y-5 text-base text-muted leading-relaxed">
              <ul className="list-disc pl-5 space-y-4">
                <li>
                  <strong className="text-primary font-medium">Follow Lab Instructions:</strong> Always check the lab's website or PI's page first. If they have specific rules for applying or aren't taking students, follow those instructions instead.
                </li>
                <li>
                  <strong className="text-primary font-medium">Do Not Spam:</strong> Please don't mass-email everyone in a lab. Only contact individuals whose research specifically aligns with yours.
                </li>
              </ul>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleAccept}
                className="px-5 py-2.5 bg-[#4d6dff] hover:bg-[#3d5df0] text-white text-xs uppercase tracking-wider font-medium rounded transition-colors shadow-[0_0_15px_rgba(77,109,255,0.2)] focus:outline-none focus:ring-2 focus:ring-[#4d6dff] focus:ring-offset-2 focus:ring-offset-[#1e2128]"
              >
                I Understand and Agree
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

import { useEffect, useDeferredValue, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useAppState } from './hooks/useAppState'
import { useAuth } from './hooks/useAuth'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import LabBrowser from './components/LabBrowser'
import CheckoutSidebar from './components/CheckoutSidebar'
import EmailModal from './components/EmailModal'

const KONAMI = 'admin'

function useAdminMode() {
  const [adminMode, setAdminMode] = useState(() => localStorage.getItem('admin_mode') === 'true')
  const bufferRef = useRef('')

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const next = (bufferRef.current + e.key.toLowerCase()).slice(-KONAMI.length)
      bufferRef.current = next
      if (next === KONAMI) {
        bufferRef.current = ''
        setAdminMode(m => {
          const toggled = !m
          if (toggled) localStorage.setItem('admin_mode', 'true')
          else localStorage.removeItem('admin_mode')
          return toggled
        })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return adminMode
}

export default function App() {
  const adminMode = useAdminMode()
  const { session, loading, signIn, signOut, getAccessToken } = useAuth()

  const {
    data,
    visibleLabs,
    visibleLabIds,
    selectedMemberIds,
    selectedMembers,
    roleFilter,
    setRoleFilter,
    emailModal,
    toggleLab,
    toggleVisibleLabs,
    toggleMember,
    toggleLabMembers,
    applyRoleSelection,
    clearSelection,
    openEmailModal,
    closeEmailModal,
    navigateModal,
  } = useAppState()

  const deferredVisibleLabs = useDeferredValue(visibleLabs)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(true)
  const [emailResults, setEmailResults] = useState({}) // memberId -> { ok, error, composed }
  const showCheckout = selectedMembers.length > 0
  const rightOffset = showCheckout ? (isCheckoutOpen ? '18.2rem' : '3.7rem') : '0'

  if (loading) return null

  return (
    <div className="relative min-h-screen grid-bg">
      <Navbar
        selectedCount={selectedMembers.length}
        rightOffset={rightOffset}
        user={adminMode ? (session?.user ?? null) : null}
        onSignOut={adminMode && session ? signOut : null}
        adminMode={adminMode}
        onSignIn={adminMode && !session ? signIn : null}
      />
      <Sidebar
        data={data}
        visibleLabIds={visibleLabIds}
        onToggleLab={toggleLab}
        onToggleVisibleLabs={toggleVisibleLabs}
      />
      <LabBrowser
        data={data}
        visibleLabs={deferredVisibleLabs}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        selectedMemberIds={selectedMemberIds}
        onToggleMember={toggleMember}
        onToggleLabMembers={toggleLabMembers}
        onEmail={openEmailModal}
        onApplyRoleSelection={applyRoleSelection}
        rightOffset={rightOffset}
        emailResults={emailResults}
      />
      <AnimatePresence>
        {showCheckout && (
          <CheckoutSidebar
            key="checkout"
            selectedMembers={selectedMembers}
            onRemove={toggleMember}
            onClearAll={clearSelection}
            onEmail={openEmailModal}
            onEmailAll={openEmailModal}
            isOpen={isCheckoutOpen}
            setIsOpen={setIsCheckoutOpen}
            emailResults={emailResults}
          />
        )}
      </AnimatePresence>
      <EmailModal
        modal={emailModal}
        onClose={closeEmailModal}
        onNavigate={navigateModal}
        session={adminMode ? session : null}
        getAccessToken={adminMode ? getAccessToken : null}
        emailResults={emailResults}
        setEmailResults={setEmailResults}
      />
    </div>
  )
}

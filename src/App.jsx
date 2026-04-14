import { useDeferredValue, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useAppState } from './hooks/useAppState'
import { useAuth } from './hooks/useAuth'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import LabBrowser from './components/LabBrowser'
import CheckoutSidebar from './components/CheckoutSidebar'
import EmailModal from './components/EmailModal'

export default function App() {
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
  const showCheckout = selectedMembers.length > 0
  const rightOffset = showCheckout ? (isCheckoutOpen ? '18.2rem' : '3.7rem') : '0'

  if (loading) return null

  return (
    <div className="relative min-h-screen grid-bg">
      <Navbar
        selectedCount={selectedMembers.length}
        rightOffset={rightOffset}
        user={session?.user ?? null}
        onSignOut={session ? signOut : null}
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
      />
      <AnimatePresence>
        {showCheckout && (
          <CheckoutSidebar
            key="checkout"
            selectedMembers={selectedMembers}
            onRemove={toggleMember}
            onEmail={openEmailModal}
            onEmailAll={openEmailModal}
            isOpen={isCheckoutOpen}
            setIsOpen={setIsCheckoutOpen}
          />
        )}
      </AnimatePresence>
      <EmailModal
        modal={emailModal}
        onClose={closeEmailModal}
        onNavigate={navigateModal}
        session={session}
        signIn={signIn}
        getAccessToken={getAccessToken}
      />
    </div>
  )
}

import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useAppState } from './hooks/useAppState'
import AsciiBackground from './components/AsciiBackground'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import LabBrowser from './components/LabBrowser'
import CheckoutSidebar from './components/CheckoutSidebar'
import EmailModal from './components/EmailModal'

export default function App() {
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
    updateDraft,
    navigateModal,
  } = useAppState()

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(true)
  const showCheckout = selectedMembers.length > 0
  const rightOffset = showCheckout ? (isCheckoutOpen ? '18.2rem' : '3.7rem') : '0'

  return (
    <div className="relative min-h-screen grid-bg">
      {/* <AsciiBackground /> */}
      <Navbar selectedCount={selectedMembers.length} rightOffset={rightOffset} />
      <Sidebar 
        data={data} 
        visibleLabIds={visibleLabIds} 
        onToggleLab={toggleLab} 
        onToggleVisibleLabs={toggleVisibleLabs} 
      />
      <LabBrowser
        data={data}
        visibleLabs={visibleLabs}
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
        onUpdateDraft={updateDraft}
        onNavigate={navigateModal}
      />
    </div>
  )
}

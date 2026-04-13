import { useState } from 'react'
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
    toggleMember,
    applyRoleSelection,
    clearSelection,
    openEmailModal,
    closeEmailModal,
    updateDraft,
    navigateModal,
  } = useAppState()

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(true)
  const showCheckout = selectedMembers.length > 0
  const rightOffset = showCheckout ? (isCheckoutOpen ? '20rem' : '4rem') : '0'

  return (
    <div className="relative min-h-screen" style={{ background: '#f7f8fa' }}>
      <AsciiBackground />
      <Navbar selectedCount={selectedMembers.length} />
      <Sidebar data={data} visibleLabIds={visibleLabIds} onToggleLab={toggleLab} />
      <LabBrowser
        data={data}
        visibleLabs={visibleLabs}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        selectedMemberIds={selectedMemberIds}
        onToggleMember={toggleMember}
        onEmail={openEmailModal}
        onApplyRoleSelection={applyRoleSelection}
        rightOffset={rightOffset}
      />
      {showCheckout && (
        <CheckoutSidebar
          selectedMembers={selectedMembers}
          onRemove={toggleMember}
          onEmail={openEmailModal}
          onEmailAll={openEmailModal}
          isOpen={isCheckoutOpen}
          setIsOpen={setIsCheckoutOpen}
        />
      )}
      <EmailModal
        modal={emailModal}
        onClose={closeEmailModal}
        onUpdateDraft={updateDraft}
        onNavigate={navigateModal}
      />
    </div>
  )
}

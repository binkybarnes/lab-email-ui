import { useAppState } from './hooks/useAppState'
import AsciiBackground from './components/AsciiBackground'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import LabBrowser from './components/LabBrowser'
import StickyActionBar from './components/StickyActionBar'
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

  return (
    <div className="relative min-h-screen grid-bg">
      {/* <AsciiBackground /> */}
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
      />
      <StickyActionBar
        selectedMembers={selectedMembers}
        onEmailSelected={openEmailModal}
        onClear={clearSelection}
      />
      <EmailModal
        modal={emailModal}
        onClose={closeEmailModal}
        onUpdateDraft={updateDraft}
        onNavigate={navigateModal}
      />
    </div>
  )
}

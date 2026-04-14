import { useState, useCallback, useMemo } from 'react'
import data from '../data/labs.json'
import { toggleSetItem, areAllSelected } from '../utils/selection'

const allLabsStatic = data.departments.flatMap(d =>
  d.labs.map(l => ({ ...l, departmentId: d.id, departmentName: d.name }))
)

function buildInitialDrafts(members) {
  return Object.fromEntries(members.map(m => [m.id, { subject: '', body: '', toOverride: '' }]))
}

export function useAppState() {
  const [visibleLabIds, setVisibleLabIds] = useState(new Set(allLabsStatic.map(l => l.id)))
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set())
  const [roleFilter, setRoleFilter] = useState('all')
  const [emailModal, setEmailModal] = useState({
    open: false,
    members: [],
    currentIndex: 0,
    drafts: {},
  })

  const allLabs = useMemo(() => allLabsStatic, [])

  const allMembers = useMemo(() => allLabs.flatMap(l => 
    l.members.map(m => ({ ...m, labName: l.name, labId: l.id }))
  ), [allLabs])

  const visibleLabs = useMemo(() => {
    return allLabs.filter(l => visibleLabIds.has(l.id))
  }, [allLabs, visibleLabIds])

  const visibleMembers = useMemo(() => {
    const members = visibleLabs.flatMap(l => l.members)
    if (roleFilter === 'all') return members
    return members.filter(m => m.role === roleFilter)
  }, [visibleLabs, roleFilter])

  const selectedMembers = useMemo(() =>
    allMembers.filter(m => selectedMemberIds.has(m.id)),
    [allMembers, selectedMemberIds])

  const toggleLab = useCallback((labId) => {
    setVisibleLabIds(prev => toggleSetItem(prev, labId))
  }, [])

  const toggleVisibleLabs = useCallback((labIds) => {
    setVisibleLabIds(prev => {
      const allSelected = labIds.length > 0 && labIds.every(id => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        labIds.forEach(id => next.delete(id))
      } else {
        labIds.forEach(id => next.add(id))
      }
      return next
    })
  }, [])

  const toggleMember = useCallback((memberId) => {
    setSelectedMemberIds(prev => toggleSetItem(prev, memberId))
  }, [])

  const applyRoleSelection = useCallback((role) => {
    const targets = role === 'all'
      ? visibleMembers
      : visibleMembers.filter(m => m.role === role)
    setSelectedMemberIds(prev => {
      const allSelected = areAllSelected(targets, prev)
      const next = new Set(prev)
      if (allSelected) targets.forEach(m => next.delete(m.id))
      else targets.forEach(m => next.add(m.id))
      return next
    })
  }, [visibleMembers])

  const toggleLabMembers = useCallback((memberIds) => {
    setSelectedMemberIds(prev => {
      const allSelected = memberIds.every(id => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        memberIds.forEach(id => next.delete(id))
      } else {
        memberIds.forEach(id => next.add(id))
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedMemberIds(new Set()), [])

  const openEmailModal = useCallback((members) => {
    setEmailModal({ open: true, members, currentIndex: 0, drafts: buildInitialDrafts(members) })
  }, [])

  const closeEmailModal = useCallback(() => {
    setEmailModal(prev => ({ ...prev, open: false }))
  }, [])

  const updateDraft = useCallback((memberId, field, value) => {
    setEmailModal(prev => ({
      ...prev,
      drafts: { ...prev.drafts, [memberId]: { ...prev.drafts[memberId], [field]: value } },
    }))
  }, [])

  const navigateModal = useCallback((direction) => {
    setEmailModal(prev => ({
      ...prev,
      currentIndex: Math.max(0, Math.min(prev.members.length - 1, prev.currentIndex + direction)),
    }))
  }, [])

  return {
    data,
    allLabs,
    visibleLabIds,
    visibleLabs,
    visibleMembers,
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
  }
}

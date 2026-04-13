import { useState, useCallback, useMemo } from 'react'
import data from '../data/labs.json'
import { toggleSetItem } from '../utils/selection'

function buildInitialDrafts(members) {
  return Object.fromEntries(members.map(m => [m.id, { subject: '', body: '' }]))
}

export function useAppState() {
  const [visibleLabIds, setVisibleLabIds] = useState(new Set())
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set())
  const [roleFilter, setRoleFilter] = useState('all')
  const [emailModal, setEmailModal] = useState({
    open: false,
    members: [],
    currentIndex: 0,
    drafts: {},
  })

  const allLabs = useMemo(() =>
    data.departments.flatMap(d =>
      d.labs.map(l => ({ ...l, departmentId: d.id, departmentName: d.name }))
    ), [])

  const allMembers = useMemo(() => allLabs.flatMap(l => l.members), [allLabs])

  const visibleLabs = useMemo(() => {
    if (visibleLabIds.size === 0) return allLabs
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

  const toggleMember = useCallback((memberId) => {
    setSelectedMemberIds(prev => toggleSetItem(prev, memberId))
  }, [])

  const applyRoleSelection = useCallback((role) => {
    const targets = role === 'all'
      ? visibleMembers
      : visibleMembers.filter(m => m.role === role)
    const allSelected = targets.length > 0 && targets.every(m => selectedMemberIds.has(m.id))
    setSelectedMemberIds(prev => {
      const next = new Set(prev)
      if (allSelected) targets.forEach(m => next.delete(m.id))
      else targets.forEach(m => next.add(m.id))
      return next
    })
  }, [visibleMembers, selectedMemberIds])

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
    toggleMember,
    applyRoleSelection,
    clearSelection,
    openEmailModal,
    closeEmailModal,
    updateDraft,
    navigateModal,
  }
}

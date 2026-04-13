export function toggleSetItem(set, item) {
  const next = new Set(set)
  if (next.has(item)) next.delete(item)
  else next.add(item)
  return next
}

export function areAllSelected(items, selectedIds) {
  if (items.length === 0) return false
  return items.every(item => selectedIds.has(item.id))
}

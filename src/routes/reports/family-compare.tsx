import { useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { FamilyComparison } from '@/components/reports/family-comparison'
import { PeriodKindToggle, PeriodNavigator } from '@/components/reports/period-navigator'
import { periodRange, type PeriodKind } from '@/components/reports/period'
import { todayISO } from '@/lib/dates'

const KINDS: readonly PeriodKind[] = ['day', 'week', 'month']

/** /family/compare — compare shared, compatible metrics between family members. */
export default function FamilyComparePage() {
  const today = todayISO()
  const [kind, setKind] = useState<PeriodKind>('week')
  const [anchor, setAnchor] = useState(today)

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="Compare" subtitle="Shared habits, side by side" back="/family" />
      <PeriodKindToggle value={kind} options={KINDS} onChange={setKind} label="Comparison period" />
      <PeriodNavigator kind={kind} anchor={anchor} today={today} onChange={setAnchor} />
      <FamilyComparison range={periodRange(kind, anchor)} />
    </div>
  )
}

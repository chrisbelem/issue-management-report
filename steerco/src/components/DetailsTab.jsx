import LateIssues  from './LateIssues'
import CriticalAPs from './CriticalAPs'
import MORKPIs     from './MORKPIs'
import AISummary   from './AISummary'

export default function DetailsTab({ issues, aps, generatedAt }) {
  const lateIssues      = issues.filter(i => i.status === 'Late')
  const lateAPs         = aps.filter(a => a.ap_status === 'Late')
  const pendingValLate  = aps.filter(a => a.ap_status === 'Pending Validation (late)')
  const pendingApprLate = aps.filter(a => a.ap_status === 'Pending Approval (late)')
  const pendingVal      = aps.filter(a => a.ap_status === 'Pending Validation')
  const pendingAppr     = aps.filter(a => a.ap_status === 'Pending Approval')

  return (
    <div>
      <LateIssues issues={lateIssues} />
      <CriticalAPs
        lateAPs={lateAPs}
        pendingValLate={pendingValLate}
        pendingApprLate={pendingApprLate}
        pendingVal={pendingVal}
        pendingAppr={pendingAppr}
      />
      <MORKPIs issues={issues} aps={aps} />
      <AISummary
        issues={issues} aps={aps}
        lateIssues={lateIssues} lateAPs={lateAPs}
        pendingValLate={pendingValLate} pendingApprLate={pendingApprLate}
        generatedAt={generatedAt}
      />
    </div>
  )
}

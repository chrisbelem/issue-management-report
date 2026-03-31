import LateIssues, { LatePotentialIssues } from './LateIssues'
import CriticalAPs from './CriticalAPs'
import MORKPIs     from './MORKPIs'

export default function DetailsTab({ issues, aps, ttr }) {
  const lateIssues      = issues.filter(i => i.status === 'Late' && i.Type === 'Issue')
  const latePotential   = issues.filter(i => i.status === 'Late' && i.Type === 'Potential Issue')
  const lateAPs         = aps.filter(a => a.ap_status === 'Late')
  const pendingValLate  = aps.filter(a => a.ap_status === 'Pending Validation (late)')
  const pendingApprLate = aps.filter(a => a.ap_status === 'Pending Approval (late)')
  const pendingVal      = aps.filter(a => a.ap_status === 'Pending Validation')
  const pendingAppr     = aps.filter(a => a.ap_status === 'Pending Approval')

  return (
    <div>
      <LateIssues issues={lateIssues} />
      <LatePotentialIssues issues={latePotential} />
      <CriticalAPs
        lateAPs={lateAPs}
        pendingValLate={pendingValLate}
        pendingApprLate={pendingApprLate}
        pendingVal={pendingVal}
        pendingAppr={pendingAppr}
      />
      <MORKPIs issues={issues} aps={aps} ttr={ttr} />
    </div>
  )
}

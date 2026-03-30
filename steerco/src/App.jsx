import { useState, useEffect } from 'react'
import Header from './components/Header'
import KPICards from './components/KPICards'
import LateIssues from './components/LateIssues'
import CriticalAPs from './components/CriticalAPs'
import MORKPIs from './components/MORKPIs'
import AISummary from './components/AISummary'

function parseCSV(text) {
  if (!text?.trim()) return []
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    const row = {}
    headers.forEach((h, i) => {
      let v = (vals[i] || '').trim()
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      row[h] = v
    })
    return row
  })
}

export default function App() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/data.json')
      .then(r => r.json())
      .then(setData)
      .catch(() => {
        // fallback: try to parse from embedded CSV (for local dev)
        setData({ error: 'data.json not found — run generate_report.py first' })
      })
  }, [])

  if (!data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:48, height:48, border:'3px solid #8A05BE', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
        <p style={{ color:'#888899' }}>Loading dashboard…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (data.error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#FF4455' }}>
      {data.error}
    </div>
  )

  const issues = parseCSV(data.issues_csv)
  const aps    = parseCSV(data.aps_csv)

  const lateStatuses    = new Set(['Late', 'Pending Approval (late)', 'Pending Validation (late)'])
  const lateIssues      = issues.filter(i => i.status === 'Late')
  const lateAPs         = aps.filter(a => a.ap_status === 'Late')
  const pendingValLate  = aps.filter(a => a.ap_status === 'Pending Validation (late)')
  const pendingApprLate = aps.filter(a => a.ap_status === 'Pending Approval (late)')
  const pendingVal      = aps.filter(a => a.ap_status === 'Pending Validation')
  const pendingAppr     = aps.filter(a => a.ap_status === 'Pending Approval')

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 64px' }}>
      <Header generatedAt={data.generated_at} />

      <KPICards
        totalIssues={issues.length}
        lateIssues={lateIssues.length}
        totalAPs={aps.length}
        lateAPs={lateAPs.length}
        pendingLate={pendingValLate.length + pendingApprLate.length}
      />

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
        issues={issues}
        aps={aps}
        lateIssues={lateIssues}
        lateAPs={lateAPs}
        pendingValLate={pendingValLate}
        pendingApprLate={pendingApprLate}
        generatedAt={data.generated_at}
      />
    </div>
  )
}

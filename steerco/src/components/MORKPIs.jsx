function Gauge({ value, target, label, unit = '%', invert = false }) {
  const pct = Math.min((value / Math.max(target * 1.5, 1)) * 100, 100)
  const ok = invert ? value <= target : value >= target
  const color = ok ? '#007A57' : '#D48000'
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', flex: '1 1 200px', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 11, color: '#6B6B80', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color }}>{typeof value === 'number' ? value.toFixed(1) : value}</span>
        <span style={{ fontSize: 18, color, marginBottom: 4 }}>{unit}</span>
      </div>
      <div style={{ height: 8, background: '#F0EDF5', borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 1s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: '#6B6B80' }}>Target: {target}{unit} · <span style={{ color, fontWeight: 600 }}>{ok ? '✓ On target' : '⚠ Off target'}</span></div>
    </div>
  )
}

export default function MORKPIs({ issues, aps }) {
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const recent = issues.filter(i => {
    const d = new Date(i.created_at)
    return d >= sixMonthsAgo && i.origin !== 'NP&F+ Assessments' && i.origin !== 'Defense Assessment'
  })
  const selfId = recent.length ? (recent.filter(i => i.origin === 'Self-Identified').length / recent.length) * 100 : 0
  const lateHighAPs = aps.filter(a => a.ap_status === 'Late' && ['High', 'Very High'].includes(a['issue rating']))
  const byStatus = issues.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc }, {})

  const statusColor = s => s === 'Late' ? '#E0002A' : s === 'TBD' ? '#D48000' : '#007A57'

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>📊</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>MOR KPIs</h2>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <Gauge value={selfId} target={60} label="Self-Identified Issues (6mo)" />
        <Gauge value={lateHighAPs.length} target={0} label="Late High / Very High APs" unit="" invert />
      </div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B6B80', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Issues by Status</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(byStatus).sort((a,b) => b[1]-a[1]).map(([status, count]) => {
            const c = statusColor(status)
            return (
              <div key={status} style={{
                background: c + '10', border: `1px solid ${c}33`,
                borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: c }}>{count}</span>
                <span style={{ fontSize: 12, color: '#1A1A2E' }}>{status}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

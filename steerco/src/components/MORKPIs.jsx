function Gauge({ value, target, label, unit = '%', invert = false }) {
  const pct = Math.min((value / (target * 1.5)) * 100, 100)
  const ok = invert ? value <= target : value >= target
  const color = ok ? '#00C48C' : value > 0 ? '#FFB800' : '#FF4455'
  return (
    <div style={{ background: '#111116', borderRadius: 14, padding: '20px 24px', flex: '1 1 200px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 11, color: '#888899', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color }}>{typeof value === 'number' ? value.toFixed(1) : value}</span>
        <span style={{ fontSize: 18, color, marginBottom: 4 }}>{unit}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 1s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: '#888899' }}>Target: {target}{unit} · <span style={{ color }}>{ok ? '✓ On target' : '⚠ Off target'}</span></div>
    </div>
  )
}

export default function MORKPIs({ issues, aps }) {
  // % Self-Identified (last 6 months, excl NP&F Assessment)
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const recent = issues.filter(i => {
    const d = new Date(i.created_at)
    return d >= sixMonthsAgo && i.origin !== 'NP&F+ Assessments' && i.origin !== 'Defense Assessment'
  })
  const selfId = recent.length ? (recent.filter(i => i.origin === 'Self-Identified').length / recent.length) * 100 : 0

  // Late H/VH APs
  const lateHighAPs = aps.filter(a => a.ap_status === 'Late' && ['High', 'Very High'].includes(a['issue rating']))

  // Issues by status
  const byStatus = issues.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc }, {})

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>📊</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>MOR KPIs</h2>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <Gauge value={selfId} target={60} label="Self-Identified Issues (6mo)" />
        <Gauge value={lateHighAPs.length} target={0} label="Late High / Very High APs" unit="" invert />
      </div>

      {/* Issues by status breakdown */}
      <div style={{ background: '#111116', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888899', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Issues by Status</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(byStatus).sort((a,b) => b[1]-a[1]).map(([status, count]) => {
            const color = status === 'Late' ? '#FF4455' : status === 'TBD' ? '#FFB800' : '#00C48C'
            return (
              <div key={status} style={{
                background: color + '15', border: `1px solid ${color}33`,
                borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 20, fontWeight: 800, color }}>{count}</span>
                <span style={{ fontSize: 12, color: '#ccc' }}>{status}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

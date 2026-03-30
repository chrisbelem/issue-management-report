import { useEffect, useState } from 'react'

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const step = () => {
      start += Math.ceil((value - start) / 6)
      setDisplay(start)
      if (start < value) requestAnimationFrame(step)
      else setDisplay(value)
    }
    requestAnimationFrame(step)
  }, [value])
  return display
}

function KPI({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${color}33`,
      borderRadius: 16,
      padding: '24px 28px',
      flex: '1 1 160px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: color,
        borderRadius: '16px 16px 0 0',
      }} />
      <div style={{ fontSize: 44, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>
        <AnimatedNumber value={value} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#6B6B80' }}>{sub}</div>}
    </div>
  )
}

export default function KPICards({ totalIssues, lateIssues, totalAPs, lateAPs, pendingLate }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KPI label="Total Issues" value={totalIssues} sub="Active (excl. terminal)" color="#8A05BE" />
        <KPI label="Late Issues" value={lateIssues} sub="Breach max due date" color="#E0002A" />
        <KPI label="Total Action Plans" value={totalAPs} sub="Active" color="#8A05BE" />
        <KPI label="Late APs" value={lateAPs} sub="Overdue" color="#E0002A" />
        <KPI label="Pending (Late)" value={pendingLate} sub="Approval or Validation" color="#D48000" />
      </div>
    </section>
  )
}

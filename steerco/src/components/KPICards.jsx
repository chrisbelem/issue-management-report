import { useEffect, useRef, useState } from 'react'

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

function KPI({ label, value, sub, color, bg }) {
  return (
    <div style={{
      background: bg || '#111116',
      border: `1px solid ${color}33`,
      borderRadius: 16,
      padding: '24px 28px',
      flex: '1 1 160px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${color}, transparent)`,
      }} />
      <div style={{ fontSize: 42, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>
        <AnimatedNumber value={value} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#888899' }}>{sub}</div>}
    </div>
  )
}

export default function KPICards({ totalIssues, lateIssues, totalAPs, lateAPs, pendingLate }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KPI label="Total Issues" value={totalIssues} sub="Active (excl. terminal)" color="#B649FF" />
        <KPI label="Late Issues" value={lateIssues} sub="Breach max due date" color="#FF4455" />
        <KPI label="Total Action Plans" value={totalAPs} sub="Active" color="#B649FF" />
        <KPI label="Late APs" value={lateAPs} sub="Overdue" color="#FF4455" />
        <KPI label="Pending (Late)" value={pendingLate} sub="Approval or Validation" color="#FFB800" />
      </div>
    </section>
  )
}

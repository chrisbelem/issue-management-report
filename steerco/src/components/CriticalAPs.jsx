const STATUS_META = {
  'Late':                      { color: '#E0002A', label: 'Late',                      icon: '🔴' },
  'Pending Validation (late)': { color: '#D48000', label: 'Pending Validation (late)', icon: '⏳' },
  'Pending Approval (late)':   { color: '#D48000', label: 'Pending Approval (late)',   icon: '⏳' },
  'Pending Validation':        { color: '#1A6FCC', label: 'Pending Validation',        icon: '🔵' },
  'Pending Approval':          { color: '#1A6FCC', label: 'Pending Approval',          icon: '🔵' },
}

function APCard({ ap }) {
  const meta = STATUS_META[ap.ap_status] || { color: '#888', label: ap.ap_status, icon: '⚪' }
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${meta.color}33`,
      borderLeft: `4px solid ${meta.color}`,
      borderRadius: 12,
      padding: '14px 18px',
      display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ minWidth: 110 }}>
        <a href={ap.ap_link_projac} target="_blank" rel="noreferrer"
          style={{ color: '#8A05BE', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
          {ap.ap_code}
        </a>
        <div style={{ fontSize: 11, color: '#6B6B80', marginTop: 2 }}>
          <a href={ap.issue_link_projac} target="_blank" rel="noreferrer" style={{ color: '#6B6B80', textDecoration: 'none' }}>
            {ap['Issue Code']}
          </a>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#1A1A2E' }}>{ap.ap_summary}</div>
        <span style={{
          background: meta.color + '15', color: meta.color,
          border: `1px solid ${meta.color}44`,
          borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600,
        }}>{meta.icon} {meta.label}</span>
      </div>
      <div style={{ textAlign: 'right', minWidth: 110 }}>
        <div style={{ fontSize: 11, color: '#6B6B80' }}>Action Owner</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#D48000' }}>{ap['Action Owner'] || '—'}</div>
        <div style={{ fontSize: 11, color: '#6B6B80', marginTop: 4 }}>Due: {ap.ap_due_date_at?.slice(0,10) || '—'}</div>
      </div>
    </div>
  )
}

function Group({ title, icon, items, color }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{title}</span>
        <span style={{
          background: color + '15', color, border: `1px solid ${color}44`,
          borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700,
        }}>{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(ap => <APCard key={ap.ap_code} ap={ap} />)}
      </div>
    </div>
  )
}

export default function CriticalAPs({ lateAPs, pendingValLate, pendingApprLate, pendingVal, pendingAppr }) {
  const total = lateAPs.length + pendingValLate.length + pendingApprLate.length + pendingVal.length + pendingAppr.length
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Action Plans — Attention Required</h2>
        <span style={{
          background: '#D4800015', color: '#D48000', border: '1px solid #D4800044',
          borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
        }}>{total}</span>
      </div>
      {total === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6B6B80', border: '1px solid #E0F5EE', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          All action plans on track 🎉
        </div>
      ) : (
        <>
          <Group title="Late" icon="🔴" items={lateAPs} color="#E0002A" />
          <Group title="Pending Validation (late)" icon="⏳" items={pendingValLate} color="#D48000" />
          <Group title="Pending Approval (late)" icon="⏳" items={pendingApprLate} color="#D48000" />
          <Group title="Pending Validation" icon="🔵" items={pendingVal} color="#1A6FCC" />
          <Group title="Pending Approval" icon="🔵" items={pendingAppr} color="#1A6FCC" />
        </>
      )}
    </section>
  )
}

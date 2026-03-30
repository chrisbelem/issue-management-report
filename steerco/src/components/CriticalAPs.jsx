const STATUS_META = {
  'Late':                      { color: '#FF4455', label: 'Late',                   icon: '🔴' },
  'Pending Validation (late)': { color: '#FFB800', label: 'Pending Validation (late)', icon: '⏳' },
  'Pending Approval (late)':   { color: '#FFB800', label: 'Pending Approval (late)',   icon: '⏳' },
  'Pending Validation':        { color: '#4499FF', label: 'Pending Validation',     icon: '🔵' },
  'Pending Approval':          { color: '#4499FF', label: 'Pending Approval',       icon: '🔵' },
}

function APCard({ ap }) {
  const meta = STATUS_META[ap.ap_status] || { color: '#888', label: ap.ap_status, icon: '⚪' }
  return (
    <div style={{
      background: '#111116',
      border: `1px solid ${meta.color}33`,
      borderLeft: `4px solid ${meta.color}`,
      borderRadius: 12,
      padding: '14px 18px',
      display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 110 }}>
        <a href={ap.ap_link_projac} target="_blank" rel="noreferrer"
          style={{ color: '#B649FF', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
          {ap.ap_code}
        </a>
        <div style={{ fontSize: 11, color: '#888899', marginTop: 2 }}>
          <a href={ap.issue_link_projac} target="_blank" rel="noreferrer" style={{ color: '#888899', textDecoration: 'none' }}>
            {ap['Issue Code']}
          </a>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{ap.ap_summary}</div>
        <span style={{
          background: meta.color + '22', color: meta.color,
          border: `1px solid ${meta.color}55`,
          borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600,
        }}>{meta.icon} {meta.label}</span>
      </div>
      <div style={{ textAlign: 'right', minWidth: 110 }}>
        <div style={{ fontSize: 11, color: '#888899' }}>Action Owner</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#FFB800' }}>{ap['Action Owner'] || '—'}</div>
        <div style={{ fontSize: 11, color: '#888899', marginTop: 4 }}>Due: {ap.ap_due_date_at?.slice(0,10) || '—'}</div>
      </div>
    </div>
  )
}

function Group({ title, icon, items, color }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{title}</span>
        <span style={{
          background: color + '22', color, border: `1px solid ${color}55`,
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
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Action Plans — Attention Required</h2>
        <span style={{
          background: '#FFB80022', color: '#FFB800', border: '1px solid #FFB80055',
          borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
        }}>{total}</span>
      </div>
      {total === 0 ? (
        <div style={{ background: '#111116', borderRadius: 12, padding: 32, textAlign: 'center', color: '#888899', border: '1px solid rgba(0,196,140,0.2)' }}>
          All action plans on track 🎉
        </div>
      ) : (
        <>
          <Group title="Late" icon="🔴" items={lateAPs} color="#FF4455" />
          <Group title="Pending Validation (late)" icon="⏳" items={pendingValLate} color="#FFB800" />
          <Group title="Pending Approval (late)" icon="⏳" items={pendingApprLate} color="#FFB800" />
          <Group title="Pending Validation" icon="🔵" items={pendingVal} color="#4499FF" />
          <Group title="Pending Approval" icon="🔵" items={pendingAppr} color="#4499FF" />
        </>
      )}
    </section>
  )
}

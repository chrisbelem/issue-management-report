const RATING_COLOR = { High: '#FF4455', 'Very High': '#FF2233', Medium: '#FFB800', Low: '#4499FF' }

function Badge({ text, color }) {
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}55`,
      borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600,
    }}>{text}</span>
  )
}

export default function LateIssues({ issues }) {
  if (!issues.length) return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="✅" label="Late Issues" count={0} color="#00C48C" />
      <div style={{ background: '#111116', borderRadius: 12, padding: 32, textAlign: 'center', color: '#888899', border: '1px solid rgba(0,196,140,0.2)' }}>
        No late issues 🎉
      </div>
    </section>
  )

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="🔴" label="Late Issues" count={issues.length} color="#FF4455" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {issues.map(issue => (
          <div key={issue.code} style={{
            background: '#111116',
            border: '1px solid rgba(255,68,85,0.2)',
            borderLeft: '4px solid #FF4455',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap',
          }}>
            <div style={{ minWidth: 120 }}>
              <a href={issue.projac_link} target="_blank" rel="noreferrer"
                style={{ color: '#B649FF', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                {issue.code}
              </a>
              {issue['NP&F+'] && issue['NP&F+'] !== '-' && (
                <a href={issue['NP&F+']} target="_blank" rel="noreferrer"
                  style={{ display: 'block', color: '#888899', fontSize: 11, marginTop: 2, textDecoration: 'none' }}>
                  {issue.key || 'NP&F+'}
                </a>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 6 }}>{issue.summary}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge text={issue.overall_risk_rating} color={RATING_COLOR[issue.overall_risk_rating] || '#888'} />
                <Badge text={issue['Business Area'] || 'N/A'} color="#4499FF" />
                <Badge text={issue.countries?.replace(/[\[\]"]/g, '')} color="#888899" />
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 120 }}>
              <div style={{ fontSize: 11, color: '#888899' }}>Action Owner</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#FFB800' }}>{issue['Action Owner'] || '—'}</div>
              <div style={{ fontSize: 11, color: '#888899', marginTop: 4 }}>Due: {issue.due_date_at?.slice(0,10) || '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionTitle({ icon, label, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{label}</h2>
      <span style={{
        background: color + '22', color, border: `1px solid ${color}55`,
        borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
      }}>{count}</span>
    </div>
  )
}

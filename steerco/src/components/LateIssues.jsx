const RATING_COLOR = { 'Very High': '#9B0020', High: '#E0002A', Medium: '#D48000', Low: '#1A6FCC' }

function Badge({ text, color }) {
  return (
    <span style={{
      background: color + '15', color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600,
    }}>{text}</span>
  )
}

function IssueCard({ issue, borderColor }) {
  const npfKey = issue['NP&F+'] && issue['NP&F+'] !== '-' ? issue['NP&F+'] : null
  const desc   = issue.description?.trim()

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${borderColor}33`,
      borderLeft: `4px solid ${borderColor}`,
      borderRadius: 12,
      padding: '16px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 130 }}>
          <a href={issue.projac_link} target="_blank" rel="noreferrer"
            style={{ color: '#8A05BE', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            {issue.code}
          </a>
          {npfKey && (
            <a href={npfKey} target="_blank" rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
                background: '#FF6B0015', color: '#B84500',
                border: '1px solid #FF6B0044', borderRadius: 6,
                padding: '2px 8px', fontSize: 11, fontWeight: 600, textDecoration: 'none',
              }}>
              🔗 {issue.key || 'NP&F+ Jira'}
            </a>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#1A1A2E' }}>
            {issue.summary}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge text={issue.overall_risk_rating} color={RATING_COLOR[issue.overall_risk_rating] || '#888'} />
            <Badge text={issue['Business Area'] || 'N/A'} color="#1A6FCC" />
            <Badge text={issue.countries?.replace(/[\[\]"]/g, '')} color="#6B6B80" />
          </div>
        </div>

        <div style={{ textAlign: 'right', minWidth: 130 }}>
          <div style={{ fontSize: 11, color: '#6B6B80' }}>Action Owner</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#D48000' }}>{issue['Action Owner'] || '—'}</div>
          <div style={{ fontSize: 11, color: '#6B6B80', marginTop: 4 }}>Due: {issue.due_date_at?.slice(0,10) || '—'}</div>
        </div>
      </div>

      {desc && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: '#F8F7FB', borderRadius: 8,
          fontSize: 12, color: '#4A4A60', lineHeight: 1.6,
          borderLeft: '3px solid #8A05BE33',
        }}>
          {desc.length > 400 ? desc.slice(0, 400) + '…' : desc}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ icon, label, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{label}</h2>
      <span style={{
        background: color + '15', color, border: `1px solid ${color}44`,
        borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
      }}>{count}</span>
    </div>
  )
}

export default function LateIssues({ issues }) {
  if (!issues.length) return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="✅" label="Late Issues" count={0} color="#007A57" />
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6B6B80', border: '1px solid #E0F5EE' }}>
        No late issues 🎉
      </div>
    </section>
  )
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="🔴" label="Late Issues" count={issues.length} color="#E0002A" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {issues.map(i => <IssueCard key={i.code} issue={i} borderColor="#E0002A" />)}
      </div>
    </section>
  )
}

export function LatePotentialIssues({ issues }) {
  if (!issues.length) return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="✅" label="Late Potential Issues" count={0} color="#007A57" />
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6B6B80', border: '1px solid #E0F5EE' }}>
        No late potential issues 🎉
      </div>
    </section>
  )
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="⚠️" label="Late Potential Issues" count={issues.length} color="#D48000" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {issues.map(i => <IssueCard key={i.code} issue={i} borderColor="#D48000" />)}
      </div>
    </section>
  )
}

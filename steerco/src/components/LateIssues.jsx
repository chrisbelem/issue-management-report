const RATING_COLOR = { 'Very High': '#9B0020', High: '#E0002A', Medium: '#D48000', Low: '#1A6FCC' }

function Badge({ text, color }) {
  return (
    <span style={{
      background: color + '15', color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600,
    }}>{text}</span>
  )
}

export default function LateIssues({ issues }) {
  if (!issues.length) return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="✅" label="Late Issues" count={0} color="#007A57" />
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6B6B80', border: '1px solid #E0F5EE', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        No late issues 🎉
      </div>
    </section>
  )

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="🔴" label="Late Issues" count={issues.length} color="#E0002A" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {issues.map(issue => (
          <div key={issue.code} style={{
            background: '#fff',
            border: '1px solid #F5C0C8',
            borderLeft: '4px solid #E0002A',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ minWidth: 120 }}>
              <a href={issue.projac_link} target="_blank" rel="noreferrer"
                style={{ color: '#8A05BE', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                {issue.code}
              </a>
              {issue['NP&F+'] && issue['NP&F+'] !== '-' && (
                <a href={issue['NP&F+']} target="_blank" rel="noreferrer"
                  style={{ display: 'block', color: '#6B6B80', fontSize: 11, marginTop: 2, textDecoration: 'none' }}>
                  {issue.key || 'NP&F+'}
                </a>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 6, color: '#1A1A2E' }}>{issue.summary}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge text={issue.overall_risk_rating} color={RATING_COLOR[issue.overall_risk_rating] || '#888'} />
                <Badge text={issue['Business Area'] || 'N/A'} color="#1A6FCC" />
                <Badge text={issue.countries?.replace(/[\[\]"]/g, '')} color="#6B6B80" />
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 120 }}>
              <div style={{ fontSize: 11, color: '#6B6B80' }}>Action Owner</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D48000' }}>{issue['Action Owner'] || '—'}</div>
              <div style={{ fontSize: 11, color: '#6B6B80', marginTop: 4 }}>Due: {issue.due_date_at?.slice(0,10) || '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function LatePotentialIssues({ issues }) {
  if (!issues.length) return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="✅" label="Late Potential Issues" count={0} color="#007A57" />
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6B6B80', border: '1px solid #E0F5EE', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        No late potential issues 🎉
      </div>
    </section>
  )

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle icon="⚠️" label="Late Potential Issues" count={issues.length} color="#D48000" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {issues.map(issue => (
          <div key={issue.code} style={{
            background: '#fff',
            border: '1px solid #F5DFA0',
            borderLeft: '4px solid #D48000',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ minWidth: 120 }}>
              <a href={issue.projac_link} target="_blank" rel="noreferrer"
                style={{ color: '#8A05BE', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                {issue.code}
              </a>
              {issue['NP&F+'] && issue['NP&F+'] !== '-' && (
                <a href={issue['NP&F+']} target="_blank" rel="noreferrer"
                  style={{ display: 'block', color: '#6B6B80', fontSize: 11, marginTop: 2, textDecoration: 'none' }}>
                  {issue.key || 'NP&F+'}
                </a>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 6, color: '#1A1A2E' }}>{issue.summary}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge text={issue.overall_risk_rating} color={RATING_COLOR[issue.overall_risk_rating] || '#888'} />
                <Badge text={issue['Business Area'] || 'N/A'} color="#1A6FCC" />
                <Badge text={issue.countries?.replace(/[\[\]"]/g, '')} color="#6B6B80" />
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 120 }}>
              <div style={{ fontSize: 11, color: '#6B6B80' }}>Action Owner</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#D48000' }}>{issue['Action Owner'] || '—'}</div>
              <div style={{ fontSize: 11, color: '#6B6B80', marginTop: 4 }}>Due: {issue.due_date_at?.slice(0,10) || '—'}</div>
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
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{label}</h2>
      <span style={{
        background: color + '15', color, border: `1px solid ${color}44`,
        borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
      }}>{count}</span>
    </div>
  )
}

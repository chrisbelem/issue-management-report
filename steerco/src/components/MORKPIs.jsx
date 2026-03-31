function Gauge({ value, target, label, unit = '%', invert = false, subtitle }) {
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
      <div style={{ fontSize: 11, color: '#6B6B80' }}>
        Target: {target}{unit} · <span style={{ color, fontWeight: 600 }}>{ok ? '✓ On target' : '⚠ Off target'}</span>
      </div>
      {subtitle && <div style={{ fontSize: 11, color: '#6B6B80', marginTop: 4 }}>{subtitle}</div>}
    </div>
  )
}

function TTRCard({ ttr }) {
  if (!ttr) return null

  const hasData = ttr.count_high > 0 || ttr.count_very_high > 0
  const maxMonthly = ttr.monthly?.length
    ? Math.max(...ttr.monthly.map(m => m.avg_days), 1)
    : 1

  const fmt = v => v != null ? `${v}d` : '—'

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 11, color: '#6B6B80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
        Time to Remediate — High &amp; Very High (last 6 months)
      </div>

      {!hasData ? (
        <div style={{ color: '#6B6B80', fontSize: 13 }}>No closed High / Very High issues in the last 6 months.</div>
      ) : (
        <>
          {/* Avg cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px', background: '#E0002A08', border: '1px solid #E0002A22', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: '#E0002A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>High · avg TTR</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: '#1A1A2E' }}>{ttr.avg_high ?? '—'}</span>
                {ttr.avg_high != null && <span style={{ fontSize: 14, color: '#6B6B80' }}>days</span>}
              </div>
              <div style={{ fontSize: 11, color: '#6B6B80', marginTop: 4 }}>{ttr.count_high} issue{ttr.count_high !== 1 ? 's' : ''} closed</div>
            </div>
            <div style={{ flex: '1 1 140px', background: '#9B002008', border: '1px solid #9B002022', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: '#9B0020', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Very High · avg TTR</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: '#1A1A2E' }}>{ttr.avg_very_high ?? '—'}</span>
                {ttr.avg_very_high != null && <span style={{ fontSize: 14, color: '#6B6B80' }}>days</span>}
              </div>
              <div style={{ fontSize: 11, color: '#6B6B80', marginTop: 4 }}>{ttr.count_very_high} issue{ttr.count_very_high !== 1 ? 's' : ''} closed</div>
            </div>
          </div>

          {/* Monthly breakdown */}
          {ttr.monthly?.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: '#6B6B80', fontWeight: 600, marginBottom: 10 }}>Monthly avg TTR (H + VH)</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
                {ttr.monthly.map(m => {
                  const pct = (m.avg_days / maxMonthly) * 100
                  const label = m.month.slice(5)  // "MM"
                  return (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 9, color: '#6B6B80' }}>{m.avg_days}d</div>
                      <div style={{ width: '100%', background: '#F0EDF5', borderRadius: 4, overflow: 'hidden', height: 48, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: '100%', height: `${pct}%`, background: '#8A05BE', borderRadius: 4, transition: 'height 0.8s ease' }} />
                      </div>
                      <div style={{ fontSize: 9, color: '#6B6B80' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const EXCLUDED_SUBCATEGORIES = new Set([
  'NP&F+ Assessments',
  'NP&F+ Self-Assessments',
  'New Regulations - Under Implementation',
])

export default function MORKPIs({ issues, aps }) {
  // %SII = ΣSSI / ΣTI × 100, excluding specific subcategories from all calculations
  const eligible = issues.filter(i => !EXCLUDED_SUBCATEGORIES.has(i.subcategory))
  const ssi      = eligible.filter(i => i.origin === 'Self-Identified').length
  const selfId   = eligible.length ? (ssi / eligible.length) * 100 : 0

  const lateHighAPs = aps.filter(a => a.ap_status === 'Late' && ['High', 'Very High'].includes(a['issue rating']))

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>📊</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>MOR KPIs</h2>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Gauge
          value={selfId}
          target={60}
          label="Self-Identified Issues (%SII)"
          subtitle={`${ssi} SSI / ${eligible.length} TI (excl. NP&F+ Assessments, NP&F+ Self-Assessments, New Reg.)`}
        />
        <Gauge value={lateHighAPs.length} target={0} label="Late High / Very High APs" unit="" invert />
      </div>
    </section>
  )
}

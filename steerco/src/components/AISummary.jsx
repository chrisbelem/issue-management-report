import { useState } from 'react'

export default function AISummary({ issues, aps, lateIssues, lateAPs, pendingValLate, pendingApprLate, generatedAt }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function generate() {
    setLoading(true); setError(''); setSummary('')
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { setError('VITE_ANTHROPIC_API_KEY not set'); setLoading(false); return }

    const prompt = `You are a risk advisor presenting to a steering committee of product leaders (non-risk experts) at Nubank, a Brazilian fintech.

Data as of ${generatedAt}:
- Total active issues: ${issues.length} (${lateIssues.length} late)
- Total active action plans: ${aps.length} (${lateAPs.length} late, ${pendingValLate.length} pending validation late, ${pendingApprLate.length} pending approval late)
- Late issues: ${lateIssues.map(i => `${i.code} [${i.overall_risk_rating}] – ${i.summary} (Owner: ${i['Action Owner'] || 'N/A'})`).join('; ') || 'None'}
- Critical APs: ${[...lateAPs, ...pendingValLate, ...pendingApprLate].map(a => `${a.ap_code} [${a.ap_status}] – ${a.ap_summary} (Owner: ${a['Action Owner'] || 'N/A'})`).join('; ') || 'None'}

Write a concise executive briefing (3-4 short paragraphs, plain language, no jargon) covering:
1. Overall risk posture (one sentence)
2. What needs immediate attention and who owns it
3. What is going well
4. The single most important ask from the committee today

Keep it under 200 words. Be direct and frank.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-request-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      setSummary(data.content[0].text)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>🤖</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>AI Executive Briefing</h2>
        <span style={{ fontSize: 11, color: '#888899', background: '#1A1A22', padding: '2px 8px', borderRadius: 4 }}>Powered by Claude</span>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #111116 0%, #1a0a2e 100%)',
        border: '1px solid rgba(138,5,190,0.3)',
        borderRadius: 16, padding: 28,
      }}>
        {!summary && !loading && !error && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#888899', marginBottom: 20, fontSize: 14 }}>
              Generate a plain-language executive summary of the current risk posture for the committee.
            </p>
            <button onClick={generate} style={{
              background: 'linear-gradient(135deg, #8A05BE, #B649FF)',
              color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3,
            }}>
              ✨ Generate AI Briefing
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: '#B649FF', padding: 20 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #8A05BE', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Generating executive briefing…
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {error && <p style={{ color: '#FF4455', fontSize: 13 }}>Error: {error}</p>}

        {summary && (
          <>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: '#E0E0E5', whiteSpace: 'pre-wrap' }}>{summary}</div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={generate} style={{
                background: 'transparent', color: '#B649FF', border: '1px solid #B649FF55',
                borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer',
              }}>↺ Regenerate</button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

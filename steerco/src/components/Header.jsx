export default function Header({ generatedAt }) {
  const now = new Date()
  const month = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <header style={{
      padding: '32px 0 24px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      marginBottom: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Nubank logo mark */}
        <div style={{
          width: 44, height: 44,
          background: 'linear-gradient(135deg, #8A05BE, #B649FF)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -1,
        }}>N</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8A05BE', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
            Global Lending · BCO
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            Risk Dashboard — {month}
          </h1>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: '#888899', marginBottom: 2 }}>Last updated</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#B649FF' }}>{generatedAt}</div>
      </div>
    </header>
  )
}

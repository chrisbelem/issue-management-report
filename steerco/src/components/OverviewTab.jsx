import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
         ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts'
import { useEffect, useState, useCallback } from 'react'

function AnimatedNumber({ value, color }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let s = 0
    const step = () => { s += Math.ceil((value - s) / 6); setDisplay(s); if (s < value) requestAnimationFrame(step); else setDisplay(value) }
    requestAnimationFrame(step)
  }, [value])
  return <span style={{ color }}>{display}</span>
}

function KPICard({ label, total, late, color, icon }) {
  return (
    <div style={{ background:'#fff', borderRadius:16, padding:'20px 24px', flex:'1 1 160px', boxShadow:'0 1px 6px rgba(0,0,0,0.07)', border:`1px solid ${color}22`, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:color, borderRadius:'16px 16px 0 0' }} />
      <div style={{ fontSize:13, color:'#6B6B80', marginBottom:8 }}>{icon} {label}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
        <span style={{ fontSize:44, fontWeight:800, lineHeight:1 }}><AnimatedNumber value={total} color='#1A1A2E' /></span>
        <span style={{ fontSize:13, color:'#6B6B80' }}>total</span>
      </div>
      <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:26, fontWeight:800 }}><AnimatedNumber value={late} color={late > 0 ? color : '#007A57'} /></span>
        <span style={{ fontSize:12, color: late > 0 ? color : '#007A57', fontWeight:600 }}>late</span>
      </div>
    </div>
  )
}

const DONUT_COLORS = { Late:'#E0002A', TBD:'#D48000', 'On Track':'#007A57', 'In Validation':'#1A6FCC' }
const tooltipStyle = { background:'#fff', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', fontSize:12 }

function ActiveShape({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value }) {
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#1A1A2E" fontSize={28} fontWeight={800}>{value}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#6B6B80" fontSize={12}>{payload.name}</text>
    </g>
  )
}

function FilterBadge({ label, color, onClear }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color, fontWeight:600,
      background: color + '15', padding:'3px 10px', borderRadius:20, border:`1px solid ${color}44` }}>
      {label}
      <button onClick={onClear} style={{ background:'none', border:'none', color, cursor:'pointer', fontSize:13, padding:0, lineHeight:1, fontWeight:700 }}>×</button>
    </span>
  )
}

function ActiveFilters({ selectedStatus, selectedBA, onClearStatus, onClearBA }) {
  if (!selectedStatus && !selectedBA) return null
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
      <span style={{ fontSize:11, color:'#6B6B80', fontWeight:600 }}>Filtros ativos:</span>
      {selectedStatus && <FilterBadge label={`Status: ${selectedStatus}`} color={DONUT_COLORS[selectedStatus]||'#8A05BE'} onClear={onClearStatus} />}
      {selectedBA     && <FilterBadge label={`BA: ${selectedBA}`}         color="#8A05BE"                                  onClear={onClearBA}     />}
    </div>
  )
}

function StatusDonut({ donutData, selectedStatus, onSelect }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const handleClick = useCallback((_, index) => {
    const s = donutData[index]?.name
    onSelect(prev => prev === s ? null : s)
  }, [donutData, onSelect])

  return (
    <div style={{ background:'#fff', borderRadius:16, padding:'20px 24px', boxShadow:'0 1px 6px rgba(0,0,0,0.07)', border:'1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1A1A2E' }}>Issue Status</div>
        <div style={{ fontSize:11, color:'#6B6B80', marginTop:2 }}>Clique para filtrar todos os gráficos</div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}
            dataKey="value" activeIndex={activeIndex} activeShape={ActiveShape}
            onMouseEnter={(_, i) => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)}
            onClick={handleClick} style={{ cursor:'pointer' }}>
            {donutData.map(entry => (
              <Cell key={entry.name} fill={DONUT_COLORS[entry.name] || '#8A05BE'}
                opacity={selectedStatus && selectedStatus !== entry.name ? 0.3 : 1}
                stroke={selectedStatus === entry.name ? '#1A1A2E' : 'none'}
                strokeWidth={selectedStatus === entry.name ? 2 : 0} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:4 }}>
        {donutData.map(entry => {
          const c = DONUT_COLORS[entry.name] || '#8A05BE'
          const active = selectedStatus === entry.name
          return (
            <button key={entry.name} onClick={() => onSelect(p => p === entry.name ? null : entry.name)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20,
                background: active ? c + '20' : '#F5F5F8', border: active ? `1.5px solid ${c}` : '1.5px solid transparent',
                cursor:'pointer', fontSize:12, fontWeight: active ? 700 : 400, color: active ? c : '#6B6B80', transition:'all 0.15s' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block' }} />
              {entry.name} ({entry.value})
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:16, padding:'20px 24px', boxShadow:'0 1px 6px rgba(0,0,0,0.07)', border:'1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1A1A2E' }}>{title}</div>
        {subtitle && <div style={{ fontSize:11, color:'#6B6B80', marginTop:2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function BATable({ issues, aps, selectedBA, onSelectBA }) {
  const allBAs = [...new Set([...issues.map(i => i['Business Area']), ...aps.map(a => a['Business Area'])].filter(Boolean))].sort()
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:'2px solid rgba(138,5,190,0.15)' }}>
            {['Business Area','Issues','Late Issues','Pot. Issues','Late Pot.','APs','Late APs','Pending APs'].map(h => (
              <th key={h} style={{ padding:'8px 12px', textAlign: h==='Business Area'?'left':'center', fontSize:11, fontWeight:600, color:'#6B6B80', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allBAs.map((ba, idx) => {
            const baIssues  = issues.filter(x => x['Business Area']===ba && x.Type==='Issue')
            const baPot     = issues.filter(x => x['Business Area']===ba && x.Type==='Potential Issue')
            const baAPs     = aps.filter(x => x['Business Area']===ba)
            const lateI     = baIssues.filter(x => x.status==='Late').length
            const latePot   = baPot.filter(x => x.status==='Late').length
            const lateAP    = baAPs.filter(x => x.ap_status==='Late').length
            const pendingAP = baAPs.filter(x => ['Pending Approval','Pending Approval (late)','Pending Validation','Pending Validation (late)'].includes(x.ap_status)).length
            const red = n => n > 0 ? { color:'#E0002A', fontWeight:700 } : { color:'#6B6B80' }
            const isSelected = selectedBA === ba
            return (
              <tr key={ba} onClick={() => onSelectBA(p => p === ba ? null : ba)}
                style={{ background: isSelected ? '#8A05BE10' : idx%2===0?'#FAFAFA':'#fff',
                  borderBottom:'1px solid rgba(0,0,0,0.04)', cursor:'pointer',
                  outline: isSelected ? '2px solid #8A05BE44' : 'none', transition:'background 0.15s' }}>
                <td style={{ padding:'10px 12px', fontWeight:700, color: isSelected ? '#8A05BE' : '#1A1A2E' }}>{ba}</td>
                <td style={{ padding:'10px 12px', textAlign:'center' }}>{baIssues.length}</td>
                <td style={{ padding:'10px 12px', textAlign:'center', ...red(lateI) }}>{lateI}</td>
                <td style={{ padding:'10px 12px', textAlign:'center' }}>{baPot.length}</td>
                <td style={{ padding:'10px 12px', textAlign:'center', ...red(latePot) }}>{latePot}</td>
                <td style={{ padding:'10px 12px', textAlign:'center' }}>{baAPs.length}</td>
                <td style={{ padding:'10px 12px', textAlign:'center', ...red(lateAP) }}>{lateAP}</td>
                <td style={{ padding:'10px 12px', textAlign:'center', ...red(pendingAP) }}>{pendingAP}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ fontSize:11, color:'#6B6B80', marginTop:8, textAlign:'right' }}>Clique numa linha para filtrar os gráficos por BA</div>
    </div>
  )
}

export default function OverviewTab({ issues, aps }) {
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [selectedBA,     setSelectedBA]     = useState(null)

  // ── Apply cross-filters ───────────────────────────────────────────────────
  const filteredIssues = issues
    .filter(i => !selectedStatus || i.status === selectedStatus)
    .filter(i => !selectedBA     || i['Business Area'] === selectedBA)

  const filteredAPs = aps
    .filter(a => !selectedBA || a['Business Area'] === selectedBA)

  // ── KPI counts (full dataset per type, only BA filter) ───────────────────
  const issuesBA    = issues.filter(i => !selectedBA || i['Business Area'] === selectedBA)
  const issuesOnly  = issuesBA.filter(i => i.Type === 'Issue')
  const potIssues   = issuesBA.filter(i => i.Type === 'Potential Issue')
  const lateIssues  = issuesOnly.filter(i => i.status === 'Late')
  const latePot     = potIssues.filter(i => i.status === 'Late')
  const lateAPs     = filteredAPs.filter(a => a.ap_status === 'Late')
  const pendingLate = filteredAPs.filter(a => ['Pending Validation (late)','Pending Approval (late)'].includes(a.ap_status))

  // ── Issues by BA (always full dataset for context, highlight selected) ───
  const baIssuesMap = {}
  issues.forEach(i => {
    const ba = i['Business Area'] || 'Unknown'
    if (!baIssuesMap[ba]) baIssuesMap[ba] = { ba, 'On Track':0, Late:0, TBD:0, 'In Validation':0, total:0 }
    const s = i.status === 'Late' ? 'Late' : i.status === 'TBD' ? 'TBD' : i.status === 'In Validation' ? 'In Validation' : 'On Track'
    baIssuesMap[ba][s]++; baIssuesMap[ba].total++
  })
  const baIssuesData = Object.values(baIssuesMap).sort((a,b) => b.total - a.total).slice(0,10)

  // ── APs by BA ─────────────────────────────────────────────────────────────
  const baAPsMap = {}
  aps.forEach(a => {
    const ba = a['Business Area'] || 'Unknown'
    if (!baAPsMap[ba]) baAPsMap[ba] = { ba, 'On Track':0, Late:0, Pending:0, total:0 }
    const s = a.ap_status === 'Late' ? 'Late'
            : ['Pending Approval','Pending Approval (late)','Pending Validation','Pending Validation (late)','In Validation'].includes(a.ap_status) ? 'Pending'
            : 'On Track'
    baAPsMap[ba][s]++; baAPsMap[ba].total++
  })
  const baAPsData = Object.values(baAPsMap).sort((a,b) => b.total - a.total).slice(0,10)

  // ── Status donut (BA-filtered) ────────────────────────────────────────────
  const statusCount = issuesBA.reduce((acc, i) => { acc[i.status] = (acc[i.status]||0)+1; return acc }, {})
  const donutData   = Object.entries(statusCount).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)

  // ── Rating (cross-filtered) ───────────────────────────────────────────────
  const ratingCount = filteredIssues.reduce((acc, i) => { acc[i.overall_risk_rating] = (acc[i.overall_risk_rating]||0)+1; return acc }, {})
  const ratingData  = [
    { name:'Very High', value: ratingCount['Very High']||0, color:'#9B0020' },
    { name:'High',      value: ratingCount['High']||0,      color:'#E0002A' },
    { name:'Medium',    value: ratingCount['Medium']||0,    color:'#D48000' },
    { name:'Low',       value: ratingCount['Low']||0,       color:'#1A6FCC' },
  ]

  const handleBAClick = useCallback((data) => {
    if (data?.activePayload?.[0]?.payload?.ba) {
      const ba = data.activePayload[0].payload.ba
      setSelectedBA(prev => prev === ba ? null : ba)
    }
  }, [])

  const barOpacity = (ba) => (!selectedBA || selectedBA === ba) ? 1 : 0.3

  return (
    <div>
      <ActiveFilters
        selectedStatus={selectedStatus} selectedBA={selectedBA}
        onClearStatus={() => setSelectedStatus(null)} onClearBA={() => setSelectedBA(null)}
      />

      {/* ── KPI Cards ── */}
      <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:36 }}>
        <KPICard label="Issues"             total={issuesOnly.length}                    late={lateIssues.length} color="#E0002A" icon="🔴" />
        <KPICard label="Potential Issues"   total={potIssues.length}                     late={latePot.length}    color="#D48000" icon="⚠️" />
        <KPICard label="Action Plans"       total={filteredAPs.length}                   late={lateAPs.length}    color="#8A05BE" icon="📋" />
        <KPICard label="APs Pending (Late)" total={pendingLate.length + lateAPs.length}  late={pendingLate.length} color="#D48000" icon="⏳" />
      </div>

      {/* ── Row 1: Issues by BA + Status Donut ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:16, marginBottom:16, alignItems:'start' }}>
        <ChartCard title="Issues & Potential Issues por Business Area" subtitle="Clique numa barra para filtrar todos os gráficos">
          <ResponsiveContainer width="100%" height={Math.max(240, baIssuesData.length * 32)}>
            <BarChart data={baIssuesData} layout="vertical" margin={{ left:8, right:24, top:4, bottom:4 }} onClick={handleBAClick} style={{ cursor:'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize:11, fill:'#6B6B80' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="ba" width={140} tick={({ x, y, payload }) => (
                <text x={x} y={y} dy={4} textAnchor="end" fontSize={11}
                  fill={selectedBA === payload.value ? '#8A05BE' : '#1A1A2E'}
                  fontWeight={selectedBA === payload.value ? 700 : 400}>
                  {payload.value}
                </text>
              )} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
              <Bar dataKey="On Track"      stackId="a" fill="#007A57" opacity={barOpacity} />
              <Bar dataKey="In Validation" stackId="a" fill="#1A6FCC" opacity={barOpacity} />
              <Bar dataKey="TBD"           stackId="a" fill="#D48000" opacity={barOpacity} />
              <Bar dataKey="Late"          stackId="a" fill="#E0002A" radius={[0,4,4,0]} opacity={barOpacity} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <StatusDonut donutData={donutData} selectedStatus={selectedStatus} onSelect={setSelectedStatus} />
      </div>

      {/* ── Row 2: APs by BA + Rating ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:16, marginBottom:16, alignItems:'start' }}>
        <ChartCard title="Action Plans por Business Area" subtitle="Clique numa barra para filtrar">
          <ResponsiveContainer width="100%" height={Math.max(240, baAPsData.length * 32)}>
            <BarChart data={baAPsData} layout="vertical" margin={{ left:8, right:24, top:4, bottom:4 }} onClick={handleBAClick} style={{ cursor:'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize:11, fill:'#6B6B80' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="ba" width={140} tick={({ x, y, payload }) => (
                <text x={x} y={y} dy={4} textAnchor="end" fontSize={11}
                  fill={selectedBA === payload.value ? '#8A05BE' : '#1A1A2E'}
                  fontWeight={selectedBA === payload.value ? 700 : 400}>
                  {payload.value}
                </text>
              )} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
              <Bar dataKey="On Track" stackId="a" fill="#007A57" opacity={barOpacity} />
              <Bar dataKey="Pending"  stackId="a" fill="#D48000" opacity={barOpacity} />
              <Bar dataKey="Late"     stackId="a" fill="#E0002A" radius={[0,4,4,0]} opacity={barOpacity} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Issues por Risk Rating" subtitle="Filtrado por status e BA ativos">
          <div style={{ display:'flex', flexDirection:'column', gap:12, padding:'16px 0' }}>
            {ratingData.map(({ name, value, color }) => {
              const total = filteredIssues.length
              const pct = total ? Math.round((value / total) * 100) : 0
              return (
                <div key={name}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}>
                    <span style={{ fontWeight:600, color }}>{name}</span>
                    <span style={{ color:'#6B6B80' }}>{value} ({pct}%)</span>
                  </div>
                  <div style={{ height:10, background:'#F0EDF5', borderRadius:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:5, transition:'width 0.6s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>
      </div>

      {/* ── BA Table ── */}
      <ChartCard title="Visão Consolidada por Business Area" subtitle="Clique numa linha para filtrar">
        <BATable issues={issues} aps={aps} selectedBA={selectedBA} onSelectBA={setSelectedBA} />
      </ChartCard>
    </div>
  )
}

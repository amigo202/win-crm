import { useState, useEffect, useRef, useMemo } from 'react'
import Chart from 'chart.js/auto'

// ââ Constants ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const MONTHS_SHORT = ['×× ××³','×¤××¨×³','××¨×¥','××¤×¨×³','×××','××× ×','××××','××××³','×¡×¤××³','×××§×³','× ×××³','××¦××³']
const MONTHS_FULL  = ['×× ×××¨','×¤××¨×××¨','××¨×¥','××¤×¨××','×××','××× ×','××××','×××××¡×','×¡×¤××××¨','×××§××××¨','× ×××××¨','××¦×××¨']

const CAT_COLORS = {
  '×××××':        '#3b82f6',
  '×§××¨×¡××':       '#10b981',
  '×§×××× ××ª':      '#8b5cf6',
  '×¤×¨××××§×××':    '#f97316',
  '××¤×§×ª ×¡×¨××× ××': '#ef4444',
  'PIXMIX':       '#8b5cf6',
  '×¡×¨×××':        '#ef4444',
  '××¨×¦××':        '#f59e0b',
  '×××¢××¥':        '#10b981',
  '×××¨':          '#64748b',
}

const CLASS_TYPE_TO_CAT = {
  '×××': '×××××', '×§××¨×¡': '×§××¨×¡××', '×¡×× ×': '×§××¨×¡××',
  '××× ×': '×§×××× ××ª', '×××¨××¢': '×¤×¨××××§×××', '××¨×¦××': '××¨×¦××', '×××¨': '×××¨',
}
const ACT_TYPE_TO_CAT = {
  'pixmix': 'PIXMIX', 'video': '×¡×¨×××', 'lecture': '××¨×¦××',
  'consulting': '×××¢××¥', 'content': '×ª×××', 'other': '×××¨',
}

function fmtShekel(n) { return 'âª' + (Number(n)||0).toLocaleString('he-IL') }
function fmtK(n) { return n >= 1000 ? 'âª' + Math.round(n/1000) + 'K' : fmtShekel(n) }

// ââ Build unified monthly data from live CRM data ââââââââââââââââââââââââââ
function buildMonthlyData(classes, activities, year) {
  // 12 buckets, one per month
  const monthly = Array(12).fill(0)
  const byCategory = {}     // cat â [12 months]
  const byClient   = {}     // clientName â { cat, total, monthly[12] }

  // From classes
  ;(classes || []).forEach(cls => {
    const y = Number(cls.year), m = Number(cls.month)
    if (y !== year || m < 1 || m > 12) return
    const students  = Number(cls.students_count) || 0
    const pps       = Number(cls.price_per_student) || 0
    const agreed    = Number(cls.agreed_price) || 0
    const actual    = Number(cls.actual_income) || 0
    const income    = actual || (students * pps) || agreed
    if (!income) return
    const cat = CLASS_TYPE_TO_CAT[cls.activity_type] || '×××××'
    const client = cls.contact_name || cls.class_name || '×× ××××¢'
    monthly[m-1] += income
    if (!byCategory[cat]) byCategory[cat] = Array(12).fill(0)
    byCategory[cat][m-1] += income
    if (!byClient[client]) byClient[client] = { cat, total: 0, monthly: Array(12).fill(0) }
    byClient[client].total += income
    byClient[client].monthly[m-1] += income
    byClient[client].cat = cat
  })

  // From activities (PIXMIX, videos, lectures, etc.)
  ;(activities || []).forEach(act => {
    const y = Number(act.year), m = Number(act.month)
    if (y !== year || m < 1 || m > 12) return
    const income = Number(act.income) || 0
    if (!income) return
    const cat = ACT_TYPE_TO_CAT[act.activityType] || '×××¨'
    const client = act.contactName || act.name || '×× ××××¢'
    monthly[m-1] += income
    if (!byCategory[cat]) byCategory[cat] = Array(12).fill(0)
    byCategory[cat][m-1] += income
    if (!byClient[client]) byClient[client] = { cat, total: 0, monthly: Array(12).fill(0) }
    byClient[client].total += income
    byClient[client].monthly[m-1] += income
    byClient[client].cat = cat
  })

  return { monthly, byCategory, byClient }
}

// ââ KPI Card âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function KpiCard({ icon, value, label, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '18px 20px',
      borderRight: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ââ Main component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function ReportsPage({ classes, activities, leads, contacts, deals, dark }) {
  const now    = new Date()
  const curY   = now.getFullYear()
  const prevY  = curY - 1

  const [year, setYear] = useState(curY)  // curY | prevY | 'both'

  const trendRef  = useRef(null)
  const catRef    = useRef(null)
  const cmpRef    = useRef(null)
  const cRefs     = useRef({})

  // ââ Compute data ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const dataCur  = useMemo(() => buildMonthlyData(classes, activities, curY),  [classes, activities, curY])
  const dataPrev = useMemo(() => buildMonthlyData(classes, activities, prevY), [classes, activities, prevY])

  const activeData = year === 'both' ? null : (year === curY ? dataCur : dataPrev)

  const totalCur  = dataCur.monthly.reduce((s,v)=>s+v, 0)
  const totalPrev = dataPrev.monthly.reduce((s,v)=>s+v, 0)

  // KPIs for selected year
  const kpiData = year === 'both'
    ? { total: totalCur + totalPrev, monthly: dataCur.monthly.map((v,i) => v + dataPrev.monthly[i]) }
    : { total: activeData.monthly.reduce((s,v)=>s+v,0), monthly: activeData.monthly }

  const activeMonths  = kpiData.monthly.filter(v => v > 0).length
  const avgMonthly    = activeMonths > 0 ? Math.round(kpiData.total / activeMonths) : 0
  const maxMonth      = Math.max(...kpiData.monthly)
  const maxMonthIdx   = kpiData.monthly.indexOf(maxMonth)

  // Active leads count (always live)
  const activeLeads = (leads || []).filter(l => !['won','lost'].includes(l.leadStage)).length

  // YoY delta (current year vs same months in previous)
  const yoyDelta = useMemo(() => {
    if (year === 'both') return null
    const activeMo = dataCur.monthly.map((v,i) => v > 0 ? i : -1).filter(i => i >= 0)
    const cur  = activeMo.reduce((s,i) => s + dataCur.monthly[i], 0)
    const prev = activeMo.reduce((s,i) => s + (dataPrev.monthly[i] || 0), 0)
    if (!prev) return null
    return Math.round(((cur - prev) / prev) * 100)
  }, [dataCur, dataPrev, year])

  // Top clients
  const topClients = useMemo(() => {
    const src = year === 'both'
      ? (() => {
          const merged = { ...dataCur.byClient }
          Object.entries(dataPrev.byClient).forEach(([k, v]) => {
            if (merged[k]) { merged[k] = { ...merged[k], total: merged[k].total + v.total } }
            else merged[k] = { ...v }
          })
          return merged
        })()
      : activeData.byClient
    return Object.entries(src)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [year, dataCur, dataPrev, activeData])

  // ââ Charts ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  useEffect(() => {
    const tc = dark ? '#94a3b8' : '#64748b'
    const gc = dark ? '#1e293b' : '#e2e8f0'
    Object.values(cRefs.current).forEach(c => c?.destroy())
    cRefs.current = {}

    // Trend chart
    if (trendRef.current) {
      if (year === 'both') {
        cRefs.current.trend = new Chart(trendRef.current, {
          type: 'bar',
          data: {
            labels: MONTHS_SHORT,
            datasets: [
              { label: String(prevY), data: dataPrev.monthly, backgroundColor: 'rgba(59,130,246,.7)', borderRadius: 4 },
              { label: String(curY),  data: dataCur.monthly,  backgroundColor: 'rgba(249,115,22,.85)', borderRadius: 4 },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: tc, font: { family: 'Rubik', size: 11 } } } },
            scales: {
              x: { grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik', size: 11 } } },
              y: { grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik', size: 11 }, callback: v => fmtK(v) } }
            }
          }
        })
      } else {
        const cats = Object.keys(activeData.byCategory)
        cRefs.current.trend = new Chart(trendRef.current, {
          type: 'bar',
          data: {
            labels: MONTHS_SHORT,
            datasets: cats.map(cat => ({
              label: cat,
              data: activeData.byCategory[cat],
              backgroundColor: CAT_COLORS[cat] || '#64748b',
              borderRadius: 2,
              stack: 'a',
            }))
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: tc, font: { family: 'Rubik', size: 10 }, boxWidth: 12 } } },
            scales: {
              x: { stacked: true, grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik', size: 11 } } },
              y: { stacked: true, grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik', size: 11 }, callback: v => fmtK(v) } }
            }
          }
        })
      }
    }

    // Category doughnut
    if (catRef.current) {
      const src = year === 'both'
        ? Object.fromEntries(
            [...new Set([...Object.keys(dataCur.byCategory), ...Object.keys(dataPrev.byCategory)])].map(k => [
              k,
              (dataCur.byCategory[k] || Array(12).fill(0)).map((v,i) => v + (dataPrev.byCategory[k]?.[i] || 0))
            ])
          )
        : activeData.byCategory
      const cats = Object.keys(src)
      const vals = cats.map(k => src[k].reduce((s,v)=>s+v,0)).filter(v => v > 0)
      const filteredCats = cats.filter((_, i) => (cats.map(k => src[k].reduce((s,v)=>s+v,0)))[i] > 0)
      if (filteredCats.length > 0) {
        cRefs.current.cat = new Chart(catRef.current, {
          type: 'doughnut',
          data: {
            labels: filteredCats,
            datasets: [{ data: vals, backgroundColor: filteredCats.map(k => CAT_COLORS[k] || '#64748b'), hoverOffset: 6 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: {
              legend: { position: 'bottom', labels: { color: tc, font: { family: 'Rubik', size: 11 }, boxWidth: 12 } },
              tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmtShekel(ctx.parsed)}` } }
            }
          }
        })
      }
    }

    // Comparison bar
    if (cmpRef.current) {
      const allCats = [...new Set([...Object.keys(dataCur.byCategory), ...Object.keys(dataPrev.byCategory)])]
      const v25 = allCats.map(k => (dataPrev.byCategory[k] || []).reduce((s,v)=>s+v,0))
      const v26 = allCats.map(k => (dataCur.byCategory[k] || []).reduce((s,v)=>s+v,0))
      cRefs.current.cmp = new Chart(cmpRef.current, {
        type: 'bar',
        data: {
          labels: allCats,
          datasets: [
            { label: String(prevY), data: v25, backgroundColor: 'rgba(59,130,246,.7)', borderRadius: 4 },
            { label: String(curY),  data: v26, backgroundColor: 'rgba(249,115,22,.85)', borderRadius: 4 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: tc, font: { family: 'Rubik', size: 11 } } } },
          scales: {
            x: { grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik', size: 12 } } },
            y: { grid: { color: gc }, ticks: { color: tc, font: { family: 'Rubik', size: 11 }, callback: v => fmtK(v) } }
          }
        }
      })
    }

    return () => Object.values(cRefs.current).forEach(c => c?.destroy())
  }, [year, dataCur, dataPrev, dark, activeData])

  // ââ Heatmap colors ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const catByCatSrc = year === 'both'
    ? Object.fromEntries(
        [...new Set([...Object.keys(dataCur.byCategory), ...Object.keys(dataPrev.byCategory)])].map(k => [
          k,
          (dataCur.byCategory[k] || Array(12).fill(0)).map((v,i) => v + (dataPrev.byCategory[k]?.[i] || 0))
        ])
      )
    : (activeData?.byCategory || {})

  const hmCats = Object.keys(catByCatSrc)
  const hmMax  = Math.max(1, ...hmCats.flatMap(k => catByCatSrc[k]))

  // ââ Render ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  return (
    <>
      {/* ââ Page header ââ */}
      <div className="ph">
        <div>
          <h2>×××××ª ð</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            × ×ª×× ×× ×××× ××-CRM Â· ××××× + ×¤×¢××××××ª
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[prevY, curY, 'both'].map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              style={{
                padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
                background: year === y ? '#f97316' : 'var(--surface)',
                color: year === y ? '#fff' : 'var(--muted)',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {y === 'both' ? '××©××××' : y}
            </button>
          ))}
        </div>
      </div>

      <div className="pb">

        {/* ââ KPI Row ââ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
          <KpiCard icon="ð°" value={fmtShekel(kpiData.total)}
            label={`×¡×"× ××× ×¡××ª ${year === 'both' ? prevY + '+' + curY : year}`}
            sub={yoyDelta != null ? (yoyDelta >= 0 ? `â ${yoyDelta}% ××¢×××ª ${prevY}` : `â ${Math.abs(yoyDelta)}% ××¢×××ª ${prevY}`) : `${activeMonths} ××××©×× ×¤×¢××××`}
            color={yoyDelta == null ? '#10b981' : yoyDelta >= 0 ? '#10b981' : '#ef4444'}
          />
          <KpiCard icon="ð" value={fmtShekel(avgMonthly)}
            label="××××¦×¢ ××××©×" sub="×××××©×× ×¤×¢××××" color="#3b82f6"
          />
          <KpiCard icon="ð" value={maxMonth > 0 ? MONTHS_SHORT[maxMonthIdx] : 'â'}
            label="××××© ×©××" sub={maxMonth > 0 ? fmtShekel(maxMonth) : ''} color="#8b5cf6"
          />
          <KpiCard icon="ð¥" value={topClients.length}
            label="××§××××ª ×¤×¢××××" sub={topClients[0]?.name || ''} color="#f97316"
          />
          <KpiCard icon="ð¯" value={activeLeads}
            label="××××× ××¦×× ××¨" sub="××¤×××¤×××× ××¨××¢" color="#ef4444"
          />
        </div>

        {/* ââ Charts Row 1: Trend + Doughnut ââ */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>
              {year === 'both' ? `××©×××× ××××©××ª â ${prevY} ××× ${curY}` : `××× ×¡××ª ××××©×××ª â ${year}`}
            </div>
            <div style={{ height: 220 }}><canvas ref={trendRef}/></div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>
              ×¤×××× ××¤× ×§××××¨××
            </div>
            <div style={{ height: 220 }}><canvas ref={catRef}/></div>
          </div>
        </div>

        {/* ââ Charts Row 2: Comparison ââ */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            ××©×××× {prevY} ××× {curY} ××¤× ×§××××¨××
          </div>
          <div style={{ height: 180 }}><canvas ref={cmpRef}/></div>
        </div>

        {/* ââ Clients Table ââ */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            ××§××××ª ××××××× â {year === 'both' ? '××¦×××¨' : year}
          </div>
          {topClients.length === 0
            ? <div className="empty"><div className="empty-ico">ð</div><p>××× × ×ª×× ×× ×¢×××× â ×××¡×£ ××××× ××¤×¢××××××ª</p></div>
            : <div className="tbl-wrap">
                <table><thead><tr>
                  <th>#</th><th>××§××</th><th>×§××××¨××</th><th>×¡×"×</th><th style={{minWidth:200}}>× ×ª×</th>
                </tr></thead>
                <tbody>
                  {topClients.map((c, i) => {
                    const tot = topClients.reduce((s, x) => s + x.total, 0)
                    const pct = Math.round(c.total / tot * 100)
                    const barW = Math.round(c.total / topClients[0].total * 100)
                    const col = CAT_COLORS[c.cat] || '#64748b'
                    return (
                      <tr key={c.name}>
                        <td style={{ color: 'var(--muted)', fontWeight: 700 }}>{i+1}</td>
                        <td><strong>{c.name}</strong></td>
                        <td>
                          <span style={{ background: col + '22', color: col, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                            {c.cat}
                          </span>
                        </td>
                        <td><strong style={{ color: col }}>{fmtShekel(c.total)}</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: barW + '%', background: col, borderRadius: 3 }}/>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody></table>
              </div>
          }
        </div>

        {/* ââ Heatmap ââ */}
        {hmCats.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' }}>
              ××¤×ª ××× â ××× ×¡××ª ××¤× ××××© ××§××××¨××
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(12, 1fr)`, gap: 3, fontSize: 11, minWidth: 700 }}>
                {/* Header */}
                <div style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--muted)' }}>×§××××¨××</div>
                {MONTHS_SHORT.map(m => (
                  <div key={m} style={{ padding: '6px 4px', textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>{m}</div>
                ))}
                {/* Rows */}
                {hmCats.map(cat => {
                  const col = CAT_COLORS[cat] || '#64748b'
                  const r = parseInt(col.slice(1,3),16), g = parseInt(col.slice(3,5),16), b = parseInt(col.slice(5,7),16)
                  return [
                    <div key={cat + '_l'} style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: 12 }}>{cat}</div>,
                    ...catByCatSrc[cat].map((v, mi) => {
                      const alpha = v > 0 ? 0.15 + 0.75 * (v / hmMax) : 0
                      return (
                        <div key={cat + '_' + mi} title={`${cat} â ${MONTHS_FULL[mi]}: ${fmtShekel(v)}`}
                          style={{ padding: '5px 3px', textAlign: 'center', borderRadius: 4, background: `rgba(${r},${g},${b},${alpha})`, color: v > 0 ? col : 'var(--muted)', fontWeight: v > 0 ? 700 : 400 }}>
                          {v > 0 ? fmtK(v) : 'â'}
                        </div>
                      )
                    })
                  ]
                })}
                {/* Total row */}
                <div style={{ padding: '6px 8px', fontWeight: 700, color: '#f97316' }}>×¡×"×</div>
                {Array(12).fill(0).map((_, mi) => {
                  const v = hmCats.reduce((s, k) => s + (catByCatSrc[k]?.[mi] || 0), 0)
                  return (
                    <div key={'tot_' + mi} title={`×¡×"× â ${MONTHS_FULL[mi]}: ${fmtShekel(v)}`}
                      style={{ padding: '5px 3px', textAlign: 'center', borderRadius: 4, background: v > 0 ? 'rgba(249,115,22,.15)' : 'transparent', color: v > 0 ? '#f97316' : 'var(--muted)', fontWeight: 700 }}>
                      {v > 0 ? fmtK(v) : 'â'}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ââ Empty state ââ */}
        {kpiData.total === 0 && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="empty">
              <div className="empty-ico">ð</div>
              <p>××× × ×ª×× ×× ××©× × {year === 'both' ? `${prevY}/${curY}` : year}</p>
              <p style={{ fontSize: 12, marginTop: 8, color: 'var(--muted)' }}>
                ×××¡×£ ××××× ×"××××× ××§××¨×¡××" ×× ×¤×¢××××××ª ×"×¤×¢××××××ª" â ×× ×××¤××¢× ××× ××××××××ª
              </p>
            </div>
          </div>
        )}

      </div>
    </>
  )
}

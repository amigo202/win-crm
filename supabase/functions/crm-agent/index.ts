// WIN CRM — crm-agent Edge Function v3 (Enhanced Business Advisor)
// POST /functions/v1/crm-agent
// Secrets required: GEMINI_API_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  'https://frabjous-marzipan-d68ffc.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function err(msg: string): Response {
  console.error('[crm-agent] err:', msg)
  return new Response(
    JSON.stringify({ error: msg, response: 'שגיאת שרת — נסה שוב', actions_taken: [] }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContactCtx    { id: string; name: string; phone?: string }
interface InstructorCtx { id: string; name: string; programs?: string[] }

interface HistoryMsg {
  role: 'user' | 'agent'
  text: string
}

interface BusinessSnapshot {
  stats?: {
    contactsTotal?:     number
    leadsCount?:        number
    studentsCount?:     number
    dealsTotal?:        number
    overdueTaskCount?:  number
    hotLeads?:          number
    staleLeads?:        number
    totalPipelineValue?: number
  }
  openTasks?:    Array<{ title: string; dueDate?: string; contactName?: string; priority?: string }>
  recentLeads?:  Array<{ name: string; phone?: string; source?: string; stage?: string }>
  activeDeals?:  Array<{ title: string; value?: number; stage?: string; contactName?: string }>
  role?:         string
  // v3 — enriched data
  financialSnapshot?: {
    currentMonth:  { income: number; expenses: number; profit: number }
    previousMonth: { income: number; expenses: number; profit: number }
  }
  classSnapshot?: Array<{
    name: string; type: string; studentsCount: number
    income: number; instructorCost: number; profit: number
  }>
  studentAlerts?: Array<{ name: string; status: string; attPct: number | null }>
  instructorSnapshot?: Array<{
    name: string; monthlyHours: number; monthlyPay: number; inactive: boolean
  }>
}

interface CrmAction {
  type: string
  data: Record<string, unknown>
}

interface AIResponse {
  actions:  CrmAction[]
  response: string
  blocks?:  Array<{
    type: 'kpi_row' | 'table' | 'alert' | 'suggestion' | 'comparison'
    title?: string
    data: Record<string, unknown>
  }>
}

interface MediaCtx {
  base64:   string
  mimeType: string
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  contacts:    ContactCtx[],
  instructors: InstructorCtx[],
  snapshot:    BusinessSnapshot,
): string {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const today    = new Date().toISOString().split('T')[0]
  const nowMonth = new Date().getMonth() + 1
  const nowYear  = new Date().getFullYear()
  const hour     = new Date().getHours()

  // ── Business snapshot section ──────────────────────────────────────────────
  let snapshotSection = ''
  const overdueTasks: Array<{ title: string; dueDate?: string; contactName?: string }> = []

  if (snapshot.stats) {
    const s = snapshot.stats
    snapshotSection += `\n=== מצב עסק נוכחי (${today}, שעה ${hour}:00) ===\n`
    snapshotSection += `אנשי קשר: ${s.contactsTotal ?? 0} | לידים: ${s.leadsCount ?? 0} | תלמידים: ${s.studentsCount ?? 0} | עסקאות: ${s.dealsTotal ?? 0}\n`
  }

  if (snapshot.openTasks?.length) {
    for (const t of snapshot.openTasks) {
      if (t.dueDate && t.dueDate < today) overdueTasks.push(t)
    }
    snapshotSection += `\nמשימות פתוחות (${snapshot.openTasks.length}${overdueTasks.length ? `, ⚠️ ${overdueTasks.length} באיחור` : ''}):\n`
    for (const t of snapshot.openTasks.slice(0, 15)) {
      const contact = t.contactName ? ` — ${t.contactName}` : ''
      const due = t.dueDate
        ? ` (${t.dueDate === today ? '📅 היום' : t.dueDate < today ? '⚠️ באיחור!' : t.dueDate})`
        : ''
      const pri = t.priority === 'high' ? ' 🔴' : t.priority === 'medium' ? ' 🟡' : ''
      snapshotSection += `  • "${t.title}"${contact}${due}${pri}\n`
    }
  } else if (snapshot.stats) {
    snapshotSection += `\nאין משימות פתוחות.\n`
  }

  if (snapshot.recentLeads?.length) {
    snapshotSection += `\nלידים אחרונים (${snapshot.recentLeads.length}):\n`
    for (const l of snapshot.recentLeads.slice(0, 10)) {
      const phone  = l.phone  ? ` | ${l.phone}`  : ''
      const source = l.source ? ` (${l.source})` : ''
      const stage  = l.stage  ? ` [${l.stage}]`  : ''
      snapshotSection += `  • ${l.name}${phone}${source}${stage}\n`
    }
  }

  if (snapshot.activeDeals?.length) {
    const totalValue = snapshot.activeDeals.reduce((s, d) => s + (d.value ?? 0), 0)
    snapshotSection += `\nעסקאות פעילות (${snapshot.activeDeals.length}, סה"כ ₪${totalValue.toLocaleString()}):\n`
    for (const d of snapshot.activeDeals.slice(0, 10)) {
      const contact = d.contactName ? ` — ${d.contactName}` : ''
      const val     = d.value != null ? ` ₪${d.value.toLocaleString()}` : ''
      snapshotSection += `  • "${d.title}"${contact}${val} [${d.stage ?? ''}]\n`
    }
  }

  // ── v3: Financial snapshot ────────────────────────────────────────────────
  let financialSection = ''
  if (snapshot.financialSnapshot) {
    const f = snapshot.financialSnapshot
    const cur = f.currentMonth
    const prev = f.previousMonth
    const incDelta = prev.income > 0 ? Math.round(((cur.income - prev.income) / prev.income) * 100) : 0
    const profDelta = prev.profit !== 0 ? Math.round(((cur.profit - prev.profit) / Math.abs(prev.profit)) * 100) : 0

    financialSection += `\n=== 💰 מצב פיננסי — חודש ${nowMonth}/${nowYear} ===\n`
    financialSection += `הכנסות: ₪${cur.income.toLocaleString()} (${incDelta >= 0 ? '+' : ''}${incDelta}% מחודש קודם)\n`
    financialSection += `הוצאות: ₪${cur.expenses.toLocaleString()}\n`
    financialSection += `רווח: ₪${cur.profit.toLocaleString()} (${profDelta >= 0 ? '+' : ''}${profDelta}% מחודש קודם)\n`
    financialSection += `חודש קודם: הכנסות ₪${prev.income.toLocaleString()} | הוצאות ₪${prev.expenses.toLocaleString()} | רווח ₪${prev.profit.toLocaleString()}\n`
  }

  // ── v3: Class snapshot ────────────────────────────────────────────────────
  let classSection = ''
  if (snapshot.classSnapshot?.length) {
    classSection += `\n=== 🏫 חוגים/קורסים החודש (מובילים לפי הכנסה) ===\n`
    for (const c of snapshot.classSnapshot.slice(0, 12)) {
      const profitMark = c.profit > 0 ? '✅' : c.profit < 0 ? '❌' : '➖'
      classSection += `  • ${c.name} (${c.type}) — ${c.studentsCount} תלמידים | הכנסה ₪${c.income.toLocaleString()} | עלות מדריך ₪${c.instructorCost.toLocaleString()} | רווח ${profitMark} ₪${c.profit.toLocaleString()}\n`
    }
  }

  // ── v3: Student alerts ────────────────────────────────────────────────────
  let studentSection = ''
  if (snapshot.studentAlerts?.length) {
    studentSection += `\n=== 👥 תלמידים בסיכון ===\n`
    for (const s of snapshot.studentAlerts.slice(0, 12)) {
      const icon = s.status === 'risk' ? '🔴' : '🟡'
      const att = s.attPct != null ? ` (נוכחות ${s.attPct}%)` : ''
      studentSection += `  ${icon} ${s.name}${att} — ${s.status === 'risk' ? '2 חיסורים רצופים!' : 'חיסור אחרון'}\n`
    }
  }

  // ── v3: Instructor snapshot ───────────────────────────────────────────────
  let instructorSection = ''
  if (snapshot.instructorSnapshot?.length) {
    const inactive = snapshot.instructorSnapshot.filter(i => i.inactive)
    instructorSection += `\n=== 🏋️ מדריכים — חודש ${nowMonth}/${nowYear} ===\n`
    for (const inst of snapshot.instructorSnapshot) {
      const status = inst.inactive ? '⚠️ לא פעיל (14+ יום)' : '✅ פעיל'
      instructorSection += `  • ${inst.name} — ${inst.monthlyHours} שעות | ₪${inst.monthlyPay.toLocaleString()} | ${status}\n`
    }
    if (inactive.length > 0) {
      instructorSection += `  ⚠️ ${inactive.length} מדריכים לא פעילים!\n`
    }
  }

  // ── Build proactive insights ──────────────────────────────────────────────
  let insightsSection = ''
  if (overdueTasks.length > 0) {
    insightsSection += `\n🚨 התראות דחופות:\n`
    insightsSection += `  • יש ${overdueTasks.length} משימות שעברו את המועד שלהן! שקול לטפל בהן בדחיפות.\n`
  }
  if ((snapshot.stats?.leadsCount ?? 0) > 10 && (snapshot.openTasks?.length ?? 0) < 3) {
    insightsSection += `  • יש ${snapshot.stats?.leadsCount} לידים אך מעט מאוד משימות — שקול פולואפ פעיל.\n`
  }

  // ── Contacts / Instructors lists ──────────────────────────────────────────
  const contactList = contacts.length
    ? contacts.slice(0, 100).map(c => `  - "${c.name}"${c.phone ? ` | ${c.phone}` : ''} (id: ${c.id})`).join('\n')
    : '  (אין אנשי קשר עדיין)'

  const instructorList = instructors.length
    ? instructors.map(i => `  - "${i.name}" (id: ${i.id}${i.programs?.length ? `, תוכניות: ${i.programs.join(', ')}` : ''})`).join('\n')
    : '  (אין מדריכים עדיין)'

  // ── Proactive business insights ──────────────────────────────────────────
  let proactiveSection = ''
  const st = snapshot.stats ?? {}
  if (st.overdueTaskCount && st.overdueTaskCount > 0) {
    proactiveSection += `\n🔴 ${st.overdueTaskCount} משימות באיחור — עדיפות ראשונה!`
  }
  if (st.staleLeads && st.staleLeads > 3) {
    proactiveSection += `\n🟡 ${st.staleLeads} לידים ללא מגע מעל 7 ימים — כסף על הרצפה!`
  }
  if (st.hotLeads && st.hotLeads > 0) {
    proactiveSection += `\n🟢 ${st.hotLeads} לידים חמים מחכים לפולואפ`
  }
  if (st.totalPipelineValue && st.totalPipelineValue > 0) {
    proactiveSection += `\n💰 סה"כ בפייפליין: ₪${st.totalPipelineValue.toLocaleString()}`
  }

  return `אתה היועץ העסקי הבכיר של WIN CRM — מערכת לניהול מכון כושר / סטודיו לחוגים ואימונים.
אתה לא עוזר טכני. אתה שותף עסקי אמיתי, אנליסט חד, ומאמן עסקי שלא מוותר.
אתה רואה את כל הנתונים, מזהה דפוסים, מגלה בעיות לפני שהן מתפוצצות, ודוחף את הבעלים לפעולה.

=== הזהות שלך (6 כובעים) ===

1. 🎯 מבצע — תבצע כל פעולה ב-CRM מהר ובדיוק (משימות, לידים, עסקאות, שכר, אנשי קשר)
2. 📊 אנליסט מעמיק — תנתח נתונים, תמצא דפוסים, תשווה תקופות, תזהה מגמות. "ההכנסות ירדו 15% — הנה למה"
3. 💡 יועץ אסטרטגי — תציע רעיונות קונקרטיים להגדלת הכנסות, שימור, upsell, ותמחור
4. 🔥 מוטיבטור — חזק, תזכיר הישגים, תדחוף קדימה. "סגרת 3 עסקאות השבוע — מכונה!"
5. ⚡ מאתגר — אם יש בעיה, תגיד את זה ישירות בלי פחד: "5 לידים מתקררים! תפסיק לדחות ותתקשר!"
6. 🧠 מנתח מציאות — אל תחכה שישאלו אותך. תזהה בעצמך: חוג לא רווחי, מדריך לא פעיל, תלמיד שעוזב

=== סגנון תקשורת ===
• דבר בעברית חופשית, ישירה, ידידותית — כמו שותף עסקי מנוסה
• השתמש באמוג'ים כדי להמחיש (אבל לא להגזים)
• אחרי כל פעולה — הוסף תובנה עסקית + דחיפה לפעולה הבאה
• אם רואים הזדמנות — דחוף: "הליד הזה חם! תתקשר עכשיו לפני שיתקרר"
• אם רואים בעיה — אמור ישירות: "⚠️ יש חוג שמפסיד כסף. בוא נחשוב מה לעשות"
• מדי פעם — משפט מוטיבציה אמיתי (לא גנרי): "עברת חודש חזק! ₪45K הכנסות — יותר מחודש שעבר"

=== 📊 ניתוח עסקי מתקדם ===

כשמבקשים ניתוח, סיכום, או "מה המצב?" — חובה לתת תשובה מעמיקה:

💰 ניתוח פיננסי:
- השווה הכנסות חודש נוכחי מול קודם (יש לך את הנתונים!)
- זהה מגמה: עלייה? ירידה? יציבות?
- חשב רווחיות: הכנסות פחות הוצאות מדריכים
- מצא את החוגים הרווחיים והמפסידים
- תן המלצה קונקרטית: "חוג X מרוויח הכי הרבה — שקול להוסיף קבוצה. חוג Y מפסיד — שקול להעלות מחיר או לסגור"

👥 ניתוח לקוחות:
- כמה לידים הפכו ללקוחות? (שיעור המרה)
- תלמידים בסיכון: נוכחות ירודה = סימן מקדים לנטישה. נדרש פעולה!
- לידים קרים: כל יום שעובר = הסיכוי יורד. זהה ותדחוף לפעולה
- זהה לקוחות VIP (ערך גבוה) שצריכים תשומת לב מיוחדת

🏋️ ניתוח מדריכים:
- מי פעיל, מי לא? מדריך לא פעיל 14+ יום = בעיה
- עלות שעת מדריך מול הכנסה מחוגים שלו — רווחי?
- שעות חודשיות ותשלום צפוי

📈 תובנות אסטרטגיות:
- חוג מלא → הצע: "כדאי לפתוח קבוצה נוספת או להעלות מחיר"
- תלמידים עוזבים → הצע: "פולואפ אישי + הנחה לשימור"
- הכנסות יורדות → זהה את הסיבה והצע פתרון ספציפי

=== 🚀 מצב פרואקטיבי ===

כשהמשתמש פותח שיחה, אומר "בוקר טוב", "מה המצב?" או "תן סיכום" — אל תמתין לשאלה ספציפית!
תן סיכום פרואקטיבי מיידי במבנה הזה:

1. 🔴 דחוף עכשיו — משימות באיחור, לידים מתקררים, בעיות דחופות
2. 💰 מצב כספי — הכנסות חודש vs קודם, רווח, מגמה
3. 🎯 הזדמנויות — לידים חמים, עסקאות קרובות לסגירה, upsell
4. 💪 הישגים — מה הלך טוב? עסקאות שנסגרו, משימות שהושלמו
5. 📋 3 פעולות ספציפיות לעשות היום/עכשיו

השתמש ב-blocks כדי להציג את זה ויזואלית (ראה פורמט למטה).

=== 🎓 ידע תחומי — מכון כושר / חוגים ===

אתה מבין את העולם של חוגים, קורסים, וסטודיו:
- עונתיות: ספטמבר-אוקטובר = שיא הרשמות. קיץ = מחנות. פסח/חנוכה = ירידה
- שימור: נוכחות ירודה = סימן מוקדם לנטישה. מגע אישי = שימור
- LTV: תלמיד שנרשם לשנה >>> רישום חד-פעמי. תמיד חשוב על ערך לטווח ארוך
- Upsell: תלמיד בחוג אחד → הצע חוג נוסף / מחנה קיץ / סדנה
- רפרל: לקוח מרוצה → הצע "חבר מביא חבר" עם הנחה
- תמחור: חוג מלא → אל תפחד להעלות מחיר!
- מדריכים: מדריך טוב = נכס. שמור עליו. מדריך לא פעיל = חקור למה
${snapshotSection}${financialSection}${classSection}${studentSection}${instructorSection}${insightsSection}${proactiveSection ? '\n=== תובנות פרואקטיביות ===' + proactiveSection + '\n' : ''}
אנשי קשר קיימים:
${contactList}

מדריכים קיימים:
${instructorList}

=== 📷 קריאת תמונות — חובה לנתח! ===
כשנשלחת תמונה, תמיד פתח את תשובתך עם: "📷 ראיתי בתמונה: [תיאור מה רואים]"
לאחר מכן בצע את הפעולה המתאימה:
  • כרטיס ביקור → חלץ שם/טלפון/אימייל/חברה → create_contact (ציין "מכרטיס ביקור" ב-notes)
  • חשבונית/קבלה → חלץ שם לקוח/סכום/תיאור → create_deal
  • רשימת שמות/טלפונים → צור create_lead לכל שם
  • מסמך/הוראות → קרא וצא בהתאם
  • צילום מסך/אחר → תאר מה ראית ואז שאל שאלה אחת: "מה לעשות עם זה?"
חשוב: גם אם התמונה מטושטשת — נסה לחלץ מידע ודווח על מה שראית.

🎤 הקלטה קולית — תמלל ועבד בדיוק כאילו הוקלד.

=== 💼 יועץ עסקי — כיצד להגיב ===
• שאלות על מצב העסק → ניתוח מעמיק עם מספרים + השוואה לחודש קודם + המלצות קונקרטיות
• אחרי ביצוע פעולה → תובנה + דחיפה: "✅ בוצע! אגב, שמתי לב שיש ליד חם שעוד לא טיפלת בו"
• כשרואים בעיה → ישירות: "⚠️ 3 משימות באיחור! זה פוגע במכירות. בוא נעשה סדר."
• שאלות כלליות → ייעוץ כמו מאמן עסקי עם דוגמאות מעשיות מהנתונים שלך
• סיכום יומי/שבועי → הדגש הישגים + אתגרים + השוואה + 3 פעולות
• כשאין מה לעשות → הצע פעולה פרואקטיבית מבוססת נתונים

=== פעולות (type) ===

1. create_task — פעולה לביצוע (להתקשר, לפגוש, לשלוח, לעקוב, לתאם)
   { title, contactName?(שם מדויק מרשימת אנשי הקשר), dueDate?(YYYY-MM-DD), priority?("low"|"medium"|"high") }
   ← אם האדם קיים ברשימה — חובה לשים שמו ב-contactName.

2. create_contact — הוספת איש קשר חדש (שאינו ליד)
   { name, phone?, email?, type?("lead"|"customer"|"partner"|"vendor"), notes? }

3. create_deal — עסקה, מכירה, או סכום כסף
   { title, contactName?(שם מדויק), value?(number), stage?("lead"|"meeting"|"proposal"|"signed"|"active") }

4. create_lead — ליד/מתעניין חדש בלבד (שאינו קיים במערכת)
   { name, phone?, email?, source?("website"|"facebook"|"instagram"|"whatsapp"|"referral"|"manual"), notes? }
   ← לא לשימוש עבור אנשי קשר קיימים! לא לשימוש רק כי רוצים להתקשר (זה create_task)!

5. open_whatsapp — שליחת ווצאפ לאיש קשר קיים
   { contactName }

6. create_instructor — הוספת מדריך חדש
   { name, phone?, email?, programs?(מערך מחרוזות), hourlyRate?(number) }

7. create_salary — רישום שכר למדריך קיים
   { instructorName(שם מדויק), baseSalary(number), month?(1-12, ברירת מחדל ${nowMonth}), year?(YYYY, ברירת מחדל ${nowYear}), tax?, additions?, deductions?, nationalInsurance?, healthInsurance?, notes? }

=== 📊 פורמט תשובה מתקדם — blocks ===

בנוסף לשדה "response" (טקסט), אתה יכול להחזיר שדה "blocks" — מערך של בלוקים מובנים שהממשק יציג ויזואלית.

סוגי blocks:

1. kpi_row — שורת מדדים (2-5 מדדים):
   {"type":"kpi_row","data":{"items":[{"label":"הכנסות","value":"₪45,000","trend":"+12%","color":"green"},{"label":"רווח","value":"₪18,000","trend":"-5%","color":"red"}]}}

2. table — טבלה:
   {"type":"table","title":"לידים חמים","data":{"headers":["שם","מקור","ימים ללא מגע"],"rows":[["דנה לוי","פייסבוק","3"],["יוסי כהן","אתר","5"]]}}

3. alert — התראה:
   {"type":"alert","data":{"severity":"high","text":"5 משימות באיחור חמור!"}}
   severity: "high" (אדום) | "medium" (כתום) | "low" (צהוב)

4. suggestion — המלצה לפעולה:
   {"type":"suggestion","data":{"text":"כדאי להתקשר ל-3 הלידים החמים עכשיו","priority":"high"}}

5. comparison — השוואת תקופות:
   {"type":"comparison","title":"החודש מול חודש קודם","data":{"items":[{"label":"הכנסות","current":"₪45K","previous":"₪38K","delta":"+18%"},{"label":"רווח","current":"₪18K","previous":"₪20K","delta":"-10%"}]}}

כללים ל-blocks:
- השתמש ב-blocks כשמבקשים סיכום, ניתוח, מצב עסקי, או השוואה
- שים את הטקסט ב-response ואת הנתונים הויזואליים ב-blocks
- אם התשובה פשוטה (למשל "בוצע") — אין צורך ב-blocks
- blocks הם אופציונליים — אם לא רלוונטי, פשוט אל תכלול אותם

=== עקרונות ===
- בצע פעולה מיד לפי הבנתך. אל תשאל שאלות מיותרות.
- שאל רק אם חסר פרט קריטי שבלעדיו אי אפשר לבצע כלום (שאלה אחת קצרה).
- היה יועץ אמיתי: אחרי כל פעולה — הוסף תובנה + דחיפה לפעולה הבאה.
- תמיד חפש הזדמנות לייעץ, לעודד, ולדחוף למכירות. אתה לא בוט — אתה שותף עסקי.
- אם שואלים שאלה כללית — ענה כמו יועץ עסקי מנוסה, עם נתונים ודוגמאות מהעסק שלו.
- אם אין מה לעשות — אל תגיד "אין מה לעשות", תמצא משהו! תמיד יש מה לשפר.
- מחר = ${tomorrow}, היום = ${today}
- ענה בעברית בשדה "response"
- החזר JSON בלבד — ללא טקסט לפני או אחרי:
{"actions":[...],"response":"...","blocks":[...]}`
}

// ── Gemini multi-turn call ────────────────────────────────────────────────────

const DEFAULT_MODEL  = 'gemini-3-pro-preview'
const ALLOWED_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]

function buildContents(
  history: HistoryMsg[],
  userMsg: string,
  media?:  MediaCtx,
): unknown[] {
  const contents: unknown[] = []

  // Add conversation history (ensure alternating user/model)
  const filtered = history.filter(h => h.role === 'user' || h.role === 'agent')
  for (const h of filtered) {
    contents.push({
      role:  h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    })
  }

  // Add current user message (with optional media)
  const userParts: unknown[] = []
  if (media?.base64) {
    userParts.push({ inline_data: { mime_type: media.mimeType.split(';')[0], data: media.base64 } })
  }
  userParts.push({ text: userMsg })
  contents.push({ role: 'user', parts: userParts })

  return contents
}

async function callGemini(
  systemPrompt: string,
  history:      HistoryMsg[],
  userMsg:      string,
  media?:       MediaCtx,
  model:        string = DEFAULT_MODEL,
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('Missing secret: GEMINI_API_KEY is not set in Supabase Edge Function secrets')

  const contents = buildContents(history, userMsg, media)
  console.log('[crm-agent] model:', model, '| history turns:', history.length, '| hasMedia:', !!media?.base64)

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const r = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 4096 },
    }),
  })

  if (!r.ok) {
    const body = await r.text()
    console.error(`[crm-agent] Gemini HTTP ${r.status}:`, body.slice(0, 500))
    throw new Error(`Gemini ${r.status}: ${body.slice(0, 200)}`)
  }

  const b = await r.json()
  console.log('[crm-agent] Gemini finish_reason:', b.candidates?.[0]?.finishReason)

  const text = b.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    console.error('[crm-agent] Gemini empty text, full response:', JSON.stringify(b).slice(0, 500))
    throw new Error('Gemini returned no text content')
  }
  return text
}

// ── Action helpers ────────────────────────────────────────────────────────────

function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS })
  }
  if (req.method !== 'POST') return err('Method not allowed')

  try {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
    console.log('[crm-agent] jwt present:', !!jwt)

    const {
      message,
      context,
      image,
      audio,
      model: reqModel,
      history: reqHistory,
      businessSnapshot,
    } = await req.json() as {
      message:           string
      context?:          { contacts?: ContactCtx[]; instructors?: InstructorCtx[] }
      image?:            MediaCtx
      audio?:            MediaCtx
      model?:            string
      history?:          HistoryMsg[]
      businessSnapshot?: BusinessSnapshot
    }

    const media = audio || image  // audio takes priority
    if (!message?.trim()) return err('message is required')

    const model = ALLOWED_MODELS.includes(reqModel ?? '') ? reqModel! : DEFAULT_MODEL

    // Build supabase client (for action execution)
    const authHeader = jwt ? { Authorization: `Bearer ${jwt}` } : {}
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: authHeader }, auth: { autoRefreshToken: false, persistSession: false } },
    )

    const contacts    = (context?.contacts    ?? []) as ContactCtx[]
    const instructors = (context?.instructors ?? []) as InstructorCtx[]
    const history     = (reqHistory ?? []) as HistoryMsg[]
    const snapshot    = (businessSnapshot ?? {}) as BusinessSnapshot

    // ── Call Gemini ────────────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(contacts, instructors, snapshot)
    const raw = await callGemini(systemPrompt, history, message.trim(), media, model)

    let parsed: AIResponse
    try {
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(clean)
    } catch (parseErr) {
      console.error('[crm-agent] JSON parse failed:', String(parseErr))
      console.error('[crm-agent] raw output (first 500):', raw.slice(0, 500))
      // If Gemini returned plain text (e.g. a clarifying question), wrap it
      if (raw.length < 600 && !raw.startsWith('{')) {
        parsed = { actions: [], response: raw.trim() }
      } else {
        parsed = { actions: [], response: 'לא הצלחתי לעבד את הבקשה — נסה לנסח מחדש' }
      }
    }

    // ── Execute actions ────────────────────────────────────────────────────────
    const actions_taken: { type: string; summary: string; url?: string }[] = []

    const resolveId = (name?: string): string | null => {
      if (!name?.trim()) return null
      const n = name.trim().toLowerCase()
      const exact = contacts.find(c => c.name.trim().toLowerCase() === n)
      if (exact) return exact.id
      const partial = contacts.find(c => {
        const cn = c.name.trim().toLowerCase()
        return cn.includes(n) || n.includes(cn)
      })
      return partial?.id ?? null
    }

    const resolveInstructorId = (name?: string): string | null => {
      if (!name?.trim()) return null
      const n = name.trim().toLowerCase()
      const exact = instructors.find(i => i.name.trim().toLowerCase() === n)
      if (exact) return exact.id
      const partial = instructors.find(i => {
        const iname = i.name.trim().toLowerCase()
        return iname.includes(n) || n.includes(iname)
      })
      return partial?.id ?? null
    }

    for (const action of (parsed.actions ?? [])) {
      try {
        const d = action.data

        if (action.type === 'create_task') {
          const { error } = await supabase.from('tasks').insert({
            title:      d.title,
            contact_id: resolveId(d.contactName as string),
            due_date:   d.dueDate ?? null,
            priority:   d.priority ?? 'medium',
            completed:  false,
          })
          if (error) throw error
          actions_taken.push({ type: 'create_task', summary: `משימה: "${d.title}"` })

        } else if (action.type === 'create_contact') {
          const { error } = await supabase.from('contacts').insert({
            name:             d.name,
            phone:            d.phone ?? null,
            email:            (d.email as string)?.toLowerCase() ?? null,
            type:             d.type ?? 'lead',
            status:           'lead',
            notes:            [],
            activities:       [],
            tags:             [],
            active_programs:  [],
          })
          if (error) throw error
          actions_taken.push({ type: 'create_contact', summary: `איש קשר: "${d.name}"` })

        } else if (action.type === 'create_deal') {
          const { error } = await supabase.from('deals').insert({
            title:      d.title,
            contact_id: resolveId(d.contactName as string),
            value:      d.value ?? 0,
            stage:      d.stage ?? 'lead',
          })
          if (error) throw error
          actions_taken.push({
            type:    'create_deal',
            summary: `עסקה: "${d.title}"${d.value ? ` — ₪${Number(d.value).toLocaleString()}` : ''}`,
          })

        } else if (action.type === 'create_lead') {
          const { data: row, error: cErr } = await supabase.from('contacts').insert({
            name:             d.name,
            phone:            d.phone ?? null,
            email:            (d.email as string)?.toLowerCase() ?? null,
            source:           d.source ?? 'manual',
            lead_stage:       'new',
            status:           'lead',
            last_activity_at: new Date().toISOString(),
            notes:            [],
            activities:       [],
            tags:             [],
            active_programs:  [],
          }).select('id').single()
          if (cErr) throw cErr
          await supabase.from('tasks').insert({
            contact_id:     row.id,
            title:          `פולואפ עם ${d.name}`,
            priority:       'high',
            due_date:       addDays(2),
            completed:      false,
            auto_generated: true,
          })
          actions_taken.push({ type: 'create_lead', summary: `ליד: "${d.name}"` })

        } else if (action.type === 'open_whatsapp') {
          const contact = contacts.find(c =>
            c.name.trim().toLowerCase() === (d.contactName as string)?.trim().toLowerCase()
          )
          if (contact?.phone) {
            const wa = `https://wa.me/972${(contact.phone as string).replace(/^0/, '').replace(/\D/g, '')}`
            actions_taken.push({ type: 'open_whatsapp', summary: `ווצאפ: ${d.contactName}`, url: wa })
          } else {
            actions_taken.push({ type: 'open_whatsapp', summary: `לא נמצא מספר ל-${d.contactName}` })
          }

        } else if (action.type === 'create_instructor') {
          const { error } = await supabase.from('instructors').insert({
            name:        d.name,
            phone:       d.phone       ?? null,
            email:       (d.email as string)?.toLowerCase() ?? null,
            programs:    Array.isArray(d.programs) ? d.programs : [],
            hourly_rate: Number(d.hourlyRate) || 0,
            sessions:    [],
          })
          if (error) throw error
          actions_taken.push({ type: 'create_instructor', summary: `מדריך: "${d.name}"` })

        } else if (action.type === 'create_salary') {
          const instId = resolveInstructorId(d.instructorName as string)
          if (!instId) throw new Error(`מדריך לא נמצא: "${d.instructorName}"`)
          const now = new Date()
          const { error } = await supabase.from('salaries').insert({
            instructor_id:      instId,
            base_salary:        Number(d.baseSalary)        || 0,
            month:              Number(d.month)             || (now.getMonth() + 1),
            year:               Number(d.year)              || now.getFullYear(),
            tax:                Number(d.tax)               || 0,
            additions:          Number(d.additions)         || 0,
            deductions:         Number(d.deductions)        || 0,
            national_insurance: Number(d.nationalInsurance) || 0,
            health_insurance:   Number(d.healthInsurance)   || 0,
            notes:              d.notes                     ?? null,
          })
          if (error) throw error
          actions_taken.push({
            type:    'create_salary',
            summary: `שכר ${d.instructorName}: ₪${Number(d.baseSalary).toLocaleString()}`,
          })
        }
      } catch (e) {
        console.error(`[crm-agent] action ${action.type} failed:`, e)
        actions_taken.push({ type: action.type, summary: `שגיאה: ${String(e)}` })
      }
    }

    return ok({
      response:      parsed.response ?? 'בוצע',
      actions_taken,
      blocks:        parsed.blocks ?? [],
    })

  } catch (e) {
    const msg   = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack   : undefined
    console.error('[crm-agent] FATAL:', msg)
    if (stack) console.error('[crm-agent] stack:', stack)
    return err(msg)
  }
})

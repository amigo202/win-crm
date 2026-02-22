# WIN CRM — Data Model (Phase 0)

## ישויות ראשיות

### קיימות (Phase 0 — ללא שינוי)
| טבלה | תיאור |
|------|-------|
| `contacts` | אנשי קשר (בתי ספר, עיריות, מתנ"סים, מפיקים, תלמידים פרטיים) |
| `deals` | עסקאות בפייפליין (lead → meeting → proposal → signed → active → lost) |
| `tasks` | משימות עם עדיפות ותאריך יעד |
| `instructors` | מדריכים עם sessions ותעריף שעתי (JSONB) |
| `students` | תלמידים עם נוכחות ותשלום (JSONB) |

### חדשות (Phase 0 — scaffold)
| טבלה | תיאור | Bridge |
|------|-------|--------|
| `accounts` | ארגונים B2B (עתיד: מחליף contacts-as-orgs) | — |
| `employees` | מחליף instructors בטווח הארוך | → instructors.id |
| `activities` | מחליף contacts.activities JSONB | — |
| `activity_schedules` | לוחות זמנים חוזרים (חוגים) | — |
| `activity_participants` | תלמיד ↔ לוח זמנים (junction) | — |
| `sessions` | מפגש בודד (תאריך + שעות + מדריך) | → instructors.id |
| `attendance` | נוכחות תלמיד למפגש | — |
| `payments` | תשלומים (כל הזרועות) | → deals.id, contacts.id |
| `payroll_runs` | חישוב שכר חודשי | — |
| `payroll_lines` | שורה לעובד בתלוש (gross = hours × rate) | → employees.id / instructors.id |
| `alerts` | לוג התראות פרסיסטנטי | — |
| `calendar_links` | קישורי Google Calendar | → contacts.id / activity_schedules.id |
| `calendar_event_map` | sessions ↔ calendar events | → sessions.id |
| `threads` | שרשורי הודעות (scaffold) | → contacts.id |
| `messages` | הודעות בשרשור (scaffold) | → threads.id |

## אסטרטגיית מעבר (JSONB → טבלאות נורמליות)

Phase 0 יוצר את הטבלאות הנורמליות אך **לא מעביר נתונים**. כל JSONB קיים ממשיך לפעול:

- `contacts.activities` → עתיד: `activities` table
- `instructors.sessions` → עתיד: `sessions` table (עם `instructor_id` bridge)
- `students.attendance` → עתיד: `attendance` table

Phase 1: migration script יעביר JSONB → rows.

## RLS

כל הטבלאות: `FOR ALL TO authenticated USING (true)` — CRM לצוות אחד.
עמודות `user_id` / `created_by` קיימות כ-scaffold למולטי-טנאנט בעתיד.

## זרועות עסקיות ↔ ישויות

| זרוע | ישות מרכזית | Phase |
|------|-------------|-------|
| חוגים | `activity_schedules` + `sessions` + `attendance` | 1 |
| סדנאות/הרצאות | `deals` + `activities` + `payments` | 1 |
| PixMix | `deals` (stage=pixmix) + `payments` | 2 |
| אלומה (SaaS) | `accounts` + `deals` + `payments` | 2 |

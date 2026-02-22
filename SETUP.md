# WIN CRM – הגדרת Supabase

## שלב 1 – הפעל את סכמת ה-DB

1. כנס ל-[Supabase Dashboard](https://supabase.com/dashboard)
2. בחר את הפרויקט: `okxuuchzamgohrgmwgbe`
3. עבור אל **SQL Editor** (בסרגל הצד)
4. לחץ **New query**
5. העתק את התוכן של `schema.sql` (קובץ בתיקייה זו) → הדבק → לחץ **Run**
6. אמורות להיווצר 5 טבלאות: `contacts`, `deals`, `tasks`, `instructors`, `students`

## שלב 2 – צור משתמש לכניסה

1. עבור אל **Authentication → Users** בדשבורד
2. לחץ **Add user → Create new user**
3. הכנס:
   - Email: `amitai@wincrm.co.il` (או כל כתובת שתרצה)
   - Password: סיסמה חזקה לפי בחירתך
4. לחץ **Create user**

## שלב 3 – פתח את הקובץ

פתח את `win-crm.html` בדפדפן (Chrome / Edge מומלץ).

יופיע מסך כניסה → הכנס את האימייל והסיסמה שיצרת בשלב 2.

---

## פריסה ל-Netlify (אופציונלי)

1. גרור את התיקייה `crm-app` לאתר [netlify.com/drop](https://app.netlify.com/drop)
2. Netlify יפרוס אוטומטית ויתן לך כתובת URL

> **חשוב**: הנתונים נשמרים ב-Supabase בענן –
> ניתן לגשת מכל מכשיר עם אותה כתובת URL.

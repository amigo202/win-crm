export const PROGRAMS = ['WIN ENGLISH', 'WIN TECH', 'AMIT-AI', 'PixMix', 'WIN CAMP', 'אלומה']

export const CONTACT_TYPES = [
  { id: 'school',         label: 'בית ספר',      icon: '🏫', badge: 'b-blue' },
  { id: 'municipality',   label: 'עירייה',        icon: '🏛️', badge: 'b-yellow' },
  { id: 'community',      label: 'מתנ"ס',         icon: '🏘️', badge: 'b-green' },
  { id: 'event_producer', label: 'מפיק אירועים',  icon: '🎭', badge: 'b-purple' },
  { id: 'private_student',label: 'תלמיד פרטי',   icon: '👦', badge: 'b-orange' },
]

export const STATUS_OPTS = [
  { value: 'lead',     label: 'ליד',      badge: 'b-yellow' },
  { value: 'prospect', label: 'פרוספקט', badge: 'b-blue' },
  { value: 'customer', label: 'פעיל',    badge: 'b-green' },
  { value: 'inactive', label: 'לא פעיל', badge: 'b-gray' },
]

export const STAGES = [
  { id: 'lead',     label: 'ליד',  color: '#94a3b8' },
  { id: 'meeting',  label: 'פגישה', color: '#3b82f6' },
  { id: 'proposal', label: 'הצעה', color: '#f59e0b' },
  { id: 'signed',   label: 'חתום', color: '#10b981' },
  { id: 'active',   label: 'פעיל', color: '#f97316' },
  { id: 'lost',     label: 'הפסד', color: '#ef4444' },
]

export const PRIORITIES = [
  { value: 'high',   label: 'גבוהה',   badge: 'b-red' },
  { value: 'medium', label: 'בינונית', badge: 'b-yellow' },
  { value: 'low',    label: 'נמוכה',   badge: 'b-green' },
]

export const TAG_COLORS = [
  { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  { bg: '#ffedd5', text: '#c2410c', dot: '#f97316' },
  { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
]

export const PAY_STATUS = [
  { value: 'paid',    label: 'שולם',  badge: 'b-green' },
  { value: 'pending', label: 'ממתין', badge: 'b-yellow' },
  { value: 'overdue', label: 'באיחור', badge: 'b-red' },
]

export const LEAD_STAGES = [
  { id: 'new',       label: 'חדש',     color: '#3b82f6', bg: '#dbeafe',  badge: 'b-blue'   },
  { id: 'contacted', label: 'פנינו',   color: '#8b5cf6', bg: '#ede9fe',  badge: 'b-purple' },
  { id: 'qualified', label: 'מוסמך',   color: '#f59e0b', bg: '#fef3c7',  badge: 'b-yellow' },
  { id: 'proposal',  label: 'הצעה',    color: '#f97316', bg: '#ffedd5',  badge: 'b-orange' },
  { id: 'won',       label: 'סגרנו ✓', color: '#10b981', bg: '#d1fae5',  badge: 'b-green'  },
  { id: 'lost',      label: 'הפסדנו',  color: '#ef4444', bg: '#fee2e2',  badge: 'b-red'    },
]

export const LEAD_SOURCES = [
  { id: 'website',   label: 'אתר',      icon: '🌐' },
  { id: 'whatsapp',  label: 'WhatsApp', icon: '💬' },
  { id: 'facebook',  label: 'פייסבוק',  icon: '📘' },
  { id: 'instagram', label: 'אינסטגרם', icon: '📸' },
  { id: 'referral',  label: 'המלצה',    icon: '🤝' },
  { id: 'manual',    label: 'ידני',     icon: '✍️'  },
  { id: 'csv',       label: 'CSV',      icon: '📄' },
]

export const ACTIVITY_TYPES = [
  { id: 'note',         label: 'הערה',        icon: '📝' },
  { id: 'call',         label: 'שיחה',        icon: '📞' },
  { id: 'meeting',      label: 'פגישה',       icon: '🤝' },
  { id: 'email',        label: 'אימייל',      icon: '✉️'  },
  { id: 'stage_change', label: 'שינוי שלב',   icon: '🔄' },
  { id: 'task_created', label: 'משימה נוצרה', icon: '📋' },
  { id: 'lead_created', label: 'ליד נכנס',    icon: '🎯' },
]

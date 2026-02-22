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

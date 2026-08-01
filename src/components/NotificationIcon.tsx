import {
  Bell,
  CalendarPlus,
  CalendarX,
  CalendarOff,
  CalendarCheck,
  UserPlus,
  CheckCircle2,
  ArrowLeftRight,
  XCircle,
  Clock,
  Lock,
  LockOpen,
  AlarmClock,
  Moon,
  CalendarRange,
} from 'lucide-react';

/**
 * Correspondance « type de notification » → pictogramme. Extraite de
 * `NotificationsBell` car cette table est longue et purement déclarative :
 * l'isoler garde le composant lisible et évite d'y importer 14 icônes.
 */
export function iconFor(type: string) {
  switch (type) {
    case 'shift_assigned':
      return <CalendarPlus className="size-4 text-teal-600" />;
    case 'shift_removed':
      return <CalendarX className="size-4 text-red-500" />;
    case 'leave_added':
      return <CalendarOff className="size-4 text-violet-600" />;
    case 'leave_removed':
      return <CalendarCheck className="size-4 text-teal-600" />;
    case 'hnc_added':
      return <Clock className="size-4 text-sky-600" />;
    case 'swap_offer':
      return <ArrowLeftRight className="size-4 text-amber-600" />;
    case 'swap_accepted':
      return <CheckCircle2 className="size-4 text-teal-600" />;
    case 'swap_declined':
      return <XCircle className="size-4 text-red-500" />;
    case 'shift_reminder':
      return <AlarmClock className="size-4 text-teal-600" />;
    case 'night_reminder':
      return <Moon className="size-4 text-indigo-500" />;
    case 'weekly_digest':
      return <CalendarRange className="size-4 text-teal-600" />;
    case 'month_locked':
      return <Lock className="size-4 text-slate-500" />;
    case 'month_unlocked':
      return <LockOpen className="size-4 text-teal-600" />;
    case 'approval_request':
      return <UserPlus className="size-4 text-amber-600" />;
    case 'approved':
      return <CheckCircle2 className="size-4 text-teal-600" />;
    default:
      return <Bell className="size-4 text-slate-400" />;
  }
}

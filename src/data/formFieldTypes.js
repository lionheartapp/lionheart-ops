/**
 * Form builder: field type icons and metadata helpers.
 * Field labels and default props live in formsData (FIELD_CATEGORIES, createField).
 */
import {
  Type,
  AlignLeft,
  Mail,
  Phone,
  Hash,
  ChevronDown,
  Circle,
  CheckSquare,
  PenTool,
  EyeOff,
  Layers,
  Table as TableIcon,
  Calendar,
  CalendarClock,
  ToggleLeft,
  ListChecks,
  Users,
  Paperclip,
  Image,
  SlidersHorizontal,
} from 'lucide-react'

/** Map field type id to Lucide icon component for palette and canvas */
export const FIELD_TYPE_ICONS = {
  section: Layers,
  table: TableIcon,
  text: Type,
  textarea: AlignLeft,
  email: Mail,
  phone: Phone,
  number: Hash,
  date: Calendar,
  datetime: CalendarClock,
  yesno: ToggleLeft,
  dropdown: ChevronDown,
  checkbox: CheckSquare,
  checklist: ListChecks,
  radio: Circle,
  profiles: Users,
  attachment: Paperclip,
  image: Image,
  slider: SlidersHorizontal,
  signature: PenTool,
  hidden: EyeOff,
}

export function getFieldIcon(type) {
  return FIELD_TYPE_ICONS[type] || Type
}

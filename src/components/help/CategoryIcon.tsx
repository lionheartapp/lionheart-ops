import {
  BookOpen,
  Wrench,
  Calendar,
  Building2,
  Boxes,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { HelpCategory } from '@/lib/help/types'

const ICONS: Record<HelpCategory['icon'], LucideIcon> = {
  BookOpen,
  Wrench,
  Calendar,
  Building2,
  Boxes,
  ShieldCheck,
  Sparkles,
}

interface CategoryIconProps {
  name: HelpCategory['icon']
  className?: string
  'aria-hidden'?: boolean
}

export function CategoryIcon({ name, className, ...rest }: CategoryIconProps) {
  const Icon = ICONS[name]
  return <Icon className={className} aria-hidden {...rest} />
}

import { WifiOff } from 'lucide-react'

interface OfflineBadgeProps {
  className?: string
}

export function OfflineBadge({ className }: OfflineBadgeProps) {
  return (
    <span className={`text-xs text-gray-500 flex items-center gap-1 ${className ?? ''}`}>
      <WifiOff className="w-3 h-3" />
      <span>Cached</span>
    </span>
  )
}

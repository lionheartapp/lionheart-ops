'use client'

interface ErrorAlertProps {
  message: string
  variant?: 'banner' | 'inline'
  className?: string
}

export default function ErrorAlert({
  message,
  variant = 'banner',
  className = '',
}: ErrorAlertProps) {
  if (variant === 'inline') {
    return (
      <p className={`text-sm text-red-700 ${className}`} role="alert">
        {message}
      </p>
    )
  }

  return (
    <div
      className={`rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`}
      role="alert"
    >
      {message}
    </div>
  )
}

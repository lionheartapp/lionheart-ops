'use client'

import { type ReactNode, type ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  size?: 'sm' | 'md'
  variant?: 'primary' | 'secondary'
  children?: ReactNode
}

const sizeClasses = { sm: 'px-2 py-1.5 text-sm', md: 'px-3 py-2 text-sm' }
const variantClasses = {
  primary: 'bg-blue-600 text-white border-transparent hover:bg-blue-700',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
}

export default function Button({
  icon,
  size = 'md',
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

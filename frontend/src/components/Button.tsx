import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/ui'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'sm'

export function buttonStyles(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-300 ease-base active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
    size === 'md' ? 'button-md px-3 py-2' : 'button-sm px-3 py-1',
    variant === 'primary' && 'bg-ink-900 text-paper-50 hover:bg-ink-800',
    variant === 'secondary' &&
      'border border-paper-300 bg-paper-0 text-ink-900 hover:border-ink-400 hover:bg-paper-100',
    variant === 'ghost' && 'text-ink-700 hover:bg-paper-100 hover:text-ink-900',
    'focus-ring',
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={buttonStyles(variant, size, className)} {...props} />
}

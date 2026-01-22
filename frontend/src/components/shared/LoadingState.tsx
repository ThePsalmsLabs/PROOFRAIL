import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-brand-500`} />
      {message && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{message}</p>
      )}
    </div>
  )
}

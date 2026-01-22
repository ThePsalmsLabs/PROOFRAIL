interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
        {icon}
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          {title}
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
          {description}
        </p>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

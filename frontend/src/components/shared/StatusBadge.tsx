import { Badge } from '@/components/ui/Badge'
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'

interface StatusBadgeProps {
  status: 'open' | 'executed' | 'cancelled' | 'expired'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    open: {
      variant: 'primary' as const,
      label: 'Open',
      icon: <Clock className="h-3 w-3" />,
    },
    executed: {
      variant: 'success' as const,
      label: 'Executed',
      icon: <CheckCircle className="h-3 w-3" />,
    },
    cancelled: {
      variant: 'error' as const,
      label: 'Cancelled',
      icon: <XCircle className="h-3 w-3" />,
    },
    expired: {
      variant: 'warning' as const,
      label: 'Expired',
      icon: <AlertCircle className="h-3 w-3" />,
    },
  }

  const config = statusConfig[status]

  return (
    <Badge variant={config.variant} className="inline-flex items-center gap-1">
      {config.icon}
      {config.label}
    </Badge>
  )
}

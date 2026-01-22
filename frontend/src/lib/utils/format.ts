export function formatUSDCx(microAmount: number): string {
  return (microAmount / 1_000_000).toFixed(2) + ' USDCx'
}

export function formatAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

export function formatBlockHeight(height: number): string {
  return height.toLocaleString()
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

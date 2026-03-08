import { Images, HardDrive, Eye, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useActiveAccount, useCurrentImages } from '@/lib/store'
import { formatBytes } from '@/lib/utils'

export function StatsCards() {
  const account = useActiveAccount()
  const images = useCurrentImages()

  if (!account) return null

  const publicCount = images.filter((i) => i.isPublic).length
  const privateCount = images.filter((i) => !i.isPublic).length
  const storagePercent = Math.round((account.storageUsed / account.storageLimit) * 100)

  const stats = [
    {
      title: 'Total Images',
      value: images.length,
      icon: Images,
      description: `Stored in ${account.name}`,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Storage Used',
      value: formatBytes(account.storageUsed),
      icon: HardDrive,
      description: `${storagePercent}% of ${formatBytes(account.storageLimit)}`,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      progress: storagePercent,
    },
    {
      title: 'Public Images',
      value: publicCount,
      icon: Eye,
      description: 'Publicly accessible',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Private Images',
      value: privateCount,
      icon: Lock,
      description: 'Access restricted',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`rounded-md p-2 ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            {stat.progress !== undefined && (
              <Progress value={stat.progress} className="mt-2 h-1.5" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

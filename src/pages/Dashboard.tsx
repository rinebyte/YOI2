import { Header } from '@/components/layout/Header'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { UploadZone } from '@/components/dashboard/UploadZone'
import { ImageGrid } from '@/components/dashboard/ImageGrid'
import { useActiveAccount } from '@/lib/store'

export function Dashboard() {
  const account = useActiveAccount()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header title="Dashboard" showSearch />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="text-muted-foreground">
            {account
              ? <>Managing images for <span className="font-medium text-foreground">{account.name}</span> · {account.email}</>
              : 'Select an account to get started.'}
          </p>
        </div>
        <StatsCards />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h3 className="text-sm font-medium mb-3">Upload Images</h3>
            <UploadZone />
          </div>
          <div className="lg:col-span-2">
            <h3 className="text-sm font-medium mb-3">Recent Images</h3>
            <ImageGrid />
          </div>
        </div>
      </div>
    </div>
  )
}

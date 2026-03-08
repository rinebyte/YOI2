import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Images, HardDrive, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActiveAccount } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { formatBytes } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

const ADMIN_EMAIL = 'rinezpz@gmail.com'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/gallery', label: 'Gallery', icon: Images },
]

export function Sidebar() {
  const account = useActiveAccount()
  const user = useAuthStore((s) => s.user)
  const storagePercent = account
    ? Math.round((account.storageUsed / account.storageLimit) * 100)
    : 0

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <HardDrive className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold">YOI2</span>
      </div>

      {/* User info */}
      {user && (
        <div className="p-3 border-b">
          <div className="flex items-center gap-3 px-2 py-1">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name ?? user.email}
                className="h-8 w-8 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: account?.color ?? '#6366f1' }}
              >
                {(user.name ?? user.email).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                  : 'text-muted-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}

        {/* Admin link — only visible to the admin user */}
        {user?.email === ADMIN_EMAIL && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                  : 'text-muted-foreground'
              )
            }
          >
            <Shield className="h-4 w-4" />
            Admin
          </NavLink>
        )}
      </nav>

      {/* Storage usage */}
      {account && (
        <div className="border-t p-4">
          <Progress value={storagePercent} className="h-1.5 mb-1" />
          <p className="text-xs text-muted-foreground">
            {formatBytes(account.storageUsed)} / {formatBytes(account.storageLimit)}
          </p>
        </div>
      )}
    </aside>
  )
}

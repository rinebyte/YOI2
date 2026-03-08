import { useNavigate } from 'react-router-dom'
import { HardDrive, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/auth-store'
import { supabase } from '@/lib/supabase-client'

interface PendingApprovalProps {
  status: 'pending' | 'rejected'
}

export function PendingApproval({ status }: PendingApprovalProps) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isPending = status === 'pending'

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <HardDrive className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ImageVault</h1>
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-3">
              {isPending ? (
                <Clock className="h-12 w-12 text-amber-500" />
              ) : (
                <XCircle className="h-12 w-12 text-destructive" />
              )}
            </div>

            {/* User avatar + info */}
            {user && (
              <div className="flex flex-col items-center gap-2 mb-2">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name ?? user.email}
                    className="h-12 w-12 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {(user.name ?? user.email).charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  {user.name && <p className="text-sm font-medium">{user.name}</p>}
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            )}

            <CardTitle className="text-lg">
              {isPending ? 'Account Pending Approval' : 'Account Access Denied'}
            </CardTitle>
            <CardDescription>
              {isPending
                ? 'Your account request has been received and is awaiting review by an administrator. You will be able to sign in once approved.'
                : 'Your account request has been reviewed and access has been denied. Please contact the administrator if you believe this is a mistake.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {isPending
            ? 'This page will update automatically once your account is approved.'
            : 'Signed in as a different account? Sign out and try again.'}
        </p>
      </div>
    </div>
  )
}

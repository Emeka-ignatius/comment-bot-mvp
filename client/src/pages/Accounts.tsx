import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { Loader2, Trash2, Plus, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CookieInputHelper } from '@/components/CookieInputHelper';

export default function Accounts() {
  const { data: accounts, isLoading, refetch } = trpc.accounts.list.useQuery();
  const createMutation = trpc.accounts.create.useMutation();
  const deleteMutation = trpc.accounts.delete.useMutation();

  const [formData, setFormData] = useState({
    platform: 'youtube' as 'youtube' | 'rumble',
    accountName: '',
    cookies: '',
  });
  const [showCookieHelper, setShowCookieHelper] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | 'rumble'>('rumble');

  const handleCreate = async () => {
    if (!formData.accountName || !formData.cookies) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await createMutation.mutateAsync(formData);
      toast.success('Account created successfully');
      setFormData({ platform: 'youtube', accountName: '', cookies: '' });
      refetch();
    } catch (error) {
      toast.error('Failed to create account');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Account deleted successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Account Management</h1>

        {/* Create Account Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Add New Account</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a platform and follow the guided setup to add your account
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => {
                  setSelectedPlatform('rumble');
                  setShowCookieHelper(true);
                }}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
              >
                <div className="text-2xl">🎥</div>
                <div className="font-semibold">Add Rumble Account</div>
              </Button>
              <Button
                onClick={() => {
                  setSelectedPlatform('youtube');
                  setShowCookieHelper(true);
                }}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
              >
                <div className="text-2xl">▶️</div>
                <div className="font-semibold">Add YouTube Account</div>
              </Button>
            </div>
          </div>
        </Card>

        {showCookieHelper && (
          <CookieInputHelper
            platform={selectedPlatform}
            onSuccess={async (cookies, accountName) => {
              try {
                await createMutation.mutateAsync({
                  platform: selectedPlatform,
                  accountName: accountName || `${selectedPlatform} Account`,
                  cookies,
                });
                toast.success('Account added successfully!');
                refetch();
                setShowCookieHelper(false);
              } catch (error) {
                toast.error('Failed to add account');
              }
            }}
            onCancel={() => setShowCookieHelper(false)}
          />
        )}

        {/* Accounts List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Your Accounts</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : accounts && accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((account) => {
                // Calculate cookie expiration
                const expiresAt = account.cookieExpiresAt ? new Date(account.cookieExpiresAt) : null;
                const now = new Date();
                const daysUntilExpiry = expiresAt ? Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry < 7;
                const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
                
                return (
                  <div key={account.id} className="flex items-center justify-between p-4 bg-accent rounded border-l-4" style={{
                    borderLeftColor: isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : '#22c55e'
                  }}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{account.accountName}</p>
                        {isExpired && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Expired
                          </span>
                        )}
                        {isExpiringSoon && !isExpired && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Expires in {daysUntilExpiry} days
                          </span>
                        )}
                        {!isExpiringSoon && !isExpired && daysUntilExpiry !== null && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full flex items-center gap-1">
                            <CheckCircle size={12} />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {account.platform === 'youtube' ? '🎬 YouTube' : '🎥 Rumble'}
                        {daysUntilExpiry !== null && !isExpired && (
                          <span className="ml-2">• {daysUntilExpiry} days remaining</span>
                        )}
                      </p>
                      {account.lastSuccessfulSubmission && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last used: {new Date(account.lastSuccessfulSubmission).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(isExpired || isExpiringSoon) && (
                        <Button
                          onClick={() => {
                            setSelectedPlatform(account.platform);
                            setShowCookieHelper(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <RefreshCw size={14} />
                          Refresh Cookies
                        </Button>
                      )}
                      <button
                        onClick={() => handleDelete(account.id)}
                        disabled={deleteMutation.isPending}
                        className="p-2 hover:bg-destructive rounded text-muted-foreground hover:text-destructive-foreground"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">No accounts yet. Add one to get started.</p>
          )}
        </Card>
      </div>
    </AdminDashboardLayout>
  );
}

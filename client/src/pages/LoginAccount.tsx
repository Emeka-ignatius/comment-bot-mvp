import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { Loader2, Trash2, AlertTriangle, RefreshCw, CheckCircle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { CookieInputHelper } from '@/components/CookieInputHelper';

interface EditAccountData {
  id: number;
  accountName: string;
  cookies: string;
  proxy?: string;
  platform: 'youtube' | 'rumble';
}

export default function LoginAccount() {
  const { data: accounts, isLoading, refetch } = trpc.accounts.list.useQuery();
  const createMutation = trpc.accounts.create.useMutation();
  const updateMutation = trpc.accounts.update.useMutation();
  const deleteMutation = trpc.accounts.delete.useMutation();

  const [showCookieHelper, setShowCookieHelper] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | 'rumble'>('rumble');
  
  // Edit modal state
  const [editAccount, setEditAccount] = useState<EditAccountData | null>(null);
  const [editName, setEditName] = useState('');
  const [editCookies, setEditCookies] = useState('');
  const [editProxy, setEditProxy] = useState('');
  const [updateCookies, setUpdateCookies] = useState(false);

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

  const openEditModal = (account: EditAccountData) => {
    setEditAccount(account);
    setEditName(account.accountName);
    setEditCookies('');
    setEditProxy(account.proxy || '');
    setUpdateCookies(false);
  };

  const closeEditModal = () => {
    setEditAccount(null);
    setEditName('');
    setEditCookies('');
    setEditProxy('');
    setUpdateCookies(false);
  };

  const handleUpdate = async () => {
    if (!editAccount) return;

    try {
      const updateData: { id: number; accountName?: string; cookies?: string; proxy?: string; cookieExpiresAt?: Date } = {
        id: editAccount.id,
      };

      // Only update name if changed
      if (editName !== editAccount.accountName) {
        updateData.accountName = editName;
      }

      // Only update proxy if changed
      if (editProxy !== (editAccount.proxy || '')) {
        updateData.proxy = editProxy;
      }

      // Only update cookies if user chose to and provided new ones
      if (updateCookies && editCookies.trim()) {
        updateData.cookies = editCookies.trim();
        // Reset cookie expiration to 30 days from now
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30);
        updateData.cookieExpiresAt = expirationDate;
      }

      await updateMutation.mutateAsync(updateData);
      toast.success('Account updated successfully!');
      refetch();
      closeEditModal();
    } catch (error) {
      toast.error('Failed to update account');
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
              Select a platform to add your account. You'll need the Cookie-Editor browser extension to export your login cookies.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => {
                  setSelectedPlatform('rumble');
                  setShowCookieHelper(true);
                }}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5"
              >
                <div className="text-3xl">🎥</div>
                <div className="font-semibold">Add Rumble Account</div>
              </Button>
              <Button
                onClick={() => {
                  setSelectedPlatform('youtube');
                  setShowCookieHelper(true);
                }}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5"
              >
                <div className="text-3xl">▶️</div>
                <div className="font-semibold">Add YouTube Account</div>
              </Button>
            </div>
          </div>
        </Card>

        {showCookieHelper && (
          <CookieInputHelper
            platform={selectedPlatform}
            onSuccess={async (cookies, accountName, proxy) => {
              try {
                await createMutation.mutateAsync({
                  platform: selectedPlatform,
                  accountName: accountName || `${selectedPlatform} Account`,
                  cookies,
                  proxy,
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

        {/* Edit Account Modal */}
        <Dialog open={!!editAccount} onOpenChange={(open) => !open && closeEditModal()}>
          <DialogContent className="w-[95vw] sm:w-full sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
              <DialogDescription>
                Update account name or refresh cookies
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">Account Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Account name"
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">Proxy (Optional)</label>
                <Input
                  value={editProxy}
                  onChange={(e) => setEditProxy(e.target.value)}
                  placeholder="protocol://user:pass@host:port"
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updateCookies"
                    checked={updateCookies}
                    onChange={(e) => setUpdateCookies(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="updateCookies" className="text-xs sm:text-sm font-medium cursor-pointer">
                    Update cookies (refresh session)
                  </label>
                </div>
                
                {updateCookies && (
                  <div className="space-y-2 mt-3 p-2 sm:p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Paste new cookies from Cookie-Editor extension (Export → Header String)
                    </p>
                    <Textarea
                      value={editCookies}
                      onChange={(e) => setEditCookies(e.target.value)}
                      placeholder="Paste new cookies here..."
                      rows={3}
                      className="font-mono text-xs resize-none overflow-auto max-h-[150px] w-full break-all"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
              <Button variant="outline" onClick={closeEditModal} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button 
                onClick={handleUpdate}
                disabled={updateMutation.isPending || (updateCookies && !editCookies.trim())}
                className="w-full sm:w-auto"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="animate-spin mr-2" size={16} />
                ) : null}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
                  <div key={account.id} className="flex items-center justify-between p-4 bg-accent rounded-lg border-l-4" style={{
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
                        {account.proxy && (
                          <span className="ml-2">• 🌐 Proxy active</span>
                        )}
                      </p>
                      {account.lastSuccessfulSubmission && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last used: {new Date(account.lastSuccessfulSubmission).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => openEditModal({
                          id: account.id,
                          accountName: account.accountName,
                          cookies: account.cookies,
                          platform: account.platform,
                        })}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Pencil size={14} />
                        Edit
                      </Button>
                      {(isExpired || isExpiringSoon) && (
                        <Button
                          onClick={() => openEditModal({
                            id: account.id,
                            accountName: account.accountName,
                            cookies: account.cookies,
                            platform: account.platform,
                          })}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1 border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                        >
                          <RefreshCw size={14} />
                          Refresh
                        </Button>
                      )}
                      <button
                        onClick={() => handleDelete(account.id)}
                        disabled={deleteMutation.isPending}
                        className="p-2 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No accounts yet. Add one to get started.</p>
              <p className="text-sm text-muted-foreground">
                💡 Tip: You'll need the <strong>Cookie-Editor</strong> browser extension to export your login cookies.
              </p>
            </div>
          )}
        </Card>
      </div>
    </AdminDashboardLayout>
  );
}

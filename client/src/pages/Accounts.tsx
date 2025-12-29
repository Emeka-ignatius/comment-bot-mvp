import AdminDashboardLayout from '@/components/AdminDashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Accounts() {
  const { data: accounts, isLoading, refetch } = trpc.accounts.list.useQuery();
  const createMutation = trpc.accounts.create.useMutation();
  const deleteMutation = trpc.accounts.delete.useMutation();

  const [formData, setFormData] = useState({
    platform: 'youtube' as 'youtube' | 'rumble',
    accountName: '',
    cookies: '',
  });

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Platform</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value as 'youtube' | 'rumble' })}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                >
                  <option value="youtube">YouTube</option>
                  <option value="rumble">Rumble</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Account Name</label>
                <Input
                  type="text"
                  placeholder="My YouTube Account"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Cookies (JSON)</label>
              <textarea
                placeholder='{"cookie_name": "cookie_value"}'
                value={formData.cookies}
                onChange={(e) => setFormData({ ...formData, cookies: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground h-24 font-mono text-sm"
              />
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />}
              Add Account
            </Button>
          </div>
        </Card>

        {/* Accounts List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Your Accounts</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : accounts && accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-4 bg-accent rounded">
                  <div>
                    <p className="font-medium text-foreground">{account.accountName}</p>
                    <p className="text-sm text-muted-foreground">
                      {account.platform === 'youtube' ? '🎬 YouTube' : '🎥 Rumble'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(account.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 hover:bg-destructive rounded text-muted-foreground hover:text-destructive-foreground"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No accounts yet. Add one to get started.</p>
          )}
        </Card>
      </div>
    </AdminDashboardLayout>
  );
}

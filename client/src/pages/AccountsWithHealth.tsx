import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Loader2, AlertCircle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

export default function AccountsWithHealth() {
  const [platform, setPlatform] = useState<'youtube' | 'rumble'>('rumble');
  const [accountName, setAccountName] = useState('');
  const [cookies, setCookies] = useState('');
  const [cookieExpiresAt, setCookieExpiresAt] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const accountsQuery = trpc.accounts.list.useQuery();
  const accountHealthQuery = trpc.accounts.health.useQuery(
    { id: selectedAccountId! },
    { enabled: selectedAccountId !== null }
  );
  const createAccountMutation = trpc.accounts.create.useMutation();
  const deleteAccountMutation = trpc.accounts.delete.useMutation();

  const accounts = accountsQuery.data || [];
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const health = accountHealthQuery.data;

  const handleCreateAccount = async () => {
    if (!accountName || !cookies) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await createAccountMutation.mutateAsync({
        platform,
        accountName,
        cookies,
        cookieExpiresAt: cookieExpiresAt ? new Date(cookieExpiresAt) : undefined,
      });
      toast.success('Account created successfully');
      setAccountName('');
      setCookies('');
      setCookieExpiresAt('');
      accountsQuery.refetch();
    } catch (error) {
      toast.error('Failed to create account');
      console.error(error);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      await deleteAccountMutation.mutateAsync({ id });
      toast.success('Account deleted');
      setSelectedAccountId(null);
      accountsQuery.refetch();
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'warning':
        return <Clock className="w-4 h-4" />;
      case 'critical':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account Management</h1>
        <p className="text-gray-600 mt-2">Manage YouTube and Rumble accounts with health monitoring</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Account Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Add New Account</CardTitle>
            <CardDescription>Create a new account with cookies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={(v: any) => setPlatform(v)}>
                <SelectTrigger id="platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="rumble">Rumble</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                placeholder="My Account"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="cookies">Cookies (raw string)</Label>
              <textarea
                id="cookies"
                placeholder="Paste cookies from browser dev tools"
                value={cookies}
                onChange={e => setCookies(e.target.value)}
                className="w-full h-24 px-3 py-2 border border-input rounded-md text-sm"
              />
            </div>

            <div>
              <Label htmlFor="cookieExpiresAt">Cookie Expiration (optional)</Label>
              <Input
                id="cookieExpiresAt"
                type="datetime-local"
                value={cookieExpiresAt}
                onChange={e => setCookieExpiresAt(e.target.value)}
              />
            </div>

            <Button
              onClick={handleCreateAccount}
              disabled={createAccountMutation.isPending}
              className="w-full"
            >
              {createAccountMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Account
            </Button>
          </CardContent>
        </Card>

        {/* Accounts List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your Accounts</CardTitle>
            <CardDescription>{accounts.length} accounts total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {accounts.length === 0 ? (
                <p className="text-sm text-gray-500">No accounts yet. Add one to get started.</p>
              ) : (
                accounts.map(account => (
                  <div
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAccountId === account.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{account.accountName}</p>
                        <p className="text-xs text-gray-500">{account.platform.toUpperCase()}</p>
                      </div>
                      <Badge variant="outline">{account.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Health Details */}
      {selectedAccount && health && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedAccount.accountName} - Health Report</CardTitle>
                <CardDescription>{selectedAccount.platform.toUpperCase()} Account</CardDescription>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getHealthColor(health.healthStatus)}`}>
                {getHealthIcon(health.healthStatus)}
                <span className="font-semibold text-sm capitalize">{health.healthStatus}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Success Rate */}
              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-semibold text-gray-700">Success Rate</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{health.successRate}%</p>
                <p className="text-xs text-gray-600 mt-1">
                  {health.totalSuccessfulJobs}/{health.totalJobs} jobs
                </p>
              </div>

              {/* Successful Jobs */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">Successful</p>
                <p className="text-2xl font-bold text-blue-600">{health.totalSuccessfulJobs}</p>
                <p className="text-xs text-gray-600 mt-1">completed jobs</p>
              </div>

              {/* Failed Jobs */}
              <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">Failed</p>
                <p className="text-2xl font-bold text-red-600">{health.totalFailedJobs}</p>
                <p className="text-xs text-gray-600 mt-1">failed jobs</p>
              </div>

              {/* Cookie Expiration */}
              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">Cookie Status</p>
                {health.daysUntilExpiration !== null ? (
                  <>
                    <p className="text-2xl font-bold text-purple-600">{Math.max(0, health.daysUntilExpiration)}</p>
                    <p className="text-xs text-gray-600 mt-1">days until expiration</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">Not set</p>
                )}
              </div>
            </div>

            {/* Last Successful Submission */}
            {health.lastSuccessfulSubmission && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Last successful submission: <span className="font-semibold">
                    {new Date(health.lastSuccessfulSubmission).toLocaleString()}
                  </span>
                </p>
              </div>
            )}

            {/* Delete Button */}
            <div className="mt-6 flex gap-2">
              <Button
                variant="destructive"
                onClick={() => handleDeleteAccount(selectedAccount.id)}
                disabled={deleteAccountMutation.isPending}
              >
                {deleteAccountMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

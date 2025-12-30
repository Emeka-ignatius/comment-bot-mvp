import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface EmbeddedLoginDialogProps {
  platform: 'rumble' | 'youtube';
  onSuccess: (cookies: string, accountName?: string) => void;
  onCancel: () => void;
}

export function EmbeddedLoginDialog({ platform, onSuccess, onCancel }: EmbeddedLoginDialogProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'initializing' | 'waiting' | 'logged_in' | 'error' | 'timeout'>('initializing');
  const [errorMessage, setErrorMessage] = useState('');
  const [accountName, setAccountName] = useState('');

  const initiateMutation = trpc.embeddedLogin.initiate.useMutation();
  const { data: sessionStatus, refetch: refetchStatus } = trpc.embeddedLogin.status.useQuery(
    { sessionId: sessionId || '' },
    { enabled: !!sessionId, refetchInterval: 2000 } // Poll every 2 seconds
  );
  const cancelMutation = trpc.embeddedLogin.cancel.useMutation();

  // Initialize login session
  useEffect(() => {
    if (status === 'initializing') {
      initiateMutation.mutate(
        { platform },
        {
          onSuccess: (data) => {
            setSessionId(data.sessionId);
            setLoginUrl(data.loginUrl);
            setStatus('waiting');
            
            // Open login URL in new window
            window.open(data.loginUrl, 'Login', 'width=600,height=700,left=100,top=100');
          },
          onError: (error) => {
            setStatus('error');
            setErrorMessage(error.message || 'Failed to initialize login session');
          },
        }
      );
    }
  }, [status, platform]);

  // Monitor session status
  useEffect(() => {
    if (sessionStatus) {
      if (sessionStatus.status === 'logged_in' && sessionStatus.cookies) {
        setStatus('logged_in');
        handleSuccess(sessionStatus.cookies);
      } else if (sessionStatus.status === 'error') {
        setStatus('error');
        setErrorMessage(sessionStatus.error || 'Unknown error occurred');
      } else if (sessionStatus.status === 'timeout') {
        setStatus('timeout');
        setErrorMessage('Login session timed out. Please try again.');
      }
    }
  }, [sessionStatus]);

  const handleSuccess = (cookies: string) => {
    toast.success('Login successful! Cookies captured.');
    onSuccess(cookies, accountName || `${platform} Account`);
    setIsOpen(false);
  };

  const handleClose = async () => {
    if (sessionId) {
      await cancelMutation.mutateAsync({ sessionId });
    }
    setIsOpen(false);
    onCancel();
  };

  const handleRetry = () => {
    setStatus('initializing');
    setSessionId(null);
    setLoginUrl(null);
    setErrorMessage('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Login to {platform === 'rumble' ? 'Rumble' : 'YouTube'}</DialogTitle>
          <DialogDescription>
            Complete the login process in the popup window
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'initializing' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Initializing login session...
              </p>
            </div>
          )}

          {status === 'waiting' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription className="flex items-start gap-2">
                  <Loader2 className="h-4 w-4 animate-spin mt-0.5" />
                  <div>
                    <p className="font-medium">Waiting for login...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please complete the login process in the popup window. This dialog will automatically update when you're logged in.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              {loginUrl && (
                <div className="flex items-center justify-between p-3 bg-muted rounded">
                  <span className="text-sm text-muted-foreground">Popup didn't open?</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(loginUrl, 'Login', 'width=600,height=700')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Login Page
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Account Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., My Main Account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {status === 'logged_in' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm font-medium">Login successful!</p>
              <p className="text-xs text-muted-foreground">
                Your cookies have been captured and saved.
              </p>
            </div>
          )}

          {(status === 'error' || status === 'timeout') && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>

              {status === 'timeout' && (
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Tip:</strong> If automatic login doesn't work, you can still use the manual cookie input method from the Accounts page.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button onClick={handleRetry} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>How it works:</strong> We open the {platform} login page in a popup window. Once you log in, we automatically capture your session cookies and close the popup.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

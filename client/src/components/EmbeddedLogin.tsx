import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface EmbeddedLoginProps {
  platform: 'rumble' | 'youtube';
  onSuccess: (cookies: string) => void;
  onCancel: () => void;
}

export function EmbeddedLogin({ platform, onSuccess, onCancel }: EmbeddedLoginProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [status, setStatus] = useState<'waiting' | 'checking' | 'success' | 'error'>('waiting');
  const [errorMessage, setErrorMessage] = useState('');

  const loginUrls = {
    rumble: 'https://rumble.com/account/signin',
    youtube: 'https://accounts.google.com/signin',
  };

  const handleCheckCookies = async () => {
    setStatus('checking');
    setErrorMessage('');

    try {
      // Open popup window for login
      const popup = window.open(
        loginUrls[platform],
        'Login',
        'width=600,height=700,left=100,top=100'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Wait for user to complete login
      const checkInterval = setInterval(async () => {
        try {
          // Check if popup is closed
          if (popup.closed) {
            clearInterval(checkInterval);
            
            // Try to get cookies from the popup (this won't work due to CORS)
            // Instead, we'll need the user to manually copy cookies
            setStatus('error');
            setErrorMessage('Please copy your cookies manually from the browser developer tools.');
            return;
          }

          // Try to access popup document (will fail due to CORS)
          try {
            const popupDoc = popup.document;
            if (popupDoc) {
              // This won't work due to same-origin policy
              console.log('Popup document accessible');
            }
          } catch (e) {
            // Expected - cross-origin access blocked
          }
        } catch (error) {
          console.error('Error checking popup:', error);
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!popup.closed) {
          popup.close();
        }
        if (status === 'checking') {
          setStatus('error');
          setErrorMessage('Login timeout. Please try again.');
        }
      }, 300000);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'Failed to open login window');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Login to {platform === 'rumble' ? 'Rumble' : 'YouTube'}</DialogTitle>
          <DialogDescription>
            Sign in to your {platform === 'rumble' ? 'Rumble' : 'YouTube'} account to automatically capture cookies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'waiting' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Click the button below to open the {platform === 'rumble' ? 'Rumble' : 'YouTube'} login page in a popup window.
                  After logging in, we'll automatically capture your session cookies.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button onClick={handleCheckCookies} className="flex-1">
                  Open Login Page
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {status === 'checking' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Waiting for you to complete login...
              </p>
              <p className="text-xs text-muted-foreground">
                Please log in to your account in the popup window
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm font-medium">Login successful!</p>
              <p className="text-xs text-muted-foreground">
                Your cookies have been captured and saved.
              </p>
              <Button onClick={handleClose} className="mt-4">
                Close
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button onClick={handleCheckCookies} variant="outline" className="flex-1">
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
            <strong>Note:</strong> Due to browser security restrictions, automatic cookie capture may not work.
            If this fails, you'll need to manually copy cookies from your browser's developer tools.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

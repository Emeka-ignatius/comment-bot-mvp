import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Info, Copy, ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CookieInputHelperProps {
  platform: 'rumble' | 'youtube';
  onSuccess: (cookies: string, accountName?: string) => void;
  onCancel: () => void;
}

export function CookieInputHelper({ platform, onSuccess, onCancel }: CookieInputHelperProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [cookies, setCookies] = useState('');
  const [accountName, setAccountName] = useState('');
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState('');

  const platformUrls = {
    rumble: 'https://rumble.com',
    youtube: 'https://youtube.com',
  };

  const requiredCookies = {
    rumble: ['rumbles', 'PHPSESSID'],
    youtube: ['SID', 'HSID', 'SSID'],
  };

  const validateCookies = (cookieString: string) => {
    if (!cookieString.trim()) {
      setValidationStatus('idle');
      setValidationMessage('');
      return false;
    }

    const required = requiredCookies[platform];
    const missingCookies: string[] = [];

    for (const cookieName of required) {
      if (!cookieString.includes(cookieName)) {
        missingCookies.push(cookieName);
      }
    }

    if (missingCookies.length > 0) {
      setValidationStatus('invalid');
      setValidationMessage(`Missing required cookies: ${missingCookies.join(', ')}`);
      return false;
    }

    setValidationStatus('valid');
    setValidationMessage('Cookies look good! Ready to save.');
    return true;
  };

  const handleCookieChange = (value: string) => {
    setCookies(value);
    validateCookies(value);
  };

  const handleSave = () => {
    if (validateCookies(cookies)) {
      onSuccess(cookies.trim(), accountName.trim() || undefined);
      setIsOpen(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onCancel();
  };

  const openPlatformSite = () => {
    window.open(platformUrls[platform], '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add {platform === 'rumble' ? 'Rumble' : 'YouTube'} Account</DialogTitle>
          <DialogDescription>
            Copy your browser cookies to authenticate this account
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="instructions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger value="paste">Paste Cookies</TabsTrigger>
          </TabsList>

          <TabsContent value="instructions" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Follow these steps to copy your cookies from the browser
              </AlertDescription>
            </Alert>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium">Open {platform === 'rumble' ? 'Rumble' : 'YouTube'} and log in</p>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={openPlatformSite}
                  >
                    Open {platformUrls[platform]} <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Open Browser Developer Tools</p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                    <li>Press <kbd className="px-1 py-0.5 bg-muted rounded">F12</kbd> or right-click → "Inspect"</li>
                    <li>Go to the <strong>Application</strong> tab (Chrome) or <strong>Storage</strong> tab (Firefox)</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Copy Cookies</p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                    <li>Click <strong>Cookies</strong> → <strong>{platformUrls[platform]}</strong></li>
                    <li>Select all cookies and copy them</li>
                    <li>Format: <code className="text-xs bg-muted px-1 py-0.5 rounded">name1=value1; name2=value2</code></li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  4
                </div>
                <div>
                  <p className="font-medium">Paste cookies in the "Paste Cookies" tab</p>
                </div>
              </div>
            </div>

            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Required cookies for {platform}:</strong> {requiredCookies[platform].join(', ')}
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button onClick={() => {
                const tabsTrigger = document.querySelector('[value="paste"]') as HTMLElement;
                tabsTrigger?.click();
              }} className="flex-1">
                Next: Paste Cookies
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4">
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Cookies</label>
              <Textarea
                placeholder="Paste your cookies here (format: name1=value1; name2=value2)"
                value={cookies}
                onChange={(e) => handleCookieChange(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>

            {validationStatus === 'valid' && (
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {validationMessage}
                </AlertDescription>
              </Alert>
            )}

            {validationStatus === 'invalid' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{validationMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={validationStatus !== 'valid'}
                className="flex-1"
              >
                Save Account
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

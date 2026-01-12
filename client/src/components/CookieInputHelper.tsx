import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Info, ExternalLink, Download } from 'lucide-react';

interface CookieInputHelperProps {
  platform: 'rumble' | 'youtube';
  onSuccess: (cookies: string, accountName?: string, proxy?: string) => void;
  onCancel: () => void;
}

// Cookie-Editor extension links
const EXTENSION_LINKS = {
  chrome: 'https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/cookie-editor/ajfboaconbpkglpfanbmlfgojgndmhmc',
};

export function CookieInputHelper({ platform, onSuccess, onCancel }: CookieInputHelperProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [cookies, setCookies] = useState('');
  const [accountName, setAccountName] = useState('');
  const [proxy, setProxy] = useState('');
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid' | 'warning'>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [step, setStep] = useState<'instructions' | 'paste'>('instructions');

  const platformUrls = {
    rumble: 'https://rumble.com',
    youtube: 'https://youtube.com',
  };

  // The ACTUAL required cookies for each platform
  const requiredCookies = {
    rumble: ['a_s', 'u_s'],
    youtube: ['SID', 'SSID'],
  };

  const validateCookies = (cookieString: string) => {
    if (!cookieString.trim()) {
      setValidationStatus('idle');
      setValidationMessage('');
      return false;
    }

    const required = requiredCookies[platform];
    const missingRequired: string[] = [];

    for (const cookieName of required) {
      const regex = new RegExp(`(^|;\\s*)${cookieName}=([^;]+)`, 'i');
      if (!regex.test(cookieString)) {
        missingRequired.push(cookieName);
      }
    }

    if (missingRequired.length > 0) {
      setValidationStatus('invalid');
      setValidationMessage(`Missing required cookies: ${missingRequired.join(', ')}. Make sure you're logged in on ${platform === 'rumble' ? 'Rumble' : 'YouTube'} before exporting.`);
      return false;
    }

    setValidationStatus('valid');
    setValidationMessage('✅ Cookies validated! Ready to save.');
    return true;
  };

  const handleCookieChange = (value: string) => {
    // Try to parse if it's JSON format from Cookie-Editor
    let processedCookies = value;
    
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        // Convert Cookie-Editor JSON format to cookie string
        processedCookies = parsed
          .map((c: any) => `${c.name}=${c.value}`)
          .join('; ');
      }
    } catch {
      // Not JSON, use as-is (already in cookie string format)
    }
    
    setCookies(processedCookies);
    validateCookies(processedCookies);
  };

  const handleSave = () => {
    if (validateCookies(cookies)) {
      onSuccess(cookies.trim(), accountName.trim() || undefined, proxy.trim() || undefined);
      setIsOpen(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {platform === 'rumble' ? '🎥' : '▶️'} Add {platform === 'rumble' ? 'Rumble' : 'YouTube'} Account
          </DialogTitle>
          <DialogDescription>
            Use the Cookie-Editor extension to export your login cookies
          </DialogDescription>
        </DialogHeader>

        {step === 'instructions' ? (
          <div className="space-y-5">
            {/* One-time setup notice */}
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>First time?</strong> Install the Cookie-Editor extension (one-time setup, takes 10 seconds)
              </AlertDescription>
            </Alert>

            {/* Extension install buttons */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Step 1: Install Cookie-Editor (if not already installed)</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(EXTENSION_LINKS.chrome, '_blank')}
                  className="flex items-center gap-2"
                >
                  <img src="https://www.google.com/chrome/static/images/chrome-logo-m100.svg" alt="Chrome" className="w-4 h-4" />
                  Chrome
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(EXTENSION_LINKS.firefox, '_blank')}
                  className="flex items-center gap-2"
                >
                  🦊 Firefox
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(EXTENSION_LINKS.edge, '_blank')}
                  className="flex items-center gap-2"
                >
                  Edge
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Simple 3-step instructions */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium">Go to {platform === 'rumble' ? 'Rumble' : 'YouTube'} and make sure you're logged in</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-primary"
                    onClick={() => window.open(platformUrls[platform], '_blank')}
                  >
                    Open {platformUrls[platform]} <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border-2 border-green-200 dark:border-green-800">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Click Cookie-Editor icon → Export → Header String</p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    The cookies will be copied to your clipboard automatically!
                  </p>
                </div>
              </div>
            </div>

            {/* Visual guide */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-xs font-medium mb-2 text-muted-foreground">💡 Quick tip: Look for this icon in your browser toolbar:</p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold text-xs">
                  🍪
                </div>
                <span className="text-muted-foreground">→ Click it → Export → Header String</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setStep('paste')} className="flex-1">
                I've Copied the Cookies →
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Account Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., My Main Account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Proxy (Optional)</label>
                <input
                  type="text"
                  placeholder="protocol://user:pass@host:port"
                  value={proxy}
                  onChange={(e) => setProxy(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Paste Cookies Here (Ctrl+V)</label>
              <Textarea
                placeholder="Paste your exported cookies here..."
                value={cookies}
                onChange={(e) => handleCookieChange(e.target.value)}
                rows={6}
                className="font-mono text-xs"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Supports both Header String format and JSON format from Cookie-Editor
              </p>
            </div>

            {validationStatus === 'valid' && (
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {validationMessage}
                </AlertDescription>
              </Alert>
            )}

            {validationStatus === 'warning' && (
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
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
              <Button variant="outline" onClick={() => setStep('instructions')}>
                ← Back
              </Button>
              <Button
                onClick={handleSave}
                disabled={validationStatus !== 'valid' && validationStatus !== 'warning'}
                className="flex-1"
              >
                Save Account
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

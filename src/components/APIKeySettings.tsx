import { useState, useEffect } from 'react';
import { Settings, Key, Check, X, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const API_KEY_STORAGE_KEY = 'user_google_ai_api_key';

export const getStoredAPIKey = (): string | null => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredAPIKey = (key: string | null): void => {
  try {
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to store API key:', e);
  }
};

const APIKeySettings = () => {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const stored = getStoredAPIKey();
    setSavedKey(stored);
  }, []);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "No API key entered",
        description: "Please enter your Google AI Studio API key",
        variant: "destructive",
      });
      return;
    }

    setIsTestingKey(true);
    
    // Test the API key by making a simple request
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey.trim());
      
      if (response.ok) {
        setStoredAPIKey(apiKey.trim());
        setSavedKey(apiKey.trim());
        toast({
          title: "API Key Saved! ✓",
          description: "Your Google AI Studio API key is now active. All AI features will use your key.",
        });
        setApiKey('');
        setIsOpen(false);
      } else if (response.status === 400 || response.status === 401 || response.status === 403) {
        toast({
          title: "Invalid API Key",
          description: "The API key you entered is invalid. Please check and try again.",
          variant: "destructive",
        });
      } else {
        // Other errors - save anyway as it might work for completions
        setStoredAPIKey(apiKey.trim());
        setSavedKey(apiKey.trim());
        toast({
          title: "API Key Saved",
          description: "Key saved. If you experience issues, please verify your key.",
        });
        setApiKey('');
        setIsOpen(false);
      }
    } catch (error) {
      // Network error - save anyway
      setStoredAPIKey(apiKey.trim());
      setSavedKey(apiKey.trim());
      toast({
        title: "API Key Saved",
        description: "Key saved locally. It will be used for AI requests.",
      });
      setApiKey('');
      setIsOpen(false);
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleRemoveKey = () => {
    setStoredAPIKey(null);
    setSavedKey(null);
    toast({
      title: "API Key Removed",
      description: "Reverted to default Lovable AI gateway. Add credits to your workspace for AI features.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Key className="w-4 h-4" />
          {savedKey ? (
            <span className="text-green-500 flex items-center gap-1">
              <Check className="w-3 h-3" /> API Key Active
            </span>
          ) : (
            "Add Your API Key"
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            AI API Key Settings
          </DialogTitle>
          <DialogDescription>
            Use your own free Google AI Studio API key for unlimited AI usage
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Free API Key:</strong> Google AI Studio provides free API access with generous limits:
              <ul className="list-disc ml-4 mt-2">
                <li>Gemini 1.5 Flash: 15 requests/minute (FREE)</li>
                <li>Gemini 1.5 Pro: 2 requests/minute (FREE)</li>
                <li>No credit card required</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Get Your Free API Key:</label>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => window.open('https://aistudio.google.com/apikey', '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              Open Google AI Studio → Get API Key
            </Button>
          </div>

          {savedKey ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary">API Key Active: ...{savedKey.slice(-8)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveKey}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                All AI features are now using your personal API key with unlimited usage!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Enter Your API Key:</label>
              <Input
                type="password"
                placeholder="AIza... (paste your Google AI Studio key)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono"
              />
              <Button 
                onClick={handleSaveKey} 
                className="w-full"
                disabled={isTestingKey}
              >
                {isTestingKey ? "Verifying..." : "Save & Activate API Key"}
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t pt-4">
            <p><strong>Security:</strong> Your API key is stored locally in your browser only. 
            It's sent directly to Google's API, never to our servers.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default APIKeySettings;

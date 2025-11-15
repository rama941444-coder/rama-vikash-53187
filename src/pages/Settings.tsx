import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Settings as SettingsIcon, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Settings = () => {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Load saved API key preference from localStorage
    const savedKey = localStorage.getItem("gemini_api_configured");
    if (savedKey === "true") {
      setApiKey("••••••••••••••••");
    }
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey || apiKey.startsWith("••")) {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid Gemini API key",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Test the API key
      const testResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: 'Test' }]
            }]
          }),
        }
      );

      if (!testResponse.ok) {
        throw new Error("Invalid API key");
      }

      localStorage.setItem("gemini_api_configured", "true");
      localStorage.setItem("gemini_api_key_hint", apiKey.slice(0, 8) + "...");
      
      toast({
        title: "✅ API Key Saved",
        description: "Your Gemini API key has been configured successfully",
      });
      
      setApiKey("••••••••••••••••");
    } catch (error) {
      toast({
        title: "❌ Invalid API Key",
        description: "The API key you entered is not valid. Please check and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-lg bg-primary/10">
            <SettingsIcon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure your AI analysis preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                <CardTitle>AI Provider Configuration</CardTitle>
              </div>
              <CardDescription>
                Configure your Gemini API key for independent AI analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">Gemini API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your Gemini API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  Get your free API key from{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>

              <Button 
                onClick={handleSaveApiKey} 
                disabled={saving}
                className="w-full"
              >
                {saving ? "Testing & Saving..." : "Save API Key"}
              </Button>

              <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-semibold text-sm">Why configure Gemini?</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Independent from Lovable AI credits</li>
                  <li>Free tier available (15 requests/minute)</li>
                  <li>Advanced multimodal capabilities</li>
                  <li>Supports vision and document analysis</li>
                  <li>Works across all analysis slides</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage Information</CardTitle>
              <CardDescription>
                Current AI provider status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Active Provider</span>
                  <span className="text-sm text-primary font-semibold">
                    {localStorage.getItem("gemini_api_configured") === "true" 
                      ? "Google Gemini" 
                      : "Not Configured"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Model</span>
                  <span className="text-sm text-muted-foreground">gemini-2.0-flash-exp</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Features</span>
                  <span className="text-sm text-muted-foreground">Vision, Code, OCR</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;

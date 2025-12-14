import { useState } from 'react';
import { Volume2, VolumeX, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const LANGUAGES = [
  { code: 'English', label: 'English' },
  { code: 'Telugu', label: 'తెలుగు (Telugu)' },
  { code: 'Hindi', label: 'हिन्दी (Hindi)' },
  { code: 'Tamil', label: 'தமிழ் (Tamil)' },
  { code: 'Kannada', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'Malayalam', label: 'മലയാളം (Malayalam)' },
  { code: 'Bengali', label: 'বাংলা (Bengali)' },
];

interface NarrationControlsProps {
  text: string;
  className?: string;
}

const NarrationControls = ({ text, className = '' }: NarrationControlsProps) => {
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();

  const handleLanguageChange = async (language: string) => {
    setSelectedLanguage(language);
    setTranslatedText(null);
    
    if (language === 'English') {
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-explanation', {
        body: { text, targetLanguage: language }
      });

      if (error) throw error;
      
      if (data?.translatedText) {
        setTranslatedText(data.translatedText);
        toast({
          title: "Translation complete",
          description: `Translated to ${language}`,
        });
      }
    } catch (error: any) {
      console.error('Translation error:', error);
      toast({
        title: "Translation failed",
        description: error.message || "Could not translate text",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const playNarration = () => {
    if (!narrationEnabled) {
      toast({
        title: "Narration disabled",
        description: "Enable narration to play audio",
        variant: "destructive",
      });
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const textToSpeak = translatedText || text;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Try to find a voice for the selected language
      const voices = window.speechSynthesis.getVoices();
      const langMap: Record<string, string> = {
        'English': 'en',
        'Telugu': 'te',
        'Hindi': 'hi',
        'Tamil': 'ta',
        'Kannada': 'kn',
        'Malayalam': 'ml',
        'Bengali': 'bn'
      };
      
      const targetLang = langMap[selectedLanguage] || 'en';
      const matchingVoice = voices.find(v => v.lang.startsWith(targetLang));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
      toast({
        title: "Playing narration",
        description: `Audio in ${selectedLanguage}`,
      });
    } catch (error) {
      toast({
        title: "Audio playback failed",
        description: "Could not play narration",
        variant: "destructive",
      });
    }
  };

  const stopNarration = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const displayText = translatedText || text;

  return (
    <div className={className}>
      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
        {/* Narration On/Off Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={narrationEnabled}
            onCheckedChange={setNarrationEnabled}
            id="narration-toggle"
          />
          <label htmlFor="narration-toggle" className="text-sm font-medium flex items-center gap-1">
            {narrationEnabled ? (
              <Volume2 className="w-4 h-4 text-primary" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            )}
            Narration {narrationEnabled ? 'ON' : 'OFF'}
          </label>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={isTranslating}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isTranslating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>

        {/* Play/Stop Button */}
        <Button
          onClick={isPlaying ? stopNarration : playNarration}
          disabled={!narrationEnabled || isTranslating || !text}
          variant={isPlaying ? "destructive" : "outline"}
          className="gap-2"
        >
          {isPlaying ? (
            <>
              <VolumeX className="w-4 h-4" />
              Stop
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              Play Narration
            </>
          )}
        </Button>
      </div>

      {/* Display Text */}
      <pre className="whitespace-pre-wrap text-sm leading-relaxed">
        {displayText}
      </pre>
    </div>
  );
};

export default NarrationControls;

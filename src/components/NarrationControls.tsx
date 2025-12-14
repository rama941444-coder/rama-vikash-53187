import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, Globe, Gauge, Mic } from 'lucide-react';
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

const SPEEDS = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.5', label: '1.5x' },
  { value: '2', label: '2x' },
];

interface NarrationControlsProps {
  text: string;
  className?: string;
}

const NarrationControls = ({ text, className = '' }: NarrationControlsProps) => {
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [selectedSpeed, setSelectedSpeed] = useState('1');
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        // Set default voice
        if (!selectedVoice && voices.length > 0) {
          setSelectedVoice(voices[0].name);
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

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
      utterance.rate = parseFloat(selectedSpeed);
      utterance.pitch = 1;
      utterance.volume = 1;

      // Set selected voice
      if (selectedVoice) {
        const voice = availableVoices.find(v => v.name === selectedVoice);
        if (voice) {
          utterance.voice = voice;
        }
      } else {
        // Try to find a voice for the selected language
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
        const matchingVoice = availableVoices.find(v => v.lang.startsWith(targetLang));
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
      toast({
        title: "Playing narration",
        description: `Speed: ${selectedSpeed}x | Language: ${selectedLanguage}`,
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
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
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
            {narrationEnabled ? 'ON' : 'OFF'}
          </label>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={isTranslating}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Language" />
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

        {/* Speed Selector */}
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedSpeed} onValueChange={setSelectedSpeed}>
            <SelectTrigger className="w-[90px]">
              <SelectValue placeholder="Speed" />
            </SelectTrigger>
            <SelectContent>
              {SPEEDS.map((speed) => (
                <SelectItem key={speed.value} value={speed.value}>
                  {speed.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice Selector */}
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedVoice} onValueChange={setSelectedVoice}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select Voice" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {availableVoices.map((voice) => (
                <SelectItem key={voice.name} value={voice.name}>
                  {voice.name.length > 20 ? voice.name.substring(0, 20) + '...' : voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Play/Stop Button */}
        <Button
          onClick={isPlaying ? stopNarration : playNarration}
          disabled={!narrationEnabled || isTranslating || !text}
          variant={isPlaying ? "destructive" : "outline"}
          size="sm"
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
              Play
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

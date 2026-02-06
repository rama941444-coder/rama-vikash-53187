import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, Globe, Play, Square, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getStoredAPIKey } from '@/hooks/useUserAPIKey';

// All Indian languages supported
const LANGUAGES = [
  { code: 'English', label: 'English', langCode: 'en' },
  { code: 'Hindi', label: 'हिन्दी (Hindi)', langCode: 'hi' },
  { code: 'Telugu', label: 'తెలుగు (Telugu)', langCode: 'te' },
  { code: 'Tamil', label: 'தமிழ் (Tamil)', langCode: 'ta' },
  { code: 'Kannada', label: 'ಕನ್ನಡ (Kannada)', langCode: 'kn' },
  { code: 'Malayalam', label: 'മലയാളം (Malayalam)', langCode: 'ml' },
  { code: 'Bengali', label: 'বাংলা (Bengali)', langCode: 'bn' },
  { code: 'Gujarati', label: 'ગુજરાતી (Gujarati)', langCode: 'gu' },
  { code: 'Marathi', label: 'मराठी (Marathi)', langCode: 'mr' },
  { code: 'Punjabi', label: 'ਪੰਜਾਬੀ (Punjabi)', langCode: 'pa' },
  { code: 'Odia', label: 'ଓଡ଼ିଆ (Odia)', langCode: 'or' },
  { code: 'Assamese', label: 'অসমীয়া (Assamese)', langCode: 'as' },
  { code: 'Urdu', label: 'اردو (Urdu)', langCode: 'ur' },
  { code: 'Sanskrit', label: 'संस्कृतम् (Sanskrit)', langCode: 'sa' },
  { code: 'Nepali', label: 'नेपाली (Nepali)', langCode: 'ne' },
  { code: 'Konkani', label: 'कोंकणी (Konkani)', langCode: 'kok' },
  { code: 'Maithili', label: 'मैथिली (Maithili)', langCode: 'mai' },
  { code: 'Sindhi', label: 'سنڌي (Sindhi)', langCode: 'sd' },
  { code: 'Kashmiri', label: 'كٲشُر (Kashmiri)', langCode: 'ks' },
  { code: 'Manipuri', label: 'মৈতৈলোন্ (Manipuri)', langCode: 'mni' },
  { code: 'Bodo', label: 'बड़ो (Bodo)', langCode: 'brx' },
  { code: 'Santali', label: 'ᱥᱟᱱᱛᱟᱲᱤ (Santali)', langCode: 'sat' },
  { code: 'Dogri', label: 'डोगरी (Dogri)', langCode: 'doi' },
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
  const [speechRate, setSpeechRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { toast } = useToast();

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Get voices for selected language
  const getVoicesForLanguage = (langCode: string) => {
    return availableVoices.filter(v => 
      v.lang.startsWith(langCode) || v.lang.includes(langCode)
    );
  };

  const handleLanguageChange = async (language: string) => {
    setSelectedLanguage(language);
    setTranslatedText(null);
    setSelectedVoiceIndex(0);
    
    // Stop any playing audio
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    
    if (language === 'English') {
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-explanation', {
        body: { text, targetLanguage: language, userApiKey: getStoredAPIKey() }
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
        description: error.message || "Could not translate text. Using original.",
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
      
      // Apply settings
      utterance.rate = speechRate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // Find matching voice for language
      const langInfo = LANGUAGES.find(l => l.code === selectedLanguage);
      const langCode = langInfo?.langCode || 'en';
      const matchingVoices = getVoicesForLanguage(langCode);
      
      if (matchingVoices.length > 0 && selectedVoiceIndex < matchingVoices.length) {
        utterance.voice = matchingVoices[selectedVoiceIndex];
      } else if (matchingVoices.length > 0) {
        utterance.voice = matchingVoices[0];
      }

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = (e) => {
        console.error('Speech error:', e);
        setIsPlaying(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      
      toast({
        title: "Playing narration",
        description: `Audio in ${selectedLanguage} at ${speechRate}x speed`,
      });
    } catch (error) {
      console.error('Playback error:', error);
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
  const currentLangInfo = LANGUAGES.find(l => l.code === selectedLanguage);
  const voicesForCurrentLang = currentLangInfo ? getVoicesForLanguage(currentLangInfo.langCode) : [];

  return (
    <div className={className}>
      {/* Main Controls Row */}
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
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
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
          variant={isPlaying ? "destructive" : "default"}
          className="gap-2"
        >
          {isPlaying ? (
            <>
              <Square className="w-4 h-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Play Narration
            </>
          )}
        </Button>
      </div>

      {/* Voice Settings Row */}
      <div className="flex flex-wrap items-center gap-6 mb-4 p-3 bg-muted/30 rounded-lg">
        {/* Speed Control */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <Gauge className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span>Speed</span>
              <span className="font-medium">{speechRate.toFixed(1)}x</span>
            </div>
            <Slider
              value={[speechRate]}
              onValueChange={([val]) => setSpeechRate(val)}
              min={0.5}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        {/* Pitch Control */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span>Pitch</span>
              <span className="font-medium">{pitch.toFixed(1)}</span>
            </div>
            <Slider
              value={[pitch]}
              onValueChange={([val]) => setPitch(val)}
              min={0.5}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span>Volume</span>
              <span className="font-medium">{Math.round(volume * 100)}%</span>
            </div>
            <Slider
              value={[volume]}
              onValueChange={([val]) => setVolume(val)}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        {/* Voice Selection (if multiple voices available) */}
        {voicesForCurrentLang.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Voice:</span>
            <Select 
              value={String(selectedVoiceIndex)} 
              onValueChange={(val) => setSelectedVoiceIndex(Number(val))}
            >
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voicesForCurrentLang.map((voice, idx) => (
                  <SelectItem key={idx} value={String(idx)} className="text-xs">
                    {voice.name.split(' ').slice(0, 2).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Display Text with Animation */}
      <div className="analysis-box-black relative">
        <div className="absolute top-2 right-2 flex items-center gap-2">
          {isPlaying && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-3 bg-green-500 rounded-full animate-pulse" />
              <div className="w-1.5 h-4 bg-green-500 rounded-full animate-pulse delay-75" />
              <div className="w-1.5 h-2 bg-green-500 rounded-full animate-pulse delay-150" />
              <span className="text-xs text-green-500 ml-1">Speaking...</span>
            </div>
          )}
        </div>
        <h4 className="text-sm font-medium mb-2 text-gray-400 flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full"></span>
          AI Teacher Explanation
        </h4>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-white">
          {displayText}
        </pre>
      </div>
    </div>
  );
};

export default NarrationControls;

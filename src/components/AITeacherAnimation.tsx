import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Volume2, VolumeX, Loader2, Globe, Play, Pause, Square, 
  Gauge, SkipBack, SkipForward, Download, Subtitles, Sparkles,
  ChevronDown, ChevronUp, Mic
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

interface AITeacherAnimationProps {
  text: string;
  className?: string;
}

const AITeacherAnimation = ({ text, className = '' }: AITeacherAnimationProps) => {
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(0);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [currentCaption, setCurrentCaption] = useState('');
  const [progress, setProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(24).fill(0));
  const [mouthOpenness, setMouthOpenness] = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textChunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Split text into chunks for caption display
  useEffect(() => {
    const displayText = translatedText || text;
    // Split by sentences for better captions
    const sentences = displayText.split(/(?<=[.!?।])\s+/);
    textChunksRef.current = sentences;
  }, [text, translatedText]);

  // Waveform animation effect
  const animateWaveform = useCallback(() => {
    if (isPlaying && !isPaused) {
      const newData = Array.from({ length: 24 }, () => 
        Math.random() * 0.8 + 0.2
      );
      setWaveformData(newData);
      setMouthOpenness(Math.random() * 0.6 + 0.2);
    } else {
      setWaveformData(new Array(24).fill(0.1));
      setMouthOpenness(0);
    }
  }, [isPlaying, isPaused]);

  useEffect(() => {
    if (isPlaying && !isPaused) {
      waveformIntervalRef.current = setInterval(animateWaveform, 80);
    } else {
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
      }
      setWaveformData(new Array(24).fill(0.1));
      setMouthOpenness(0);
    }
    return () => {
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
      }
    };
  }, [isPlaying, isPaused, animateWaveform]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = (width / waveformData.length) - 3;

    ctx.clearRect(0, 0, width, height);

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#22c55e');
    gradient.addColorStop(0.5, '#3b82f6');
    gradient.addColorStop(1, '#8b5cf6');

    waveformData.forEach((value, index) => {
      const barHeight = value * height * 0.85;
      const x = index * (barWidth + 3);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = isPlaying && !isPaused ? gradient : '#4b5563';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    });
  }, [waveformData, isPlaying, isPaused]);

  const getVoicesForLanguage = (langCode: string) => {
    return availableVoices.filter(v => 
      v.lang.startsWith(langCode) || v.lang.includes(langCode)
    );
  };

  const handleLanguageChange = async (language: string) => {
    setSelectedLanguage(language);
    setTranslatedText(null);
    setSelectedVoiceIndex(0);
    setProgress(0);
    setCurrentCaption('');
    
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    
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
        description: error.message || "Could not translate text. Using original.",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const updateProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    const totalChunks = textChunksRef.current.length;
    let currentIndex = 0;
    
    progressIntervalRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        const progressPercent = Math.min(((currentIndex + 1) / totalChunks) * 100, 100);
        setProgress(progressPercent);
        
        if (captionsEnabled && textChunksRef.current[currentIndex]) {
          setCurrentCaption(textChunksRef.current[currentIndex]);
        }
        
        currentIndex = Math.min(currentIndex + 1, totalChunks - 1);
        currentChunkIndexRef.current = currentIndex;
      }
    }, 2000 / speechRate);
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

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      updateProgress();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const textToSpeak = translatedText || text;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      utterance.rate = speechRate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      const langInfo = LANGUAGES.find(l => l.code === selectedLanguage);
      const langCode = langInfo?.langCode || 'en';
      const matchingVoices = getVoicesForLanguage(langCode);
      
      if (matchingVoices.length > 0 && selectedVoiceIndex < matchingVoices.length) {
        utterance.voice = matchingVoices[selectedVoiceIndex];
      } else if (matchingVoices.length > 0) {
        utterance.voice = matchingVoices[0];
      }

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
        updateProgress();
      };
      
      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(100);
        setCurrentCaption('');
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };
      
      utterance.onerror = (e) => {
        console.error('Speech error:', e);
        setIsPlaying(false);
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      
      toast({
        title: "AI Teacher Started",
        description: `Playing explanation in ${selectedLanguage} at ${speechRate}x speed`,
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

  const pauseNarration = () => {
    window.speechSynthesis.pause();
    setIsPlaying(false);
    setIsPaused(true);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  const stopNarration = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentCaption('');
    currentChunkIndexRef.current = 0;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  const skipForward = () => {
    const totalChunks = textChunksRef.current.length;
    const newIndex = Math.min(currentChunkIndexRef.current + 5, totalChunks - 1);
    currentChunkIndexRef.current = newIndex;
    setProgress((newIndex / totalChunks) * 100);
    
    if (captionsEnabled && textChunksRef.current[newIndex]) {
      setCurrentCaption(textChunksRef.current[newIndex]);
    }
    
    toast({ title: "Skipped forward 10 seconds" });
  };

  const skipBackward = () => {
    const totalChunks = textChunksRef.current.length;
    const newIndex = Math.max(currentChunkIndexRef.current - 5, 0);
    currentChunkIndexRef.current = newIndex;
    setProgress((newIndex / totalChunks) * 100);
    
    if (captionsEnabled && textChunksRef.current[newIndex]) {
      setCurrentCaption(textChunksRef.current[newIndex]);
    }
    
    toast({ title: "Skipped backward 10 seconds" });
  };

  const downloadExplanation = async () => {
    setIsDownloading(true);
    try {
      const textContent = translatedText || text;
      const langLabel = LANGUAGES.find(l => l.code === selectedLanguage)?.label || selectedLanguage;
      
      // Create a text file for download
      const blob = new Blob([
        `AI Teacher Explanation\n`,
        `Language: ${langLabel}\n`,
        `${'='.repeat(50)}\n\n`,
        textContent
      ], { type: 'text/plain;charset=utf-8' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI_Teacher_Explanation_${selectedLanguage}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Complete",
        description: `Explanation downloaded in ${langLabel}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "Could not download explanation",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const displayText = translatedText || text;
  const currentLangInfo = LANGUAGES.find(l => l.code === selectedLanguage);
  const voicesForCurrentLang = currentLangInfo ? getVoicesForLanguage(currentLangInfo.langCode) : [];

  return (
    <div className={`bg-gray-800 rounded-xl border-2 border-gray-600 overflow-hidden shadow-2xl ${className}`}>
      {/* Header with AI Teacher branding */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-4 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center ${isPlaying && !isPaused ? 'animate-pulse' : ''}`}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              {isPlaying && !isPaused && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                🤖 AI Teacher
                {isPlaying && !isPaused && <span className="text-xs text-green-400 animate-pulse">Speaking...</span>}
                {isPaused && <span className="text-xs text-yellow-400">Paused</span>}
              </h3>
              <p className="text-xs text-gray-400">Interactive Code Explanation</p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Animated Avatar Section */}
          <div className="p-4 bg-gradient-to-b from-gray-900 to-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-6">
              {/* 3D-style Animated Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-1 ${isPlaying && !isPaused ? 'animate-pulse' : ''}`}>
                  <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center relative overflow-hidden">
                    {/* Avatar Face */}
                    <div className="relative w-16 h-16">
                      {/* Eyes */}
                      <div className="absolute top-3 left-2 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                        <div className={`w-1.5 h-1.5 bg-gray-800 rounded-full ${isPlaying && !isPaused ? 'animate-bounce' : ''}`} style={{ animationDuration: '2s' }} />
                      </div>
                      <div className="absolute top-3 right-2 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                        <div className={`w-1.5 h-1.5 bg-gray-800 rounded-full ${isPlaying && !isPaused ? 'animate-bounce' : ''}`} style={{ animationDuration: '2s' }} />
                      </div>
                      {/* Nose */}
                      <div className="absolute top-7 left-1/2 -translate-x-1/2 w-1 h-2 bg-gray-600 rounded-full" />
                      {/* Animated Mouth */}
                      <div 
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-red-400 rounded-full transition-all duration-75"
                        style={{ 
                          width: `${8 + mouthOpenness * 12}px`,
                          height: `${2 + mouthOpenness * 10}px`,
                          borderRadius: mouthOpenness > 0.3 ? '50%' : '9999px'
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* Speaking Indicator */}
                {isPlaying && !isPaused && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                    <Mic className="w-3 h-3" />
                    <span className="text-[10px]">Live</span>
                  </div>
                )}
              </div>

              {/* Waveform Visualization */}
              <div className="flex-1">
                <canvas 
                  ref={canvasRef}
                  width={400}
                  height={60}
                  className="w-full h-[60px] rounded-lg bg-gray-900/50"
                />
              </div>
            </div>
          </div>

          {/* Video-like Progress Bar */}
          <div className="px-4 pt-3">
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{Math.round(progress)}%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Main Controls Row */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex flex-wrap items-center gap-3">
              {/* Narration Toggle */}
              <div className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded-lg">
                <Switch
                  checked={narrationEnabled}
                  onCheckedChange={setNarrationEnabled}
                  id="narration-toggle"
                />
                <label htmlFor="narration-toggle" className="text-sm text-gray-300 flex items-center gap-1">
                  {narrationEnabled ? (
                    <Volume2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-gray-500" />
                  )}
                </label>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-1 bg-gray-900 px-2 py-1 rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipBackward}
                  disabled={!isPlaying && !isPaused}
                  className="w-8 h-8 text-gray-400 hover:text-white"
                  title="Previous 10 seconds"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                
                {isPlaying ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={pauseNarration}
                    className="w-10 h-10 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full"
                  >
                    <Pause className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={playNarration}
                    disabled={!narrationEnabled || isTranslating}
                    className="w-10 h-10 bg-green-600 hover:bg-green-700 text-white rounded-full"
                  >
                    <Play className="w-5 h-5 ml-0.5" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopNarration}
                  disabled={!isPlaying && !isPaused}
                  className="w-8 h-8 text-gray-400 hover:text-red-400"
                >
                  <Square className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipForward}
                  disabled={!isPlaying && !isPaused}
                  className="w-8 h-8 text-gray-400 hover:text-white"
                  title="Next 10 seconds"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" />
                <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={isTranslating}>
                  <SelectTrigger className="w-[160px] bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] bg-gray-900 border-gray-700">
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code} className="text-white hover:bg-gray-800">
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isTranslating && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
              </div>

              {/* Captions Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCaptionsEnabled(!captionsEnabled)}
                className={`gap-1 ${captionsEnabled ? 'text-blue-400' : 'text-gray-500'}`}
              >
                <Subtitles className="w-4 h-4" />
                CC
              </Button>

              {/* Download Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadExplanation}
                disabled={isDownloading}
                className="gap-1 text-gray-400 hover:text-white"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download
              </Button>
            </div>
          </div>

          {/* Speed & Voice Controls */}
          <div className="p-4 bg-gray-900/50 border-b border-gray-700">
            <div className="flex flex-wrap items-center gap-6">
              {/* Speed Control */}
              <div className="flex items-center gap-3 min-w-[160px]">
                <Gauge className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1 text-gray-400">
                    <span>Speed</span>
                    <span className="font-medium text-white">{speechRate.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={[speechRate]}
                    onValueChange={([val]) => setSpeechRate(val)}
                    min={0.5}
                    max={2}
                    step={0.25}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>0.5x</span>
                    <span>1x</span>
                    <span>1.5x</span>
                    <span>2x</span>
                  </div>
                </div>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-3 min-w-[140px]">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1 text-gray-400">
                    <span>Volume</span>
                    <span className="font-medium text-white">{Math.round(volume * 100)}%</span>
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

              {/* Pitch/Smoothness Control */}
              <div className="flex items-center gap-3 min-w-[140px]">
                <span className="text-xs text-gray-400">Smoothness</span>
                <div className="flex-1">
                  <Slider
                    value={[pitch]}
                    onValueChange={([val]) => setPitch(val)}
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Voice Selection */}
              {voicesForCurrentLang.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Voice:</span>
                  <Select 
                    value={String(selectedVoiceIndex)} 
                    onValueChange={(val) => setSelectedVoiceIndex(Number(val))}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-xs bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {voicesForCurrentLang.map((voice, idx) => (
                        <SelectItem key={idx} value={String(idx)} className="text-xs text-white">
                          {voice.name.split(' ').slice(0, 2).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Caption Display */}
          {captionsEnabled && currentCaption && (
            <div className="mx-4 my-3 p-3 bg-black/80 rounded-lg border border-gray-600">
              <p className="text-white text-center text-sm font-medium">
                {currentCaption}
              </p>
            </div>
          )}

          {/* Main Content Display */}
          <div className="p-4">
            <div className="bg-gray-900 rounded-lg p-4 max-h-[400px] overflow-y-auto">
              <div className="flex items-start gap-3">
                {/* Animated AI Icon */}
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isPlaying 
                      ? 'bg-gradient-to-br from-green-500 to-blue-500 animate-pulse' 
                      : 'bg-gray-700'
                  }`}>
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
                
                {/* Text Content */}
                <div className="flex-1">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200 font-sans">
                    {displayText}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with status */}
          <div className="px-4 py-2 bg-gray-900 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <span>Language: {currentLangInfo?.label || 'English'}</span>
            <span>{isPlaying ? '🎙️ Speaking' : isPaused ? '⏸️ Paused' : '⏹️ Ready'}</span>
            <span>Speed: {speechRate}x</span>
          </div>
        </>
      )}
    </div>
  );
};

export default AITeacherAnimation;

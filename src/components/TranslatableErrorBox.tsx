import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Square, Loader2, Languages } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// All supported targets (must match edge function enum)
const TARGETS: Array<{ label: string; bcp47: string }> = [
  { label: 'English', bcp47: 'en-US' },
  // Indian
  { label: 'Hindi', bcp47: 'hi-IN' },
  { label: 'Telugu', bcp47: 'te-IN' },
  { label: 'Tamil', bcp47: 'ta-IN' },
  { label: 'Kannada', bcp47: 'kn-IN' },
  { label: 'Malayalam', bcp47: 'ml-IN' },
  { label: 'Bengali', bcp47: 'bn-IN' },
  { label: 'Gujarati', bcp47: 'gu-IN' },
  { label: 'Marathi', bcp47: 'mr-IN' },
  { label: 'Punjabi', bcp47: 'pa-IN' },
  { label: 'Odia', bcp47: 'or-IN' },
  { label: 'Assamese', bcp47: 'as-IN' },
  { label: 'Urdu', bcp47: 'ur-IN' },
  { label: 'Sanskrit', bcp47: 'sa-IN' },
  { label: 'Nepali', bcp47: 'ne-NP' },
  { label: 'Konkani', bcp47: 'kok-IN' },
  { label: 'Maithili', bcp47: 'mai-IN' },
  { label: 'Sindhi', bcp47: 'sd-IN' },
  { label: 'Kashmiri', bcp47: 'ks-IN' },
  { label: 'Manipuri', bcp47: 'mni-IN' },
  { label: 'Bodo', bcp47: 'brx-IN' },
  { label: 'Santali', bcp47: 'sat-IN' },
  { label: 'Dogri', bcp47: 'doi-IN' },
  // Foreign
  { label: 'Spanish', bcp47: 'es-ES' },
  { label: 'French', bcp47: 'fr-FR' },
  { label: 'German', bcp47: 'de-DE' },
  { label: 'Portuguese', bcp47: 'pt-PT' },
  { label: 'Italian', bcp47: 'it-IT' },
  { label: 'Russian', bcp47: 'ru-RU' },
  { label: 'Arabic', bcp47: 'ar-SA' },
  { label: 'Chinese', bcp47: 'zh-CN' },
  { label: 'Japanese', bcp47: 'ja-JP' },
  { label: 'Korean', bcp47: 'ko-KR' },
  { label: 'Turkish', bcp47: 'tr-TR' },
  { label: 'Vietnamese', bcp47: 'vi-VN' },
  { label: 'Indonesian', bcp47: 'id-ID' },
  { label: 'Thai', bcp47: 'th-TH' },
  { label: 'Dutch', bcp47: 'nl-NL' },
  { label: 'Polish', bcp47: 'pl-PL' },
  { label: 'Swedish', bcp47: 'sv-SE' },
];

interface Props {
  title: string;
  originalText: string;
}

const TranslatableErrorBox = ({ title, originalText }: Props) => {
  const [target, setTarget] = useState('English');
  const [translated, setTranslated] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const { toast } = useToast();

  const lang = useMemo(() => TARGETS.find(t => t.label === target) || TARGETS[0], [target]);

  // Reset translation when source changes
  useEffect(() => { setTranslated(''); setTarget('English'); }, [originalText]);

  const display = target === 'English' || !translated ? originalText : translated;

  const onChangeLang = async (newLang: string) => {
    setTarget(newLang);
    if (newLang === 'English' || !originalText) { setTranslated(''); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-explanation', {
        body: { text: originalText.slice(0, 9500), targetLanguage: newLang },
      });
      if (error) throw error;
      setTranslated(data?.translatedText || '');
    } catch (e: any) {
      toast({ title: 'Translation failed', description: e.message || 'Try again', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const speak = () => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(display);
      u.lang = lang.bcp47;
      u.rate = 0.95;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  };

  const stop = () => { window.speechSynthesis.cancel(); setSpeaking(false); };

  return (
    <div className="analysis-box-red">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-full"></span>
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 opacity-70" />
          <select
            value={target}
            onChange={(e) => onChangeLang(e.target.value)}
            disabled={loading}
            className="bg-background border border-border rounded px-2 py-1 text-xs max-w-[180px]"
          >
            {TARGETS.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
          </select>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>
      </div>
      <pre className="whitespace-pre-wrap text-sm leading-relaxed">
        {display || 'No errors detected'}
      </pre>
      <div className="mt-3 flex gap-2">
        {!speaking ? (
          <Button onClick={speak} variant="outline" size="sm" className="gap-2">
            <Volume2 className="w-4 h-4" /> Read aloud ({target})
          </Button>
        ) : (
          <Button onClick={stop} variant="outline" size="sm" className="gap-2">
            <Square className="w-4 h-4" /> Stop
          </Button>
        )}
      </div>
    </div>
  );
};

export default TranslatableErrorBox;
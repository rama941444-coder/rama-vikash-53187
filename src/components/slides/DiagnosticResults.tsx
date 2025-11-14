import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface DiagnosticResultsProps {
  data: any;
}

const DiagnosticResults = ({ data }: DiagnosticResultsProps) => {
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState('en');
  const { toast } = useToast();

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-xl text-muted-foreground">
          No analysis results yet. Run an analysis from the previous slide.
        </p>
      </div>
    );
  }

  const generateTTS = async () => {
    if (!data.ttsNarration) return;

    setIsGeneratingTTS(true);

    try {
      // Translate text based on selected language
      let textToSpeak = data.ttsNarration;
      
      if (voiceLanguage !== 'en') {
        // Use Lovable AI to translate the text
        const { data: translationData, error: translationError } = await supabase.functions.invoke('generate-tts', {
          body: { 
            text: `Translate this to ${voiceLanguage === 'te' ? 'Telugu' : 'Hindi'}: ${data.ttsNarration}`,
            language: voiceLanguage
          }
        });

        if (!translationError && translationData?.narrationText) {
          textToSpeak = translationData.narrationText;
        }
      }

      // Generate speech
      const { data: ttsData, error } = await supabase.functions.invoke('generate-tts', {
        body: { text: textToSpeak, language: voiceLanguage }
      });

      if (error) throw error;

      if (ttsData?.narrationText) {
        // Use Web Speech API for instant playback
        const utterance = new SpeechSynthesisUtterance(ttsData.narrationText);
        utterance.lang = voiceLanguage === 'te' ? 'te-IN' : voiceLanguage === 'hi' ? 'hi-IN' : 'en-US';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
        
        toast({
          title: "🎙️ Voice Narration Playing",
          description: `Language: ${voiceLanguage === 'en' ? 'English' : voiceLanguage === 'te' ? 'Telugu' : 'Hindi'}`,
        });
      }
    } catch (error: any) {
      console.error('TTS error:', error);
      toast({
        title: "Voice Generation Failed",
        description: error.message || "Failed to generate audio",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const downloadPDF = () => {
    try {
      const doc = new jsPDF();
      let yPosition = 20;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const maxWidth = 170;

      // Helper to add text with word wrap and page breaks
      const addSection = (title: string, content: string, color: [number, number, number]) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }

        // Title
        doc.setFontSize(14);
        doc.setTextColor(...color);
        doc.text(title, margin, yPosition);
        yPosition += 10;

        // Content
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(content || 'N/A', maxWidth);
        
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, margin, yPosition);
          yPosition += 7;
        });
        
        yPosition += 10;
      };

      // Header
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('Code Analysis Report', margin, yPosition);
      yPosition += 15;

      // Red Box - Errors & Analysis
      addSection('Errors & Execution Analysis', data.analysis || 'No errors detected', [220, 38, 38]);

      // Green Box - Corrected Code
      addSection('Corrected Code', data.correctedCode || '// No corrections available', [34, 197, 94]);

      // Black Box - Output
      addSection('Execution Output', data.output || 'No output available', [0, 0, 0]);

      // Orange Box - Explanation
      addSection('Code Explanation', data.ttsNarration || 'No explanation available', [249, 115, 22]);

      // Blue Box - MCQ
      if (data.mcq && data.mcq.trim() !== '') {
        addSection('MCQ Questions', typeof data.mcq === 'string' ? data.mcq : JSON.stringify(data.mcq, null, 2), [59, 130, 246]);
      }

      // Cyan Box - Logic Analysis
      if (data.flowchart && data.flowchart.trim() !== '') {
        addSection('Flowchart / Logic Diagram', data.flowchart, [6, 182, 212]);
      }

      if (data.dsa && data.dsa.trim() !== '') {
        addSection('Data Structures & Algorithms Analysis', data.dsa, [6, 182, 212]);
      }

      doc.save('code-analysis-report.pdf');
      
      toast({
        title: "PDF Downloaded",
        description: "Analysis report saved successfully",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Download failed",
        description: "Could not generate PDF report",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Voice Mode Controls */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="voice-mode"
              checked={voiceEnabled}
              onCheckedChange={setVoiceEnabled}
            />
            <Label htmlFor="voice-mode" className="flex items-center gap-2 cursor-pointer">
              {voiceEnabled ? (
                <Volume2 className="w-5 h-5 text-primary" />
              ) : (
                <VolumeX className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="font-semibold">Voice Mode {voiceEnabled ? 'ON' : 'OFF'}</span>
            </Label>
          </div>
          
          {voiceEnabled && (
            <div className="flex items-center gap-2">
              <Label htmlFor="voice-lang" className="text-sm text-muted-foreground">
                Language:
              </Label>
              <Select value={voiceLanguage} onValueChange={setVoiceLanguage}>
                <SelectTrigger id="voice-lang" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="te">🇮🇳 Telugu</SelectItem>
                  <SelectItem value="hi">🇮🇳 Hindi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="text-center mb-8 flex flex-col items-center gap-2">
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center mb-2">
          <svg className="w-10 h-10 text-primary-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-3xl font-bold">Diagnostic Complete</h2>
        <Button
          onClick={downloadPDF}
          variant="outline"
          className="gap-2 mt-2"
        >
          <Download className="w-4 h-4" />
          Download PDF Report
        </Button>
      </div>

      <div className="grid gap-6">
        <div className="analysis-box-red">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            Errors & Execution Analysis
          </h3>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {data.analysis || 'No errors detected'}
          </pre>
          <div className="mt-3">
            {voiceEnabled && (
              <Button
                onClick={() => {
                  try {
                    const utterance = new SpeechSynthesisUtterance(data.analysis || '');
                    utterance.lang = voiceLanguage === 'te' ? 'te-IN' : voiceLanguage === 'hi' ? 'hi-IN' : 'en-US';
                    utterance.rate = 0.9;
                    utterance.pitch = 1;
                    utterance.volume = 1;
                    window.speechSynthesis.speak(utterance);
                    toast({ 
                      title: '🎙️ Playing Analysis', 
                      description: `Language: ${voiceLanguage === 'en' ? 'English' : voiceLanguage === 'te' ? 'Telugu' : 'Hindi'}` 
                    });
                  } catch (error) {
                    toast({ title: 'Audio playback failed', description: 'Could not play narration', variant: 'destructive' });
                  }
                }}
                variant="outline"
                className="gap-2"
              >
                <Volume2 className="w-4 h-4" />
                Play Analysis (Voice)
              </Button>
            )}
          </div>
        </div>

        {/* Green Box - Corrected Code */}
        <div className="analysis-box-green">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            ✅ Corrected Code
          </h3>
          <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed code-separator-style">
            {data.correctedCode || '// No corrections available'}
          </pre>
        </div>

        {/* Black Box - Output */}
        <div className="analysis-box-black">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-gray-500 rounded-full"></span>
            ⚡ Execution Output
          </h3>
          <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-white code-separator-style">
            {data.output || 'No output available'}
          </pre>
        </div>

        {/* Orange Box - Code Explanation with Voice */}
        <div className="analysis-box-orange">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
            Code Explanation (Voice Narration)
          </h3>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed mb-4">
            {data.ttsNarration || 'No explanation available'}
          </pre>
          <Button
            onClick={() => {
              try {
                const utterance = new SpeechSynthesisUtterance(data.ttsNarration);
                utterance.rate = 0.9;
                utterance.pitch = 1;
                utterance.volume = 1;
                window.speechSynthesis.speak(utterance);
                toast({
                  title: "Playing narration",
                  description: "Audio narration started",
                });
              } catch (error) {
                toast({
                  title: "Audio playback failed",
                  description: "Could not play narration",
                  variant: "destructive",
                });
              }
            }}
            disabled={isGeneratingTTS || !data.ttsNarration}
            variant="outline"
            className="gap-2"
          >
            <Volume2 className="w-4 h-4" />
            Play Voice Explanation
          </Button>
        </div>

        {/* Blue Box - MCQ Questions */}
        {data.mcq && data.mcq.trim() !== '' && (
          <div className="analysis-box-blue">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              MCQ Questions
            </h3>
            <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
              {typeof data.mcq === 'string' ? data.mcq : JSON.stringify(data.mcq, null, 2)}
            </div>
          </div>
        )}

        {/* Light Blue Box - Flowchart, DSA & HTML Preview */}
        {((data.flowchart && data.flowchart.trim() !== '') || 
          (data.dsa && data.dsa.trim() !== '') || 
          (data.correctedCode && (data.correctedCode.includes('<html') || data.correctedCode.includes('<!DOCTYPE')))) && (
          <div className="analysis-box-cyan">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-cyan-500 rounded-full"></span>
              Logic Analysis & Preview
            </h3>
            
            {/* Flowchart Section */}
            {data.flowchart && data.flowchart.trim() !== '' && (
              <div className="mb-6">
                <h4 className="text-md font-semibold mb-2">Flowchart / Logic Diagram</h4>
                <div className="border-l-4 border-cyan-400 pl-4">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
                    {data.flowchart}
                  </pre>
                </div>
                <div className="my-4 border-t-2 border-dotted border-cyan-400/50"></div>
              </div>
            )}

            {/* DSA Section */}
            {data.dsa && data.dsa.trim() !== '' && (
              <div className="mb-6">
                <h4 className="text-md font-semibold mb-2">Data Structures & Algorithms Analysis</h4>
                <div className="border-l-4 border-cyan-400 pl-4">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                    {data.dsa}
                  </pre>
                </div>
                {(data.correctedCode && (data.correctedCode.includes('<html') || data.correctedCode.includes('<!DOCTYPE'))) && (
                  <div className="my-4 border-t-2 border-dotted border-cyan-400/50"></div>
                )}
              </div>
            )}

            {/* HTML Preview Section */}
            {data.correctedCode && (data.correctedCode.includes('<html') || data.correctedCode.includes('<!DOCTYPE')) && (
              <div>
                <h4 className="text-md font-semibold mb-2">HTML/CSS/JavaScript Preview</h4>
                <div className="bg-white rounded-lg p-4 border-l-4 border-cyan-400">
                  <iframe 
                    srcDoc={data.correctedCode}
                    className="w-full min-h-[400px] border-0 rounded"
                    sandbox="allow-scripts"
                    title="HTML Preview"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagnosticResults;

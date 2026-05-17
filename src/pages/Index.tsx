import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import UniversalAnalyzer from '@/components/slides/UniversalAnalyzer';
import DraftBoard from '@/components/slides/DraftBoard';
import CodeInput from '@/components/slides/CodeInput';
import DiagnosticResults from '@/components/slides/DiagnosticResults';
import LiveCodeIDE from '@/components/slides/LiveCodeIDE';
import MasteryChallenge from '@/components/slides/MasteryChallenge';
import WebPreview from '@/components/slides/WebPreview';
import ImageOutput from '@/components/slides/ImageOutput';
import SlideIndicator from '@/components/SlideIndicator';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import aiHeaderIcon from '@/assets/ai-3d-icon.png';
import { UserMenu } from '@/components/auth/UserMenu';

const Index = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Persisted state for each notepad (code is preserved across slide navigation)
  const [codeInputCode, setCodeInputCode] = useState('');
  const [liveCodeIDECode, setLiveCodeIDECode] = useState('');
  
  // Web preview code - extracted from analysis results
  const [webPreviewCode, setWebPreviewCode] = useState('');

  // Extract pure HTML/CSS/JS from AI output that may be wrapped in
  // markdown fences or prose like "COMPLETE corrected code in TEXT format:"
  const extractWebCode = (raw: string): string => {
    if (!raw) return '';
    let s = raw;
    // Prefer fenced block (```html / ```)
    const fence = s.match(/```(?:html|HTML|markup)?\s*([\s\S]*?)```/);
    if (fence && fence[1]) s = fence[1];
    // Strip common AI prose prefixes
    s = s.replace(/^\s*(?:COMPLETE\s+)?corrected\s+code(?:\s+in\s+TEXT\s+format)?\s*:\s*-?\s*/i, '');
    // If still has prose before any HTML-ish tag, slice from there
    const idx = s.search(/<!DOCTYPE html|<html[\s>]|<body[\s>]|<head[\s>]|<div[\s>]|<style[\s>]|<script[\s>]/i);
    if (idx > 0) s = s.slice(idx);
    s = s.trim();
    // If after stripping there's still no HTML tag at all, return empty so we fall back to original
    if (!/<[a-zA-Z!][^>]*>/.test(s)) return '';
    return s;
  };

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setIsLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const goToLiveCodeSlide = () => {
    setCurrentSlide(4); // Live Code IDE is at index 4
  };

  // Check if code is web development (HTML/CSS/JS)
  const isWebCode = (code: string): boolean => {
    if (!code) return false;
    return code.includes('<html') || 
           code.includes('<!DOCTYPE') || 
           code.includes('<body') ||
           code.includes('<div') ||
           code.includes('<style>') ||
           code.includes('<script>');
  };

  const slides = [
    { 
      component: <DraftBoard onOpenLiveCode={goToLiveCodeSlide} />, 
      title: "Draft Board" 
    },
    { 
      component: <CodeInput 
        onAnalysisComplete={(data) => {
          setAnalysisData(data);
          // Prefer the user's original input for preview; only use corrected
          // if the original isn't HTML but the corrected is.
          const original  = extractWebCode(codeInputCode || '');
          const corrected = extractWebCode(data?.correctedCode || '');
          if (original && isWebCode(original)) {
            setWebPreviewCode(original);
          } else if (corrected && isWebCode(corrected)) {
            setWebPreviewCode(corrected);
          } else {
            setWebPreviewCode('');
          }
          setCurrentSlide(2);
        }}
        persistedCode={codeInputCode}
        onCodeChange={setCodeInputCode}
      />, 
      title: "Code/Document Input" 
    },
    { component: <DiagnosticResults data={analysisData} />, title: "AI Diagnostic Results" },
    { component: <UniversalAnalyzer />, title: "Universal File Analyzer" },
    { 
      component: <LiveCodeIDE 
        onAnalysisComplete={(data) => {
          setAnalysisData(data);
          // Check if it's web code and set preview
          const live = extractWebCode(liveCodeIDECode || '');
          if (live && isWebCode(live)) setWebPreviewCode(live);
          // Don't navigate to slide 3 - keep in slide 5 with output console
        }}
        persistedCode={liveCodeIDECode}
        onCodeChange={(code) => {
          setLiveCodeIDECode(code);
          // Auto-update web preview if it's HTML
          const extracted = extractWebCode(code);
          if (isWebCode(extracted)) setWebPreviewCode(extracted);
        }}
      />, 
      title: "Live Code IDE" 
    },
    {
      component: <MasteryChallenge 
        userCodeFromSlide2={codeInputCode}
        userCodeFromSlide5={liveCodeIDECode}
      />,
      title: "Mastery Challenge"
    },
    {
      component: <WebPreview combinedCode={webPreviewCode} />,
      title: "Web Preview"
    },
    {
      component: <ImageOutput code={codeInputCode || liveCodeIDECode} language="Auto-Detect" />,
      title: "Image Output"
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-primary/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold neon-text">
            AI Code Analysis & Diagnostic Suite
          </h1>
          <div className="flex items-center gap-4">
            <img src={aiHeaderIcon} alt="AI Icon" className="w-12 h-12 md:w-16 md:h-16 neon-glow" />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <SlideIndicator 
          totalSlides={slides.length} 
          currentSlide={currentSlide}
          onSlideClick={setCurrentSlide}
        />

        <div className="mt-8 min-h-[600px]">
          {slides[currentSlide].component}
        </div>

        <div className="flex justify-between items-center mt-8">
          <Button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            variant="outline"
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Slide {currentSlide + 1} of {slides.length}: {slides[currentSlide].title}
          </div>

          <Button
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </main>

      <footer className="border-t border-primary/30 mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Universal AI Code & File Analyzer - Supports multiple languages and file types
        </div>
      </footer>
    </div>
  );
};

export default Index;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import UniversalAnalyzer from '@/components/slides/UniversalAnalyzer';
import DraftBoard from '@/components/slides/DraftBoard';
import CodeInput from '@/components/slides/CodeInput';
import DiagnosticResults from '@/components/slides/DiagnosticResults';
import LiveCodeIDE from '@/components/slides/LiveCodeIDE';
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

  const slides = [
    { 
      component: <DraftBoard onOpenLiveCode={goToLiveCodeSlide} />, 
      title: "Draft Board" 
    },
    { 
      component: <CodeInput onAnalysisComplete={(data) => {
        setAnalysisData(data);
        setCurrentSlide(2);
      }} />, 
      title: "Code/Document Input" 
    },
    { component: <DiagnosticResults data={analysisData} />, title: "AI Diagnostic Results" },
    { component: <UniversalAnalyzer />, title: "Universal File Analyzer" },
    { 
      component: <LiveCodeIDE onAnalysisComplete={(data) => {
        setAnalysisData(data);
        setCurrentSlide(2);
      }} />, 
      title: "Live Code IDE" 
    },
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

interface SlideIndicatorProps {
  totalSlides: number;
  currentSlide: number;
  onSlideClick: (index: number) => void;
}

const SlideIndicator = ({ totalSlides, currentSlide, onSlideClick }: SlideIndicatorProps) => {
  return (
    <div className="flex justify-center gap-3">
      {Array.from({ length: totalSlides }).map((_, index) => (
        <button
          key={index}
          onClick={() => onSlideClick(index)}
          className={`h-2 rounded-full transition-all duration-300 ${
            index === currentSlide 
              ? 'w-12 bg-primary neon-glow' 
              : 'w-8 bg-muted hover:bg-muted-foreground/50'
          }`}
          aria-label={`Go to slide ${index + 1}`}
        />
      ))}
    </div>
  );
};

export default SlideIndicator;

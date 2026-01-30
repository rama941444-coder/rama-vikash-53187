import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronsUpDown, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UNIQUE_LANGUAGES, detectLanguage } from '@/lib/programmingLanguages';

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  code?: string;
  className?: string;
}

const LanguageSelector = ({ value, onChange, code, className }: LanguageSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredLanguages = useMemo(() => {
    if (!search) return UNIQUE_LANGUAGES;
    const searchLower = search.toLowerCase();
    return UNIQUE_LANGUAGES.filter(lang => 
      lang.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const handleAutoDetect = () => {
    if (code && code.trim().length > 0) {
      const detected = detectLanguage(code);
      if (detected !== "Auto-Detect") {
        onChange(detected);
        setOpen(false);
        return;
      }
    }
    onChange("Auto-Detect");
    setOpen(false);
  };

  const detectedLanguage = useMemo(() => {
    if (code && code.trim().length > 0) {
      return detectLanguage(code);
    }
    return null;
  }, [code]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">{value || "Select Language"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search 1600+ languages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        
        {/* Auto-detect button with detected language hint */}
        <div className="p-2 border-b">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={handleAutoDetect}
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Auto-Detect</span>
            {detectedLanguage && detectedLanguage !== "Auto-Detect" && (
              <span className="ml-auto text-xs text-muted-foreground">
                Detected: {detectedLanguage}
              </span>
            )}
          </Button>
        </div>

        <ScrollArea className="h-[300px]">
          <div className="p-2">
            {filteredLanguages.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No language found.
              </div>
            ) : (
              filteredLanguages.map((language) => (
                <Button
                  key={language}
                  variant="ghost"
                  className="w-full justify-start font-normal"
                  onClick={() => {
                    onChange(language);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === language ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {language}
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="border-t p-2 text-xs text-muted-foreground text-center">
          {UNIQUE_LANGUAGES.length} languages available
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LanguageSelector;

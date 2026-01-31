import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PROGRAMMING_LANGUAGES, LANGUAGE_CATEGORIES, getLanguagesByCategory } from '@/lib/programmingLanguages';

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const LanguageSelector = ({ 
  value, 
  onChange, 
  placeholder = "Select language..." 
}: LanguageSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter languages based on search
  const filteredLanguages = useMemo(() => {
    if (!searchQuery) return null; // Return null to show categories
    
    const query = searchQuery.toLowerCase();
    return PROGRAMMING_LANGUAGES.filter(lang => 
      lang.value.toLowerCase().includes(query) ||
      lang.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Get display label for selected value
  const selectedLanguage = PROGRAMMING_LANGUAGES.find(lang => lang.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">
            {selectedLanguage ? selectedLanguage.value : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search 1600+ languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList className="max-h-[400px] overflow-y-auto">
            <CommandEmpty>No language found.</CommandEmpty>
            
            {filteredLanguages ? (
              // Show search results
              <CommandGroup heading={`Search Results (${filteredLanguages.length})`}>
                {filteredLanguages.slice(0, 100).map((lang) => (
                  <CommandItem
                    key={lang.value}
                    value={lang.value}
                    onSelect={() => {
                      onChange(lang.value);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === lang.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{lang.value}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {lang.category}
                    </span>
                  </CommandItem>
                ))}
                {filteredLanguages.length > 100 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                    Showing 100 of {filteredLanguages.length} results. Type more to narrow down.
                  </div>
                )}
              </CommandGroup>
            ) : (
              // Show categorized list
              <>
                {LANGUAGE_CATEGORIES.map((category) => {
                  const categoryLanguages = getLanguagesByCategory(category);
                  if (categoryLanguages.length === 0) return null;
                  
                  return (
                    <CommandGroup key={category} heading={`${category} (${categoryLanguages.length})`}>
                      {categoryLanguages.map((lang) => (
                        <CommandItem
                          key={lang.value}
                          value={lang.value}
                          onSelect={() => {
                            onChange(lang.value);
                            setOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === lang.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span>{lang.value}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default LanguageSelector;

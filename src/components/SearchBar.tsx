import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarIcon, Search, Users, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  checkIn: Date | undefined;
  checkOut: Date | undefined;
  guests: number;
  children: number;
  childrenAges: number[];
  onCheckInChange: (date: Date | undefined) => void;
  onCheckOutChange: (date: Date | undefined) => void;
  onGuestsChange: (guests: number) => void;
  onChildrenChange: (children: number) => void;
  onChildrenAgesChange: (ages: number[]) => void;
  onSearch: () => void;
}

export function SearchBar({
  checkIn,
  checkOut,
  guests,
  children,
  childrenAges,
  onCheckInChange,
  onCheckOutChange,
  onGuestsChange,
  onChildrenChange,
  onChildrenAgesChange,
  onSearch,
}: SearchBarProps) {
  const { t } = useTranslation();
  const [guestsOpen, setGuestsOpen] = useState(false);

  // Handle children count change
  const handleChildrenChange = (newCount: number) => {
    onChildrenChange(newCount);
    // Adjust ages array
    if (newCount > childrenAges.length) {
      onChildrenAgesChange([...childrenAges, ...Array(newCount - childrenAges.length).fill(5)]);
    } else {
      onChildrenAgesChange(childrenAges.slice(0, newCount));
    }
  };

  const handleAgeChange = (index: number, age: number) => {
    const newAges = [...childrenAges];
    newAges[index] = age;
    onChildrenAgesChange(newAges);
  };

  // Auto-set checkout to next day when check-in changes
  useEffect(() => {
    if (checkIn && (!checkOut || checkOut <= checkIn)) {
      onCheckOutChange(addDays(checkIn, 1));
    }
  }, [checkIn]);

  return (
    <div className="bg-card rounded-xl shadow-xl border p-2 md:p-3">
      <div className="flex flex-col md:flex-row gap-2 md:gap-0 md:divide-x divide-border">
        {/* Check-in */}
        <div className="flex-1 px-2 md:px-4 py-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('booking.checkIn')}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start text-left font-normal p-0 h-auto hover:bg-transparent',
                  !checkIn && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                {checkIn ? format(checkIn, 'dd MMM yyyy', { locale: ru }) : t('booking.checkIn')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={checkIn}
                onSelect={onCheckInChange}
                disabled={(date) => date < new Date()}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Check-out */}
        <div className="flex-1 px-2 md:px-4 py-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('booking.checkOut')}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start text-left font-normal p-0 h-auto hover:bg-transparent',
                  !checkOut && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                {checkOut ? format(checkOut, 'dd MMM yyyy', { locale: ru }) : t('booking.checkOut')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={checkOut}
                onSelect={onCheckOutChange}
                disabled={(date) => date <= (checkIn || new Date())}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Guests & Children */}
        <div className="flex-1 px-2 md:px-4 py-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Гости
          </label>
          <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-left font-normal p-0 h-auto hover:bg-transparent"
              >
                <Users className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  {guests} взр.{children > 0 && `, ${children} дет.`}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-4">
                {/* Adults */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Взрослые</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onGuestsChange(Math.max(1, guests - 1))}
                      disabled={guests <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{guests}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onGuestsChange(Math.min(10, guests + 1))}
                      disabled={guests >= 10}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Children */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Дети</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleChildrenChange(Math.max(0, children - 1))}
                      disabled={children <= 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{children}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleChildrenChange(Math.min(6, children + 1))}
                      disabled={children >= 6}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Children Ages */}
                {children > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    <span className="text-xs text-muted-foreground">Возраст детей</span>
                    <div className="flex flex-wrap gap-2">
                      {childrenAges.map((age, index) => (
                        <select
                          key={index}
                          value={age}
                          onChange={(e) => handleAgeChange(index, parseInt(e.target.value))}
                          className="h-8 w-16 text-sm border rounded-md bg-background px-2"
                        >
                          {Array.from({ length: 18 }, (_, i) => (
                            <option key={i} value={i}>{i} лет</option>
                          ))}
                        </select>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Search Button */}
        <div className="px-2 py-2 md:pl-4 md:pr-2">
          <Button onClick={onSearch} className="w-full md:w-auto h-full md:px-8">
            <Search className="h-4 w-4 md:mr-2" />
            <span className="md:inline">Найти</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

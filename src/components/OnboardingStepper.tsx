import { Check, UserPlus, FileText, Building2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStepperProps {
  currentStep: number;
}

const steps = [
  { id: 1, title: 'Регистрация', icon: UserPlus },
  { id: 2, title: 'Заполнение формы', icon: FileText },
  { id: 3, title: 'Создание отеля', icon: Building2 },
  { id: 4, title: 'Ожидание', icon: Clock },
];

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  return (
    <div className="w-full max-w-lg mx-auto mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ease-out',
                    isCompleted && 'bg-green-500 text-white scale-100',
                    isActive && 'bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse',
                    !isCompleted && !isActive && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 animate-scale-in" />
                  ) : (
                    <Icon className="h-5 w-5 transition-transform duration-300" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs mt-2 font-medium transition-all duration-300 text-center max-w-[70px]',
                    isCompleted && 'text-green-600 dark:text-green-400',
                    isActive && 'text-primary font-semibold',
                    !isCompleted && !isActive && 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </span>
              </div>

              {/* Progress Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700 ease-out',
                      isCompleted ? 'w-full bg-green-500' : 'w-0 bg-primary'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

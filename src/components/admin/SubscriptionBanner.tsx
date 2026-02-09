import { Link } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubscriptionBannerProps {
  subscriptionStatus: string;
  trialEndsAt: string | null;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: typeof CheckCircle;
  className: string;
}> = {
  active: {
    label: 'Подписка активна',
    icon: CheckCircle,
    className: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300',
  },
  trial: {
    label: 'Пробный период',
    icon: Clock,
    className: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300',
  },
  expired: {
    label: 'Подписка истекла',
    icon: XCircle,
    className: 'bg-destructive/10 border-destructive/30 text-destructive',
  },
  suspended: {
    label: 'Подписка приостановлена',
    icon: AlertTriangle,
    className: 'bg-muted border-border text-muted-foreground',
  },
};

export function SubscriptionBanner({ subscriptionStatus, trialEndsAt }: SubscriptionBannerProps) {
  const config = STATUS_CONFIG[subscriptionStatus] || STATUS_CONFIG.suspended;
  const Icon = config.icon;

  const daysLeft = trialEndsAt ? differenceInDays(new Date(trialEndsAt), new Date()) : null;
  const isUrgent = subscriptionStatus === 'trial' && daysLeft !== null && daysLeft <= 3;
  const isExpiredOrSuspended = subscriptionStatus === 'expired' || subscriptionStatus === 'suspended';

  // Override to red if trial is urgent
  const bannerClass = isUrgent
    ? 'bg-destructive/10 border-destructive/30 text-destructive'
    : config.className;

  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-4 mb-4 ${bannerClass}`}>
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-5 w-5 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-medium">{config.label}</span>
          {subscriptionStatus === 'trial' && daysLeft !== null && (
            <span className="ml-2">
              {daysLeft > 0
                ? `· Осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`
                : '· Истекает сегодня'}
            </span>
          )}
        </div>
      </div>
      {(isExpiredOrSuspended || isUrgent) && (
        <Button size="sm" variant="outline" asChild className="flex-shrink-0">
          <Link to="/pricing">
            Тарифы
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      )}
    </div>
  );
}

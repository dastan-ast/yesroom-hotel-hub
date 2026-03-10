import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { MessageCircle, Phone, Clock, UserCheck, X, Plus, Send, Eye, EyeOff, BarChart3, Globe } from 'lucide-react';
import { ManualBookingDialog } from './ManualBookingDialog';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { usePhoneMask } from '@/hooks/usePhoneMask';

interface Lead {
  id: string;
  created_at: string;
  phone: string;
  name: string | null;
  source: string;
  status: string;
  admin_id: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  booking_id: string | null;
  notes: string | null;
  utm_data?: Record<string, string> | null;
}

interface Comment {
  id: string;
  created_at: string;
  content: string;
  author_name: string;
}

const STATUS_FILTERS = [
  { value: 'new', label: 'Новые', color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500' },
  { value: 'in_progress', label: 'В работе', color: 'bg-blue-500/20 text-blue-700 border-blue-500' },
  { value: 'converted', label: 'Конвертированные', color: 'bg-green-500/20 text-green-700 border-green-500' },
  { value: 'closed', label: 'Закрытые', color: 'bg-muted text-muted-foreground border-muted-foreground/30' },
];

const SLA_MINUTES = 15;

function getSlaMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

interface Props {
  hotelId: string;
}

export function LeadsTab({ hotelId }: Props) {
  const { user, profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('new');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // New lead form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState('whatsapp');
  const [creating, setCreating] = useState(false);

  // Manual booking dialog
  const [bookingOpen, setBookingOpen] = useState(false);
  const [prefillPhone, setPrefillPhone] = useState('');

  // SLA timer refresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeads = useCallback(async () => {
    const [{ data }, { data: allData }] = await Promise.all([
      supabase
        .from('leads' as any)
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('status', statusFilter)
        .order('created_at', { ascending: false }),
      supabase
        .from('leads' as any)
        .select('id, source, utm_data, created_at, status')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);
    
    if (data) {
      const sorted = (data as any[]).sort((a, b) => {
        if (statusFilter === 'new') {
          const aViolated = getSlaMinutes(a.created_at) > SLA_MINUTES;
          const bViolated = getSlaMinutes(b.created_at) > SLA_MINUTES;
          if (aViolated && !bViolated) return -1;
          if (!aViolated && bViolated) return 1;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setLeads(sorted as Lead[]);
    }
    if (allData) setAllLeads(allData as unknown as Lead[]);
    setLoading(false);
  }, [hotelId, statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `hotel_id=eq.${hotelId}` }, () => {
        fetchLeads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hotelId, fetchLeads]);

  const fetchComments = async (leadId: string) => {
    const { data } = await supabase
      .from('crm_comments' as any)
      .select('id, created_at, content, author_name')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    setComments((data as unknown as Comment[]) || []);
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    fetchComments(lead.id);
  };

  const handleClaim = async () => {
    if (!selectedLead || !user) return;
    const { error } = await supabase
      .from('leads' as any)
      .update({ admin_id: user.id, claimed_at: new Date().toISOString(), status: 'in_progress' })
      .eq('id', selectedLead.id);
    if (error) { toast.error('Ошибка'); return; }
    toast.success('Лид взят в работу');
    setSelectedLead({ ...selectedLead, admin_id: user.id, claimed_at: new Date().toISOString(), status: 'in_progress' });
    fetchLeads();
  };

  const handleClose = async () => {
    if (!selectedLead) return;
    const { error } = await supabase
      .from('leads' as any)
      .update({ status: 'closed', completed_at: new Date().toISOString() })
      .eq('id', selectedLead.id);
    if (error) { toast.error('Ошибка'); return; }
    toast.success('Лид закрыт');
    setSelectedLead(null);
    fetchLeads();
  };

  const handleCreateBooking = () => {
    if (!selectedLead) return;
    setPrefillPhone(selectedLead.phone);
    setBookingOpen(true);
  };

  const handleBookingSuccess = async (ids: string[]) => {
    if (!selectedLead || ids.length === 0) return;
    await supabase
      .from('leads' as any)
      .update({ status: 'converted', completed_at: new Date().toISOString(), booking_id: ids[0] })
      .eq('id', selectedLead.id);
    toast.success('Лид конвертирован в бронирование');
    setSelectedLead(null);
    fetchLeads();
  };

  const handleAddComment = async () => {
    if (!selectedLead || !newComment.trim() || !user) return;
    setSendingComment(true);
    await supabase.from('crm_comments' as any).insert({
      lead_id: selectedLead.id,
      author_id: user.id,
      author_name: profile?.full_name || 'Администратор',
      content: newComment.trim(),
    });
    setNewComment('');
    await fetchComments(selectedLead.id);
    setSendingComment(false);
  };

  const handleCreateLead = async () => {
    if (!newPhone.trim()) { toast.error('Укажите телефон'); return; }
    setCreating(true);
    const { error } = await supabase.from('leads' as any).insert({
      hotel_id: hotelId,
      phone: newPhone.trim(),
      name: newName.trim() || null,
      source: newSource,
    });
    if (error) { toast.error('Ошибка'); setCreating(false); return; }
    toast.success('Лид создан');
    setNewPhone(''); setNewName(''); setShowNewForm(false);
    setCreating(false);
    fetchLeads();
  };

  const isPhoneVisible = (lead: Lead) => lead.admin_id !== null;

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 0) return phone;
    let d = digits;
    if (d.startsWith('8') && d.length > 1) d = '7' + d.slice(1);
    else if (!d.startsWith('7') && d.length > 0) d = '7' + d;
    let f = '';
    if (d.length >= 1) f = '+' + d.charAt(0);
    if (d.length >= 2) f += ' (' + d.substring(1, Math.min(4, d.length));
    if (d.length >= 4) f += ')';
    if (d.length >= 5) f += ' ' + d.substring(4, Math.min(7, d.length));
    if (d.length >= 8) f += '-' + d.substring(7, Math.min(9, d.length));
    if (d.length >= 10) f += '-' + d.substring(9, Math.min(11, d.length));
    return f;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6" /> Лиды
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAnalytics(!showAnalytics)}>
            <BarChart3 className="h-4 w-4 mr-1" /> Аналитика
          </Button>
          <Button size="sm" onClick={() => setShowNewForm(!showNewForm)}>
            <Plus className="h-4 w-4 mr-1" /> Новый лид
          </Button>
        </div>
      </div>

      {/* New lead form */}
      {showNewForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Телефон *</Label>
                <Input placeholder="+7..." value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Имя</Label>
                <Input placeholder="Имя гостя" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Источник</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newSource} onChange={e => setNewSource(e.target.value)}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="phone">Телефон</option>
                  <option value="walk_in">Личный визит</option>
                  <option value="other">Другое</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateLead} disabled={creating}>Создать</Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewForm(false)}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* UTM Analytics */}
      {showAnalytics && allLeads.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4" /> Источники лидов
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(() => {
                const sourceCounts: Record<string, number> = {};
                allLeads.forEach(l => {
                  sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1;
                });
                const sourceLabels: Record<string, string> = {
                  whatsapp: 'WhatsApp', telegram: 'Telegram', phone: 'Телефон',
                  walk_in: 'Личный визит', website: 'Сайт', instagram: 'Instagram', other: 'Другое',
                };
                return Object.entries(sourceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => (
                    <div key={src} className="p-3 bg-muted/50 rounded-lg text-center">
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground">{sourceLabels[src] || src}</div>
                    </div>
                  ));
              })()}
            </div>
            {(() => {
              const utmSources: Record<string, number> = {};
              const utmCampaigns: Record<string, number> = {};
              allLeads.forEach(l => {
                const utm = (l as any).utm_data;
                if (utm?.utm_source) utmSources[utm.utm_source] = (utmSources[utm.utm_source] || 0) + 1;
                if (utm?.utm_campaign) utmCampaigns[utm.utm_campaign] = (utmCampaigns[utm.utm_campaign] || 0) + 1;
              });
              if (Object.keys(utmSources).length === 0) return null;
              return (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase">UTM-метки</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">utm_source</p>
                      {Object.entries(utmSources).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm py-0.5">
                          <span>{k}</span>
                          <Badge variant="secondary" className="text-[10px]">{v}</Badge>
                        </div>
                      ))}
                    </div>
                    {Object.keys(utmCampaigns).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">utm_campaign</p>
                        {Object.entries(utmCampaigns).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-sm py-0.5">
                            <span>{k}</span>
                            <Badge variant="secondary" className="text-[10px]">{v}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <Button
            key={f.value}
            size="sm"
            variant={statusFilter === f.value ? 'default' : 'outline'}
            onClick={() => { setStatusFilter(f.value); setSelectedLead(null); }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left column: lead list */}
        <div className="lg:col-span-2 space-y-2">
          {loading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Загрузка...</p>
          ) : leads.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Нет лидов</p>
          ) : (
            leads.map(lead => {
              const slaMin = getSlaMinutes(lead.created_at);
              const slaViolated = lead.status === 'new' && slaMin > SLA_MINUTES;

              return (
                <div
                  key={lead.id}
                  onClick={() => handleSelectLead(lead)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                    selectedLead?.id === lead.id ? 'border-primary bg-primary/5' : ''
                  } ${slaViolated ? 'border-destructive bg-destructive/5' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">
                        {lead.name || 'Без имени'}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{lead.source}</Badge>
                    </div>
                    {slaViolated && (
                      <Badge variant="destructive" className="text-[10px] animate-pulse shrink-0">
                        SLA {slaMin} мин
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span className={!isPhoneVisible(lead) ? 'blur-sm select-none' : ''}>
                      {formatPhoneDisplay(lead.phone)}
                    </span>
                    <span className="ml-auto">
                      {format(new Date(lead.created_at), 'dd.MM HH:mm', { locale: ru })}
                    </span>
                  </div>
                  {lead.status === 'new' && !slaViolated && slaMin > 0 && (
                    <div className="mt-1">
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-yellow-500 transition-all"
                          style={{ width: `${Math.min((slaMin / SLA_MINUTES) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right column: lead detail */}
        <div className="lg:col-span-3">
          {selectedLead ? (
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{selectedLead.name || 'Без имени'}</h3>
                  <Badge variant="outline" className={STATUS_FILTERS.find(f => f.value === selectedLead.status)?.color}>
                    {STATUS_FILTERS.find(f => f.value === selectedLead.status)?.label}
                  </Badge>
                </div>

                {/* Contact info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {isPhoneVisible(selectedLead) ? (
                      <span className="font-mono">{formatPhoneDisplay(selectedLead.phone)}</span>
                    ) : (
                      <span className="blur-sm select-none font-mono">{formatPhoneDisplay(selectedLead.phone)}</span>
                    )}
                    {!isPhoneVisible(selectedLead) && (
                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Создан: {format(new Date(selectedLead.created_at), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                  </div>
                  {selectedLead.claimed_at && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <UserCheck className="h-4 w-4" />
                      Взят в работу: {format(new Date(selectedLead.claimed_at), 'dd MMM HH:mm', { locale: ru })}
                    </div>
                  )}
                </div>

                {/* UTM data */}
                {selectedLead.utm_data && Object.keys(selectedLead.utm_data).length > 0 && (
                  <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                    <span className="font-medium flex items-center gap-1">
                      <Globe className="h-3 w-3" /> UTM-метки
                    </span>
                    {Object.entries(selectedLead.utm_data).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground">{k}:</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {selectedLead.status === 'new' && (
                    <Button onClick={handleClaim}>
                      <UserCheck className="h-4 w-4 mr-1" /> Взять в работу
                    </Button>
                  )}
                  {['new', 'in_progress'].includes(selectedLead.status) && selectedLead.admin_id && (
                    <Button variant="outline" onClick={handleCreateBooking}>
                      Создать бронь
                    </Button>
                  )}
                  {['new', 'in_progress'].includes(selectedLead.status) && (
                    <Button variant="ghost" onClick={handleClose}>
                      <X className="h-4 w-4 mr-1" /> Закрыть лид
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Comments */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Комментарии</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Нет комментариев</p>
                    ) : (
                      comments.map(c => (
                        <div key={c.id} className="p-2 bg-muted/50 rounded text-sm">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span className="font-medium">{c.author_name}</span>
                            <span>{format(new Date(c.created_at), 'dd.MM HH:mm')}</span>
                          </div>
                          <p>{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Добавить комментарий..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      className="min-h-[60px]"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    />
                    <Button size="icon" onClick={handleAddComment} disabled={sendingComment || !newComment.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Выберите лид из списка
            </div>
          )}
        </div>
      </div>

      {/* Manual booking dialog for lead conversion */}
      <ManualBookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        onSuccess={handleBookingSuccess}
        hotelId={hotelId}
        prefillPhone={prefillPhone}
      />
    </div>
  );
}

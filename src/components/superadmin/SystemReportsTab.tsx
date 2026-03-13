import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { FileDown, Plus, Trash2, Save, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { toast } from '@/hooks/use-toast';

interface ReportData {
  id?: string;
  month: string;
  changelog: string[];
  platformStats: {
    totalHotels: number;
    activeHotels: number;
    totalBookings: number;
    totalLeads: number;
    totalUsers: number;
  };
  plans: string[];
  knownIssues: string[];
}

export function SystemReportsTab() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [currentReport, setCurrentReport] = useState<ReportData>({
    month: format(new Date(), 'yyyy-MM'),
    changelog: [],
    platformStats: { totalHotels: 0, activeHotels: 0, totalBookings: 0, totalLeads: 0, totalUsers: 0 },
    plans: [],
    knownIssues: [],
  });
  const [newChangelog, setNewChangelog] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [newIssue, setNewIssue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchReports();
    fetchPlatformStats();
  }, []);

  const fetchReports = async () => {
    const { data } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('key', 'system_reports')
      .maybeSingle();
    
    if (data?.value) {
      const val = data.value as any;
      const savedReports = Array.isArray(val) ? val : (val.reports || []);
      setReports(savedReports);
      // Load current month report if exists
      const currentMonth = format(new Date(), 'yyyy-MM');
      const existing = savedReports.find((r: ReportData) => r.month === currentMonth);
      if (existing) {
        setCurrentReport(existing);
      }
    }
    setLoading(false);
  };

  const fetchPlatformStats = async () => {
    const [hotels, bookings, leads, users] = await Promise.all([
      supabase.from('hotels').select('id, subscription_status', { count: 'exact' }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);
    
    const hotelData = hotels.data || [];
    setCurrentReport(prev => ({
      ...prev,
      platformStats: {
        totalHotels: hotelData.length,
        activeHotels: hotelData.filter(h => h.subscription_status === 'active' || h.subscription_status === 'trial').length,
        totalBookings: bookings.count || 0,
        totalLeads: leads.count || 0,
        totalUsers: users.count || 0,
      }
    }));
  };

  const saveReport = async () => {
    setSaving(true);
    const updatedReports = [...reports.filter(r => r.month !== currentReport.month), currentReport]
      .sort((a, b) => b.month.localeCompare(a.month));

    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key: 'system_reports', value: { reports: updatedReports } as any, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (!error) {
      setReports(updatedReports);
      toast({ title: 'Отчёт сохранён' });
    } else {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    }
    setSaving(false);
  };

  const addItem = (field: 'changelog' | 'plans' | 'knownIssues', value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    setCurrentReport(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }));
    setter('');
  };

  const removeItem = (field: 'changelog' | 'plans' | 'knownIssues', index: number) => {
    setCurrentReport(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    const addTitle = (text: string) => {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(text, pageWidth / 2, y, { align: 'center' });
      y += 12;
    };

    const addSection = (title: string) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, y);
      y += 8;
    };

    const addBullet = (text: string) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(`• ${text}`, pageWidth - 28);
      doc.text(lines, 18, y);
      y += lines.length * 5 + 2;
    };

    const addStat = (label: string, value: number | string) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${label}: ${value}`, 18, y);
      y += 6;
    };

    // Header
    addTitle('YesRoom — System Report');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const monthLabel = format(new Date(currentReport.month + '-01'), 'LLLL yyyy', { locale: ru });
    doc.text(monthLabel, pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.setFontSize(8);
    doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Platform Stats
    addSection('Platform Statistics');
    const s = currentReport.platformStats;
    addStat('Total Hotels', s.totalHotels);
    addStat('Active Hotels', s.activeHotels);
    addStat('Total Bookings', s.totalBookings);
    addStat('Total Leads', s.totalLeads);
    addStat('Total Users', s.totalUsers);
    y += 4;

    // Changelog
    if (currentReport.changelog.length > 0) {
      addSection('Changelog — What Was Done');
      currentReport.changelog.forEach(item => addBullet(item));
      y += 4;
    }

    // Plans
    if (currentReport.plans.length > 0) {
      addSection('Plans for Next Period');
      currentReport.plans.forEach(item => addBullet(item));
      y += 4;
    }

    // Known Issues
    if (currentReport.knownIssues.length > 0) {
      addSection('Known Issues');
      currentReport.knownIssues.forEach(item => addBullet(item));
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text('YesRoom Platform — Confidential', pageWidth / 2, 290, { align: 'center' });

    doc.save(`YesRoom_Report_${currentReport.month}.pdf`);
    toast({ title: 'PDF сгенерирован' });
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Системные отчёты</h2>
          <p className="text-muted-foreground">Ежемесячные отчёты для клиентов</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="month"
            value={currentReport.month}
            onChange={(e) => {
              const month = e.target.value;
              const existing = reports.find(r => r.month === month);
              if (existing) {
                setCurrentReport(existing);
              } else {
                setCurrentReport(prev => ({ ...prev, month }));
              }
            }}
            className="w-48"
          />
          <Button variant="outline" onClick={saveReport} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Сохранить
          </Button>
          <Button onClick={generatePDF}>
            <FileDown className="h-4 w-4 mr-2" />
            Скачать PDF
          </Button>
        </div>
      </div>

      {/* Platform Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Статистика платформы</CardTitle>
          <CardDescription>Данные подгружаются автоматически</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-5 gap-4">
            {[
              { label: 'Отелей', value: currentReport.platformStats.totalHotels },
              { label: 'Активных', value: currentReport.platformStats.activeHotels },
              { label: 'Бронирований', value: currentReport.platformStats.totalBookings },
              { label: 'Лидов', value: currentReport.platformStats.totalLeads },
              { label: 'Пользователей', value: currentReport.platformStats.totalUsers },
            ].map(s => (
              <div key={s.label} className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Changelog */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Changelog — что сделано</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentReport.changelog.map((item, i) => (
            <div key={i} className="flex items-start gap-2 group">
              <Badge variant="secondary" className="mt-0.5 shrink-0">✓</Badge>
              <span className="flex-1 text-sm">{item}</span>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-6 w-6" onClick={() => removeItem('changelog', i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Новое изменение..." value={newChangelog} onChange={e => setNewChangelog(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem('changelog', newChangelog, setNewChangelog)} />
            <Button variant="outline" size="icon" onClick={() => addItem('changelog', newChangelog, setNewChangelog)}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Планы на следующий период</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentReport.plans.map((item, i) => (
            <div key={i} className="flex items-start gap-2 group">
              <Badge variant="outline" className="mt-0.5 shrink-0">→</Badge>
              <span className="flex-1 text-sm">{item}</span>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-6 w-6" onClick={() => removeItem('plans', i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Новый план..." value={newPlan} onChange={e => setNewPlan(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem('plans', newPlan, setNewPlan)} />
            <Button variant="outline" size="icon" onClick={() => addItem('plans', newPlan, setNewPlan)}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Known Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Известные проблемы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentReport.knownIssues.map((item, i) => (
            <div key={i} className="flex items-start gap-2 group">
              <Badge variant="destructive" className="mt-0.5 shrink-0">⚠</Badge>
              <span className="flex-1 text-sm">{item}</span>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-6 w-6" onClick={() => removeItem('knownIssues', i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Новая проблема..." value={newIssue} onChange={e => setNewIssue(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem('knownIssues', newIssue, setNewIssue)} />
            <Button variant="outline" size="icon" onClick={() => addItem('knownIssues', newIssue, setNewIssue)}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Previous Reports */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Архив отчётов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reports.map(r => (
                <div key={r.month} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(new Date(r.month + '-01'), 'LLLL yyyy', { locale: ru })}</span>
                    <span className="text-sm text-muted-foreground">{r.changelog.length} изменений</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentReport(r)}>Открыть</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

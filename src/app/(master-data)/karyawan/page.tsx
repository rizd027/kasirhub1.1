'use client';

import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, UserCircle2, MoreVertical, Search, RefreshCw, Phone, MapPin, Power, BarChart3, Receipt, Eye, EyeOff, Edit2, ChevronLeft, Save, Clock, Calendar, ChevronRight, Camera, CalendarIcon, Check } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/services/cloudinary';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PinDialog } from '@/components/ui/PinDialog';
import { Switch } from '@/components/ui/switch';
import * as XLSX from 'xlsx';

const emptyForm = {
  name: '',
  username: '',
  password: '',
  role: 'kasir',
  phone: '',
  whatsapp: '',
  address: '',
  gender: 'L',
  birth_place: '',
  birth_date: '',
  photo_url: '',
  can_view_reports: false,
  is_active: true,
};

export default function KaryawanPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showPinAuth, setShowPinAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [empStats, setEmpStats] = useState({ totalSales: 0, txCount: 0 });
  const [attendance, setAttendance] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<Record<string, number>>({});
  const [form, setForm] = useState(emptyForm);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [lastTouchDist, setLastTouchDist] = useState(0);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('employees').select('*').order('name');
      if (error) throw error;
      if (data) {
        setEmployees(data);
        fetchOnlineStatus(data);
      }
    } catch {
      toast.error('Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlineStatus = async (staffList: any[]) => {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const { data } = await supabase
        .from('attendance')
        .select('employee_id, type')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true });
      
      const status: Record<string, boolean> = {};
      data?.forEach(att => {
        if (att.type === 'in') status[att.employee_id] = true;
        else if (att.type === 'out') status[att.employee_id] = false;
      });
      setOnlineStatus(status);
    } catch {}
  };

  const fetchEmpStats = async (empId: string) => {
    try {
      const { data, error } = await supabase.from('transactions').select('total_amount').eq('employee_id', empId);
      if (error) throw error;
      const total = data?.reduce((sum, tx) => sum + Number(tx.total_amount), 0) || 0;
      setEmpStats({ totalSales: total, txCount: data?.length || 0 });
    } catch {}
  };

  const fetchAttendanceAndPerformance = async (empId: string) => {
    try {
      const { data: attData } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', empId)
        .order('created_at', { ascending: false })
        .limit(30);
      setAttendance(attData || []);

      const { data: txData } = await supabase
        .from('transactions')
        .select('total_amount, created_at')
        .eq('employee_id', empId);
      
      const salesMap: Record<string, number> = {};
      txData?.forEach(tx => {
        const date = new Date(tx.created_at).toDateString();
        salesMap[date] = (salesMap[date] || 0) + Number(tx.total_amount);
      });
      setDailySales(salesMap);
    } catch {}
  };

  const toggleVerify = async (record: any) => {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ is_verified: !record.is_verified })
        .eq('id', record.id);
      
      if (error) throw error;
      toast.success(record.is_verified ? 'Verifikasi dibatalkan' : 'Presensi diverifikasi');
      setAttendance(prev => prev.map(a => a.id === record.id ? { ...a, is_verified: !a.is_verified } : a));
    } catch {
      toast.error('Gagal memproses verifikasi');
    }
  };

  const exportPayroll = (emp: any) => {
    if (attendance.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    // Prepare data for Excel
    const data = attendance.map(att => {
      const dateStr = new Date(att.created_at).toDateString();
      const omzet = dailySales[dateStr] || 0;
      return {
        'Tanggal': format(new Date(att.created_at), 'yyyy-MM-dd'),
        'Jam': format(new Date(att.created_at), 'HH:mm'),
        'Tipe': att.type === 'in' ? 'MASUK' : 'PULANG',
        'Omzet Hari Ini': omzet,
        'Status Verifikasi': att.is_verified ? 'VERIFIED' : 'PENDING',
        'Lokasi (Lat,Lng)': att.latitude ? `${att.latitude},${att.longitude}` : '-'
      };
    });

    // Create Worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Set column widths for better readability
    const wscols = [
      { wch: 15 }, // Tanggal
      { wch: 10 }, // Jam
      { wch: 12 }, // Tipe
      { wch: 20 }, // Omzet
      { wch: 18 }, // Status
      { wch: 25 }, // Lokasi
    ];
    ws['!cols'] = wscols;

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat Presensi");

    // Generate and Download
    XLSX.writeFile(wb, `Payroll_${emp.name}_${format(new Date(), 'MMM_yyyy')}.xlsx`);
    
    toast.success('Laporan Excel berhasil diunduh');
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleSaveEmployee = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      let dataToSave: any = { ...form };
      
      // If we are editing and password is empty, don't update it
      if (selectedEmp && !form.password) {
        delete dataToSave.password;
      } else if (form.password) {
        // Only hash if password is provided
        const { hashPassword } = await import('@/utils/crypto');
        dataToSave.password = await hashPassword(form.password);
      }

      const { error } = selectedEmp
        ? await supabase.from('employees').update(dataToSave).eq('id', selectedEmp.id)
        : await supabase.from('employees').insert([dataToSave]);

      if (error) throw error;
      
      toast.success(selectedEmp ? 'Karyawan diperbarui' : 'Karyawan ditambahkan');
      setIsAddOpen(false);
      setSelectedEmp(null);
      setForm(emptyForm);
      fetchEmployees();
    } catch {
      toast.error('Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (emp: any) => {
    try {
      const { error } = await supabase.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id);
      if (error) throw error;
      toast.success(`Karyawan ${!emp.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchEmployees();
    } catch {
      toast.error('Gagal mengubah status');
    }
  };

  const openDetail = (emp: any) => {
    setSelectedEmp(emp);
    fetchEmpStats(emp.id);
    fetchAttendanceAndPerformance(emp.id);
    setIsDetailOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const t = toast.loading('Mengunggah foto...');
    try {
      const url = await uploadImage(file);
      setForm(prev => ({ ...prev, photo_url: url }));
      toast.success('Foto berhasil diunggah', { id: t });
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunggah foto', { id: t });
    }
  };

  const openEdit = () => {
    setForm({
      name: selectedEmp.name,
      username: selectedEmp.username || '',
      password: '', // ALWAYS empty when editing to prevent re-hashing
      role: selectedEmp.role,
      phone: selectedEmp.phone || '',
      whatsapp: selectedEmp.whatsapp || '',
      address: selectedEmp.address || '',
      gender: selectedEmp.gender || 'L',
      birth_place: selectedEmp.birth_place || '',
      birth_date: selectedEmp.birth_date || '',
      photo_url: selectedEmp.photo_url || '',
      can_view_reports: selectedEmp.can_view_reports || false,
      is_active: selectedEmp.is_active,
    });
    setIsDetailOpen(false);
    setIsAddOpen(true);
  };

  const filteredEmployees = employees.filter(emp =>
    (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SettingsLayout
      title="Manajemen Karyawan"
      rightAction={
        <Button
          variant="ghost"
          size="icon"
          className="text-indigo-600 hover:bg-indigo-50 rounded-full"
          onClick={() => {
            const savedPin = localStorage.getItem('kasirhub_app_password');
            if (savedPin) setShowPinAuth(true);
            else { setSelectedEmp(null); setForm(emptyForm); setIsAddOpen(true); }
          }}
        >
          <UserPlus className="h-5 w-5" />
        </Button>
      }
    >
      <div className="flex flex-col pb-32">
        {/* Search */}
        <div className="px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama karyawan..."
              className="pl-10 h-10 bg-transparent border-0 border-b-2 border-slate-200 rounded-none text-sm font-medium focus-visible:ring-0 focus-visible:border-indigo-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading && employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3">
            <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Memuat Data...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <UserCircle2 className="h-8 w-8 text-slate-200" />
            </div>
            <p className="text-sm font-bold text-slate-400">Belum ada karyawan</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                onClick={() => openDetail(emp)}
                className={cn(
                  "px-6 py-5 border-b border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer",
                  !emp.is_active && "opacity-50 grayscale-[0.5]"
                )}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 border border-slate-200 shadow-sm overflow-hidden">
                      {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover" /> : <UserCircle2 className="h-7 w-7" />}
                    </div>
                    {onlineStatus[emp.id] && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white bg-emerald-500 animate-pulse shadow-sm" title="Sedang Kerja" />
                    )}
                    <div className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white", emp.is_active ? "bg-indigo-500" : "bg-slate-300")} />
                  </div>
                  <div className="flex flex-col flex-1">
                    <div className="text-sm font-black text-slate-800 flex items-center gap-2">
                      {emp.name}
                      <Badge className={cn("h-4 px-1.5 text-[8px] uppercase font-black tracking-tighter", emp.role === 'admin' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600")}>
                        {emp.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[9px] text-slate-600 font-bold uppercase tracking-tight">
                        <Phone className="h-2.5 w-2.5" />{emp.phone || '-'}
                      </span>
                      {!emp.is_active && <span className="text-[9px] text-amber-700 font-black uppercase tracking-tighter italic">Nonaktif</span>}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-indigo-600 rounded-xl">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== FULLSCREEN Detail View ===== */}
      {isDetailOpen && selectedEmp && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white overflow-hidden animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 shrink-0 bg-white">
            <button
              onClick={() => setIsDetailOpen(false)}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ChevronLeft className="size-6" />
            </button>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Detail Karyawan
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportPayroll(selectedEmp)}
                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex items-center gap-2"
                title="Download Laporan Payroll Excel"
              >
                <Save className="size-5" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Export Excel</span>
              </button>
              <button
                onClick={openEdit}
                className="p-2 -mr-2 text-indigo-600 hover:text-indigo-700 transition-all"
              >
                <Edit2 className="size-5" />
              </button>
            </div>
          </div>

          {/* Content Container */}
          <div className="flex-1 overflow-y-auto lg:overflow-hidden bg-white">
            <div className="lg:grid lg:grid-cols-12 lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
              {/* Left Column: Profile & Settings */}
              <div className="lg:col-span-4 lg:border-r lg:border-slate-200 bg-white lg:overflow-y-auto">
                {/* Profile Section */}
                <div className="px-6 py-10 flex flex-col items-center border-b border-slate-200">
                  <div 
                    className="w-28 h-28 lg:w-32 lg:h-32 rounded-[2.5rem] lg:rounded-[3rem] bg-slate-50 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-inner mb-6 cursor-zoom-in active:scale-95 transition-transform"
                    onClick={() => selectedEmp.photo_url && setPreviewImage(selectedEmp.photo_url)}
                  >
                    {selectedEmp.photo_url ? (
                      <img src={selectedEmp.photo_url} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle2 className="h-16 w-16 text-slate-300" />
                    )}
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{selectedEmp.name}</h2>
                    <Badge className={cn("mt-3 h-6 px-3 text-[10px] uppercase font-black tracking-[0.2em]", selectedEmp.role === 'admin' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600")}>
                      {selectedEmp.role} Toko
                    </Badge>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Informasi Kontak</h4>
                </div>
                <div className="divide-y divide-slate-100 border-b border-slate-200">
                  <div className="px-6 py-5 flex flex-col gap-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Telepon/WA</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 pl-5.5">{selectedEmp.whatsapp || selectedEmp.phone || '-'}</span>
                  </div>
                  <div className="px-6 py-5 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Domisili</span>
                    </div>
                    <span className="text-sm font-medium text-slate-900 pl-5.5 leading-relaxed">{selectedEmp.address || '-'}</span>
                  </div>
                </div>

                {/* Status & Permissions */}
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Izin & Status</h4>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Power className="h-4 w-4 text-slate-400" />
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Status Akun</span>
                    </div>
                    <Switch checked={selectedEmp.is_active} onCheckedChange={() => toggleStatus(selectedEmp)} />
                  </div>
                  <div className="px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Eye className="h-4 w-4 text-slate-400" />
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Akses Laporan</span>
                    </div>
                    <Badge variant={selectedEmp.can_view_reports ? "default" : "outline"} className="text-[10px] h-6 px-3 font-black tracking-widest">
                      {selectedEmp.can_view_reports ? 'DIIZINKAN' : 'DIBATASI'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Right Column: Performance & History */}
              <div className="lg:col-span-8 flex flex-col bg-slate-50/30 lg:overflow-hidden">
                {/* Stats Row */}
                <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 bg-white shrink-0">
                  <div className="p-8 flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2 text-center">Total Omzet</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight">Rp {empStats.totalSales.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="p-8 flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2 text-center">Transaksi</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight">{empStats.txCount} <span className="text-sm text-slate-500">Nota</span></p>
                  </div>
                </div>

                {/* Attendance History Section */}
                <div className="flex-1 bg-white lg:m-6 lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm overflow-hidden flex flex-col min-h-0">
                  <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between shrink-0">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Riwayat Presensi Terbaru</h4>
                    <Clock className="h-4 w-4 text-slate-300" />
                  </div>
                  
                  <div className="divide-y divide-slate-100 flex-1 overflow-y-auto custom-scrollbar">
                    {attendance.length === 0 ? (
                      <div className="px-6 py-20 text-center flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                          <Clock className="h-6 w-6 text-slate-200" />
                        </div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Belum ada aktivitas presensi</p>
                      </div>
                    ) : (
                      attendance.map((item) => {
                        const itemDate = new Date(item.created_at).toDateString();
                        const salesOnThatDay = dailySales[itemDate] || 0;
                        return (
                          <div key={item.id} className="px-6 py-5 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div 
                                className="flex items-center gap-4 cursor-zoom-in active:opacity-70 transition-opacity"
                                onClick={() => item.photo_url && setPreviewImage(item.photo_url)}
                              >
                                <div 
                                  className={cn(
                                    "w-14 h-14 rounded-xl flex items-center justify-center relative overflow-hidden border-2 border-slate-100 shadow-sm",
                                    item.type === 'in' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                  )}
                                >
                                  {item.photo_url ? (
                                    <img src={item.photo_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <Clock className="h-6 w-6" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                      Absen {item.type === 'in' ? 'Masuk' : 'Pulang'}
                                    </p>
                                    {item.is_verified ? (
                                      <Badge className="bg-blue-50 text-blue-600 border-blue-200 h-4 px-1.5 text-[8px] font-black uppercase">Verified</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-slate-300 border-slate-200 h-4 px-1.5 text-[8px] font-black uppercase">Pending</Badge>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight mt-0.5">
                                    {format(new Date(item.created_at), 'eeee, dd MMM yyyy • HH:mm', { locale: localeId })}
                                  </p>
                                  {item.latitude && (
                                    <a 
                                      href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1 hover:underline"
                                    >
                                      <MapPin className="size-2.5" /> Lihat Lokasi
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              {salesOnThatDay > 0 && (
                                <div className="text-right bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100 hidden sm:block">
                                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Omzet Hari Ini</p>
                                  <p className="text-xs font-black text-indigo-600">Rp {salesOnThatDay.toLocaleString('id-ID')}</p>
                                </div>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleVerify(item)}
                                className={cn(
                                  "rounded-lg transition-all",
                                  item.is_verified ? "text-blue-600 bg-blue-50" : "text-slate-300 hover:text-blue-600 hover:bg-blue-50"
                                )}
                              >
                                <Check className="size-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== FULLSCREEN Add/Edit Form ===== */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white overflow-hidden animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 h-14 border-b border-slate-200 shrink-0 bg-white">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setIsAddOpen(false); setSelectedEmp(null); setForm(emptyForm); }}
                className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ChevronLeft className="size-6" />
              </button>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                {selectedEmp ? 'Perbarui Data Karyawan' : 'Registrasi Karyawan Baru'}
              </h2>
            </div>
            <button
              onClick={handleSaveEmployee}
              disabled={loading || !form.name.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-30 shadow-lg shadow-indigo-100"
            >
              <Save className="size-4" />
              Simpan Perubahan
            </button>
          </div>

          {/* Form Body - 2 Column Layout on Desktop */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full lg:grid lg:grid-cols-12 lg:overflow-hidden">
              
              {/* LEFT SIDEBAR: Photo & Quick Bio */}
              <div className="lg:col-span-4 border-r border-slate-200 bg-slate-50/30 overflow-y-auto p-10 flex flex-col items-center">
                <div className="relative group mb-8">
                  <div className="w-40 h-40 lg:w-48 lg:h-48 rounded-[3.5rem] bg-white border-4 border-white shadow-2xl flex items-center justify-center overflow-hidden ring-1 ring-slate-200">
                    {form.photo_url ? (
                      <img src={form.photo_url} className="w-full h-full object-cover" alt="Karyawan" />
                    ) : (
                      <UserCircle2 className="h-24 w-24 text-slate-100" />
                    )}
                  </div>
                  <label className="absolute bottom-2 right-2 size-12 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl cursor-pointer hover:bg-indigo-700 transition-all active:scale-90 border-4 border-white">
                    <Camera className="size-5" />
                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                  </label>
                </div>

                <div className="w-full space-y-6">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nama Lengkap</Label>
                    <Input
                      autoFocus
                      placeholder="Masukkan nama lengkap"
                      className="h-12 bg-white border-2 border-slate-200 rounded-2xl px-5 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all shadow-sm"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Jabatan / Role</Label>
                    <Input
                      placeholder="Contoh: Senior Kasir"
                      className="h-12 bg-white border-2 border-slate-200 rounded-2xl px-5 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all shadow-sm"
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-12 p-6 rounded-3xl bg-indigo-50 border border-indigo-100 w-full">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-4">Pengaturan Akses</p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-indigo-900 uppercase tracking-tight">Lihat Laporan</span>
                      <span className="text-[10px] font-medium text-indigo-400">Izin akses menu laporan & statistik</span>
                    </div>
                    <Switch checked={form.can_view_reports} onCheckedChange={val => setForm({ ...form, can_view_reports: val })} />
                  </div>
                </div>
              </div>

              {/* RIGHT CONTENT: Detailed Data */}
              <div className="lg:col-span-8 overflow-y-auto custom-scrollbar bg-white">
                <div className="max-w-3xl mx-auto p-10 space-y-12">
                  
                  {/* SECTION: DATA PRIBADI */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="h-px bg-slate-200 flex-1" />
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] shrink-0">Informasi Pribadi</h3>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Jenis Kelamin</Label>
                        <div className="flex gap-3 pt-1">
                          {['L', 'P'].map((g) => (
                            <button
                              key={g}
                              onClick={() => setForm({ ...form, gender: g })}
                              className={cn(
                                "flex-1 h-12 rounded-2xl text-[10px] font-black transition-all border-2",
                                form.gender === g 
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                  : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                              )}
                            >
                              {g === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tempat Lahir</Label>
                          <Input
                            placeholder="Kota"
                            className="h-12 bg-transparent border-0 border-b-2 border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                            value={form.birth_place} onChange={e => setForm({ ...form, birth_place: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tgl Lahir</Label>
                          <Input
                            type="date"
                            className="h-12 bg-transparent border-0 border-b-2 border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                            value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION: KONTAK & ALAMAT */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="h-px bg-slate-200 flex-1" />
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] shrink-0">Kontak & Alamat</h3>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nomor Telepon</Label>
                        <Input
                          type="tel" placeholder="08xxxx"
                          className="h-12 bg-transparent border-0 border-b-2 border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                          value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">WhatsApp</Label>
                        <Input
                          type="tel" placeholder="08xxxx"
                          className="h-12 bg-transparent border-0 border-b-2 border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                          value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Alamat Domisili Lengkap</Label>
                      <Input
                        placeholder="Contoh: Jl. Merdeka No. 123, Kel. Kebun Jeruk"
                        className="h-12 bg-transparent border-0 border-b-2 border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                        value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* SECTION: KEAMANAN AKUN */}
                  <div className="space-y-8 pb-10">
                    <div className="flex items-center gap-4">
                      <div className="h-px bg-slate-200 flex-1" />
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] shrink-0">Kredensial Login</h3>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Username</Label>
                        <Input
                          placeholder="username_karyawan"
                          className="h-12 bg-transparent border-0 border-b-2 border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                          value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Password</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"} placeholder={selectedEmp ? "•••••••• (Biarkan kosong jika tidak ganti)" : "••••••••"}
                            className="h-12 bg-transparent border-0 border-b-2 border-slate-200 rounded-none px-0 pr-10 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600"
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <PinDialog
        isOpen={showPinAuth}
        onClose={() => setShowPinAuth(false)}
        onSuccess={() => {
          setShowPinAuth(false);
          setSelectedEmp(null);
          setForm(emptyForm);
          setIsAddOpen(true);
        }}
        title="Otorisasi Owner"
        description="Akses manajemen karyawan memerlukan verifikasi PIN Pak Bos."
      />

      {/* Image Preview Modal */}
      <Dialog 
        open={!!previewImage} 
        onOpenChange={(open) => {
          if (!open) {
            setPreviewImage(null);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
          }
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-[90vw] sm:max-w-md lg:max-w-lg p-0 overflow-hidden bg-transparent border-0 shadow-none z-[100]">
          <div className="relative w-full aspect-square bg-white flex items-center justify-center rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden border-[6px] border-indigo-600 shadow-2xl shadow-indigo-500/20">
            <div 
              className={cn(
                "w-full h-full flex items-center justify-center overflow-hidden touch-none",
                zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
              )}
              onWheel={(e) => {
                const delta = e.deltaY * -0.001;
                const newZoom = Math.min(Math.max(1, zoom + delta), 4);
                setZoom(newZoom);
                if (newZoom === 1) setPosition({ x: 0, y: 0 });
              }}
              onMouseDown={(e) => {
                if (zoom === 1) return;
                setIsDragging(true);
                setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
              }}
              onMouseMove={(e) => {
                if (!isDragging) return;
                setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                  );
                  setLastTouchDist(dist);
                } else if (zoom > 1) {
                  setIsDragging(true);
                  const touch = e.touches[0];
                  setStartPos({ x: touch.clientX - position.x, y: touch.clientY - position.y });
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 2) {
                  const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                  );
                  if (lastTouchDist > 0) {
                    const delta = (dist - lastTouchDist) * 0.01;
                    const newZoom = Math.min(Math.max(1, zoom + delta), 4);
                    setZoom(newZoom);
                    if (newZoom === 1) setPosition({ x: 0, y: 0 });
                  }
                  setLastTouchDist(dist);
                } else if (isDragging) {
                  const touch = e.touches[0];
                  setPosition({ x: touch.clientX - startPos.x, y: touch.clientY - startPos.y });
                }
              }}
              onTouchEnd={() => {
                setIsDragging(false);
                setLastTouchDist(0);
              }}
              onClick={() => {
                if (isDragging || lastTouchDist > 0) return;
                if (zoom === 1) setZoom(2);
                else {
                  setZoom(1);
                  setPosition({ x: 0, y: 0 });
                }
              }}
            >
              {previewImage && (
                <img 
                  src={previewImage} 
                  className="w-full h-full object-contain transition-transform duration-100 ease-out pointer-events-none select-none"
                  style={{ 
                    transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)` 
                  }}
                  alt="Preview" 
                />
              )}
            </div>
            
            {/* Zoom Indicator Badge */}
            {zoom > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-indigo-400">
                <p className="text-[10px] font-black text-white uppercase tracking-widest">
                  Zoom {zoom.toFixed(1)}x - {zoom === 4 ? 'Max' : 'Scroll/Cubit'}
                </p>
              </div>
            )}

            <button 
              onClick={() => {
                setPreviewImage(null);
                setZoom(1);
                setPosition({ x: 0, y: 0 });
              }}
              className="absolute top-4 right-4 size-10 bg-indigo-600/80 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-indigo-400 hover:bg-indigo-700 z-10 shadow-lg"
            >
              <Power className="size-5 rotate-45" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
}

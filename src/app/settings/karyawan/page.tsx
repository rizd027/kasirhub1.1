'use client';

import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, UserCircle2, MoreVertical, Search, RefreshCw, Phone, MapPin, Power, BarChart3, Receipt, Eye, Edit2, ChevronLeft, Save, Clock, Calendar, ChevronRight, Camera, CalendarIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showPinAuth, setShowPinAuth] = useState(false);
  
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [empStats, setEmpStats] = useState({ totalSales: 0, txCount: 0 });
  const [attendance, setAttendance] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<Record<string, number>>({});
  const [form, setForm] = useState(emptyForm);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('employees').select('*').order('name');
      if (error) throw error;
      if (data) setEmployees(data);
    } catch {
      toast.error('Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
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
        .limit(15);
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

  useEffect(() => { fetchEmployees(); }, []);

  const handleSaveEmployee = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      // Hash password before saving (only if a password was entered)
      let dataToSave = { ...form };
      if (form.password) {
        const { hashPassword } = await import('@/utils/crypto');
        dataToSave = { ...form, password: await hashPassword(form.password) };
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
      password: selectedEmp.password || '',
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
        <div className="px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input
              placeholder="Cari nama karyawan..."
              className="pl-10 h-10 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-sm font-medium focus-visible:ring-0 focus-visible:border-indigo-500"
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
                  "px-6 py-5 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50/50 transition-all cursor-pointer",
                  !emp.is_active && "opacity-50 grayscale-[0.5]"
                )}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 border border-slate-200 shadow-sm overflow-hidden">
                      {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover" /> : <UserCircle2 className="h-7 w-7" />}
                    </div>
                    <div className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white", emp.is_active ? "bg-emerald-500" : "bg-slate-300")} />
                  </div>
                  <div className="flex flex-col flex-1">
                    <div className="text-sm font-black text-slate-800 flex items-center gap-2">
                      {emp.name}
                      <Badge className={cn("h-4 px-1.5 text-[8px] uppercase font-black tracking-tighter", emp.role === 'admin' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600")}>
                        {emp.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                        <Phone className="h-2.5 w-2.5" />{emp.phone || '-'}
                      </span>
                      {!emp.is_active && <span className="text-[9px] text-amber-600 font-black uppercase tracking-tighter italic">Nonaktif</span>}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-300 hover:text-indigo-600 rounded-xl">
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
            <button
              onClick={openEdit}
              className="p-2 -mr-2 text-indigo-600 hover:text-indigo-700 transition-all"
            >
              <Edit2 className="size-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Profile Section */}
            <div className="px-6 py-8 flex flex-col items-center border-b border-slate-100 bg-white">
              <div className="w-24 h-24 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 flex items-center justify-center overflow-hidden shadow-inner mb-4">
                {selectedEmp.photo_url ? (
                  <img src={selectedEmp.photo_url} className="w-full h-full object-cover" />
                ) : (
                  <UserCircle2 className="h-12 w-12 text-slate-300" />
                )}
              </div>
              <div className="text-center">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{selectedEmp.name}</h2>
                <Badge className={cn("mt-2 h-5 px-2 text-[9px] uppercase font-black tracking-widest", selectedEmp.role === 'admin' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600")}>
                  {selectedEmp.role} Toko
                </Badge>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-white">
              <div className="p-5 flex flex-col items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Omzet</p>
                <p className="text-sm font-black text-slate-800">Rp {empStats.totalSales.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-5 flex flex-col items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Transaksi</p>
                <p className="text-sm font-black text-slate-800">{empStats.txCount} Nota</p>
              </div>
            </div>

            {/* Information Sections */}
            <div className="bg-white">
              {/* Contact Information */}
              <div className="px-6 py-4 bg-slate-50/50">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Informasi Kontak</h4>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-300" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Telepon/WA</span>
                  </div>
                  <span className="text-sm font-black text-slate-700">{selectedEmp.whatsapp || selectedEmp.phone || '-'}</span>
                </div>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-slate-300" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Domisili</span>
                  </div>
                  <span className="text-sm font-black text-slate-700 max-w-[150px] truncate text-right">{selectedEmp.address || '-'}</span>
                </div>
              </div>

              {/* Attendance & Sales History */}
              <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Riwayat Presensi</h4>
              </div>
              <div className="divide-y divide-slate-100">
                {attendance.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Belum ada data</p>
                  </div>
                ) : (
                  attendance.map((item) => {
                    const itemDate = new Date(item.created_at).toDateString();
                    const salesOnThatDay = dailySales[itemDate] || 0;
                    return (
                      <div key={item.id} className="px-6 py-4 flex items-center justify-between group active:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden",
                            item.type === 'in' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {item.photo_url ? (
                              <img src={item.photo_url} className="w-full h-full object-cover" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-700">
                              Absen {item.type === 'in' ? 'Masuk' : 'Pulang'}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                              {format(new Date(item.created_at), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                            </p>
                          </div>
                        </div>
                        {item.type === 'in' && salesOnThatDay > 0 && (
                          <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Omzet</p>
                            <p className="text-[10px] font-black text-indigo-600">Rp {salesOnThatDay.toLocaleString('id-ID')}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Status & Permissions */}
              <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Izin & Status</h4>
              </div>
              <div className="divide-y divide-slate-100 pb-10">
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Power className="h-4 w-4 text-slate-300" />
                    <span className="text-sm font-black text-slate-700">Status Akun</span>
                  </div>
                  <Switch checked={selectedEmp.is_active} onCheckedChange={() => toggleStatus(selectedEmp)} />
                </div>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Eye className="h-4 w-4 text-slate-300" />
                    <span className="text-sm font-black text-slate-700">Akses Laporan</span>
                  </div>
                  <Badge variant={selectedEmp.can_view_reports ? "default" : "outline"} className="text-[9px] h-6 px-3 font-black">
                    {selectedEmp.can_view_reports ? 'DIIZINKAN' : 'DIBATASI'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== FULLSCREEN Add/Edit Form ===== */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 shrink-0">
            <button
              onClick={() => { setIsAddOpen(false); setSelectedEmp(null); setForm(emptyForm); }}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ChevronLeft className="size-6" />
            </button>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              {selectedEmp ? 'Edit Karyawan' : 'Karyawan Baru'}
            </h2>
            <button
              onClick={handleSaveEmployee}
              disabled={loading || !form.name.trim()}
              className="p-2 -mr-2 text-indigo-600 hover:text-indigo-700 transition-all disabled:opacity-30"
            >
              <Save className="size-6" />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7">
            {/* Photo Upload Section */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="relative group">
                <div className="w-24 h-24 rounded-[2.5rem] bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
                  {form.photo_url ? (
                    <img src={form.photo_url} className="w-full h-full object-cover" alt="Karyawan" />
                  ) : (
                    <UserCircle2 className="h-12 w-12 text-slate-300" />
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-9 h-9 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg cursor-pointer hover:bg-indigo-700 transition-all active:scale-90 border-4 border-white">
                  <Camera className="size-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </label>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto Karyawan</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Nama Lengkap</Label>
              <Input
                autoFocus
                placeholder="Nama karyawan"
                className="h-11 bg-transparent border-0 border-b-2 border-slate-100 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Jabatan / Role</Label>
                <Input
                  placeholder="Kasir / Admin Toko / dll"
                  className="h-11 bg-transparent border-0 border-b-2 border-slate-100 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Akses Laporan</Label>
                <div className="flex items-center gap-2 h-11 border-b-2 border-slate-100">
                  <Switch checked={form.can_view_reports} onCheckedChange={val => setForm({ ...form, can_view_reports: val })} />
                  <span className="text-[10px] font-bold text-slate-400">{form.can_view_reports ? 'Aktif' : 'Nonaktif'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Jenis Kelamin</Label>
              <div className="flex gap-2 pt-1">
                {['L', 'P'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setForm({ ...form, gender: g })}
                    className={cn(
                      "flex-1 h-10 rounded-xl text-xs font-black transition-all border-2",
                      form.gender === g 
                        ? "bg-indigo-50 border-indigo-600 text-indigo-600" 
                        : "bg-white border-slate-100 text-slate-400"
                    )}
                  >
                    {g === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Tempat Lahir</Label>
                <Input
                  placeholder="Kota kelahiran"
                  className="h-11 bg-transparent border-0 border-b-2 border-slate-100 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all placeholder:font-normal"
                  value={form.birth_place} onChange={e => setForm({ ...form, birth_place: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Tanggal Lahir</Label>
                <Input
                  type="date"
                  className="h-11 bg-transparent border-0 border-b-2 border-slate-100 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                  value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Telepon</Label>
                <Input
                  type="tel" placeholder="08xx"
                  className="h-11 bg-transparent border-0 border-b-2 border-slate-100 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">WhatsApp</Label>
                <Input
                  type="tel" placeholder="08xx"
                  className="h-11 bg-transparent border-0 border-b-2 border-slate-100 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                  value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Username Login</Label>
                <Input
                  placeholder="dani_kasir"
                  className="h-11 bg-transparent border-0 border-b-2 border-slate-100 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                  value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Password Login</Label>
                <Input
                  type="password" placeholder="••••••••"
                  className="h-11 bg-transparent border-0 border-b-2 border-slate-100 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Alamat Lengkap</Label>
              <Input
                placeholder="Jl. Contoh No. 1"
                className="h-11 bg-transparent border-0 border-b-2 border-slate-100 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold transition-all"
                value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              />
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
    </SettingsLayout>
  );
}

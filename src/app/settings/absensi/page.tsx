'use client';

import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { UserCircle2, RefreshCw, Check, Camera, Clock, Fingerprint } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { CameraCapture } from '@/features/cashier/CameraCapture';
import { uploadImage } from '@/services/cloudinary';

import { useStaffStore } from '@/store/useStaffStore';
import { useRouter } from 'next/navigation';

import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function AbsensiPage() {
  const router = useRouter();
  const { session, setCheckedIn } = useStaffStore();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [absenStep, setAbsenStep] = useState<'select' | 'camera'>('select');
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [absenType, setAbsenType] = useState<'in' | 'out'>('in');
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState('');
  const [myHistory, setMyHistory] = useState<any[]>([]);
  
  const hasCheckedInToday = myHistory.some(item => 
    item.type === 'in' && 
    new Date(item.created_at).toDateString() === new Date().toDateString()
  );

  useEffect(() => {
    if (hasCheckedInToday) {
      setAbsenType('out');
    } else {
      setAbsenType('in');
    }
  }, [hasCheckedInToday]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');
      
      if (error) throw error;
      if (data) {
        setEmployees(data);
        if (session?.role === 'staff') {
          const me = data.find(e => e.id === session.id);
          if (me) {
            setSelectedEmp(me);
            fetchMyHistory(me.id);
          }
        }
      }
    } catch (err: any) {
      toast.error('Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyHistory = async (empId: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', empId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      if (data) setMyHistory(data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const onCapture = async (blob: Blob) => {
    if (!selectedEmp) return;
    setUploading(true);
    const toastId = toast.loading('Mengunggah foto selfie...');
    
    try {
      const file = new File([blob], `absen_${selectedEmp.id}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const photoUrl = await uploadImage(file);

      const { error } = await supabase
        .from('attendance')
        .insert([{
          employee_id: selectedEmp.id,
          type: absenType,
          photo_url: photoUrl,
          note: note
        }]);

      if (error) throw error;

      if (absenType === 'in') {
        setCheckedIn(true);
        toast.success('Absensi Masuk Berhasil! Selamat bekerja.', { id: toastId });
        setTimeout(() => router.push('/kasir'), 1500);
      } else {
        setCheckedIn(false);
        toast.success('Absensi Keluar Berhasil! Hati-hati di jalan.', { id: toastId });
        fetchMyHistory(selectedEmp.id);
      }

      setAbsenStep('select');
      setNote('');
      if (session?.role !== 'staff') setSelectedEmp(null);
    } catch (err: any) {
      toast.error('Gagal memproses absensi: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return (
    <SettingsLayout title="Absensi Karyawan">
      <div className="flex flex-col pb-32">
        {/* Banner Info */}
        <div className="px-6 py-5 bg-emerald-600 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-sm font-black uppercase tracking-widest mb-1">Presensi Tim</h3>
            <p className="text-[10px] text-emerald-100 font-medium uppercase tracking-wider leading-relaxed max-w-[80%]">
              Silakan ambil foto selfie untuk mencatat waktu masuk atau keluar kerja.
            </p>
          </div>
          <Fingerprint className="absolute -right-4 -bottom-4 h-24 w-24 text-white/10 rotate-12" />
        </div>

        {loading && employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3">
            <RefreshCw className="h-6 w-6 text-emerald-500 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Memuat Data Karyawan...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="max-w-md mx-auto bg-white rounded-xl border border-slate-100 shadow-xl shadow-slate-200/50 p-6">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">Selfie Absensi</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Bukti kehadiran real-time</p>
                </div>
              </div>

              {absenStep === 'select' ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider px-1">1. Konfirmasi Identitas</Label>
                    {session?.role === 'staff' ? (
                      <div className="flex items-center gap-4 p-5 rounded-xl bg-indigo-50 border border-indigo-100 shadow-sm shadow-indigo-100/50">
                        <div className="w-12 h-12 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center text-indigo-600 font-black text-lg">
                          {session.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mb-0.5">Sesi Login Aktif</p>
                          <p className="text-base font-black text-indigo-900">{session.name}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {employees.map(emp => (
                          <button
                            key={emp.id}
                            onClick={() => setSelectedEmp(emp)}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group",
                              selectedEmp?.id === emp.id 
                                ? "border-emerald-600 bg-emerald-50 shadow-sm" 
                                : "border-slate-50 hover:border-slate-100 hover:bg-slate-50/50"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                              selectedEmp?.id === emp.id ? "bg-white text-emerald-600 shadow-sm" : "bg-slate-50 text-slate-400"
                            )}>
                              <UserCircle2 className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col">
                              <span className={cn("text-sm font-black", selectedEmp?.id === emp.id ? "text-emerald-900" : "text-slate-700")}>
                                {emp.name}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase">{emp.role}</span>
                            </div>
                            {selectedEmp?.id === emp.id && (
                              <div className="ml-auto w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white animate-in zoom-in duration-200">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider px-1">2. Status Kehadiran</Label>
                    <div className="flex gap-3">
                      <button
                        disabled={hasCheckedInToday}
                        onClick={() => setAbsenType('in')}
                        className={cn(
                          "flex-1 h-14 rounded-xl font-black text-xs transition-all border-2",
                          absenType === 'in' 
                            ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-100 scale-[1.02]" 
                            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200",
                          hasCheckedInToday && "opacity-50 cursor-not-allowed bg-slate-50 grayscale"
                        )}
                      >
                        {hasCheckedInToday ? 'SUDAH ABSEN MASUK' : 'MASUK KERJA'}
                      </button>
                      <button
                        onClick={() => setAbsenType('out')}
                        className={cn(
                          "flex-1 h-14 rounded-xl font-black text-xs transition-all border-2",
                          absenType === 'out' 
                            ? "bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-100 scale-[1.02]" 
                            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                        )}
                      >
                        PULANG KERJA
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider px-1">3. Catatan Shift (Opsional)</Label>
                    <Textarea 
                      placeholder="Tuliskan kondisi shift, kendala toko, atau titipan pesan..."
                      className="min-h-[80px] rounded-xl bg-slate-50 border-slate-100 focus:border-indigo-500 text-xs font-medium"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                  </div>

                  <Button 
                    disabled={!selectedEmp}
                    onClick={() => setAbsenStep('camera')}
                    className="w-full h-16 bg-slate-900 hover:bg-black text-white font-black rounded-xl shadow-xl shadow-slate-200 mt-4 gap-3 text-sm active:scale-95 transition-all"
                  >
                    <Camera className="h-5 w-5" />
                    LANJUT AMBIL SELFIE
                  </Button>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-black">
                      {selectedEmp.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Siap Absen {absenType === 'in' ? 'Masuk' : 'Pulang'}</p>
                      <p className="text-sm font-black text-slate-800">{selectedEmp.name}</p>
                    </div>
                  </div>
                  
                  <CameraCapture 
                    onCapture={onCapture} 
                    onClose={() => setAbsenStep('select')} 
                  />
                  
                  <Button 
                    variant="ghost" 
                    className="w-full mt-6 text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                    onClick={() => setAbsenStep('select')}
                    disabled={uploading}
                  >
                    Batal / Ganti Nama
                  </Button>
                </div>
              )}
            </div>

            {/* My History Section */}
            {session?.role === 'staff' && myHistory.length > 0 && (
              <div className="max-w-md mx-auto space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Riwayat Absensi Saya</h3>
                  <span className="text-[10px] font-bold text-slate-400">10 Terakhir</span>
                </div>
                <div className="space-y-2">
                  {myHistory.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          item.type === 'in' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        )}>
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">Absen {item.type === 'in' ? 'Masuk' : 'Pulang'}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{format(new Date(item.created_at), 'dd MMM yyyy, HH:mm', { locale: localeId })}</p>
                        </div>
                      </div>
                      {item.note && (
                        <div className="max-w-[120px] truncate text-[9px] text-slate-400 italic bg-slate-50 px-2 py-1 rounded" title={item.note}>
                          "{item.note}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>
    </SettingsLayout>
  );
}

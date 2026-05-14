'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';
import { clearAllLocalData } from '@/utils/auth';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { 
  Camera, 
  Fingerprint, 
  Clock, 
  UserCircle2, 
  RefreshCw,
  Check,
  Power
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/db/dexie';
import { useStaffStore } from '@/store/useStaffStore';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { CameraCapture } from '@/features/absensi/CameraCapture';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/services/cloudinary';
import { addToSyncQueue, runSync } from '@/services/sync/syncManager';
import { createId } from '@/utils/uuid';

export default function AbsensiPage() {
  const router = useRouter();
  const { session, setCheckedIn, logout } = useStaffStore();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [absenType, setAbsenType] = useState<'in' | 'out' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [myHistory, setMyHistory] = useState<any[]>([]);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [hasCheckedOutToday, setHasCheckedOutToday] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cameraActive, setCameraActive] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{ sales: number; count: number } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetchEmployees();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedEmp) {
      checkTodayStatus(selectedEmp.id);
      fetchMyHistory(selectedEmp.id);
      setCameraActive(false);
    } else {
      setHasCheckedInToday(false);
      setHasCheckedOutToday(false);
      setMyHistory([]);
      setAbsenType(null);
      setCameraActive(false);
    }
  }, [selectedEmp]);

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
          const me = data.find((e: any) => e.id === session.id);
          if (me) setSelectedEmp(me);
        }
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkTodayStatus = async (empId: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const records = await db.attendance
        .where('employee_id')
        .equals(empId)
        .filter(r => new Date(r.created_at) >= today)
        .toArray();

      const hasIn = records.some(r => r.type === 'in');
      const hasOut = records.some(r => r.type === 'out');

      setHasCheckedInToday(hasIn);
      setHasCheckedOutToday(hasOut);
      setAbsenType(null); // Force manual selection
    } catch (err) {
      console.error('Failed to check status:', err);
    }
  };

  const fetchMyHistory = async (empId: string) => {
    try {
      const allHistory = await db.attendance
        .where('employee_id')
        .equals(empId)
        .toArray();
      
      const sorted = allHistory.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setMyHistory(sorted.slice(0, 10));
    } catch (err) {
      console.error('Failed to fetch local history:', err);
    }
  };

  const onCapture = async (imageBlob: Blob) => {
    if (!selectedEmp || !absenType) return;
    
    setUploading(true);
    const toastId = toast.loading('Memproses...');

    try {
      // 1. Get Location
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (err) {
        console.warn('Could not get location:', err);
      }

      // 2. Upload to Cloudinary
      const imageFile = new File([imageBlob], `${selectedEmp.id}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const photoUrl = await uploadImage(imageFile);

      if (!session) {
        toast.error('Sesi tidak valid, silakan login ulang');
        return;
      }

      // user_id harus UUID owner (auth.users), bukan ID karyawan.
      // selectedEmp.user_id adalah kolom FK ke auth.users di tabel employees.
      const ownerUserId = selectedEmp.user_id;
      if (!ownerUserId) {
        toast.error('Data toko tidak valid, hubungi admin');
        return;
      }

      const recordId = createId();
      const newRecord: any = {
        id: recordId,
        user_id: ownerUserId, 
        employee_id: selectedEmp.id,
        type: absenType,
        photo_url: photoUrl,
        latitude,
        longitude,
        is_verified: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        sync_status: 'pending',
        synced: 0
      };

      await db.attendance.add(newRecord);
      
      // Add to background sync queue
      await addToSyncQueue('attendance', 'insert', recordId, newRecord);
      
      // Trigger sync immediately
      runSync();
      
      toast.success(`${absenType === 'in' ? 'Check-in Berhasil' : 'Check-out Berhasil'}`, { id: toastId });
      
      if (absenType === 'in' && session?.role === 'staff') {
        setCheckedIn(true);
        setTimeout(() => {
          router.replace('/kasir');
        }, 1500);
      } else if (absenType === 'out' && session?.role === 'staff') {
        // Fetch stats for summary
        const today = new Date();
        today.setHours(0,0,0,0);
        const dailyTransactions = await db.transactions
          .where('employee_id').equals(selectedEmp.id)
          .and(t => new Date(t.created_at) >= today)
          .toArray();
        
        const totalSales = dailyTransactions.reduce((acc, t) => acc + t.total_amount, 0);
        setSummaryData({ sales: totalSales, count: dailyTransactions.length });
        setShowSummary(true);
        
        setCheckedIn(false);
      } else {
        await checkTodayStatus(selectedEmp.id);
        await fetchMyHistory(selectedEmp.id);
        setCameraActive(false);
        if (session?.role !== 'staff') setSelectedEmp(null);
      }
    } catch (err: any) {
      toast.error('Gagal: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    const toastId = toast.loading('Keluar...');
    try {
      // Jika shift sudah selesai (absen masuk & pulang), logout langsung tanpa absensi lagi
      setCheckedIn(false);
      await clearAllLocalData();
      router.replace('/login');
      toast.success('Berhasil keluar', { id: toastId });
    } catch (err) {
      toast.error('Gagal keluar', { id: toastId });
    }
  };

  const LogoutButton = (
    <button 
      onClick={handleLogout}
      className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
    >
      <Power className="size-3.5" />
      <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
    </button>
  );

  const DateTimeHeader = (
    <div className="flex flex-col items-end justify-center px-4 border-l border-slate-200 h-10">
      <div className="text-[11px] font-bold text-slate-900 uppercase tracking-widest leading-none">
        {format(currentTime, 'HH:mm:ss')}
      </div>
      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight mt-1">
        {format(currentTime, 'EEEE, dd MMM yyyy', { locale: localeId })}
      </div>
    </div>
  );

  return (
    <SettingsLayout 
      title="Absensi Karyawan" 
      leftAction={<div className="w-0" />}
      rightAction={
        <div className="flex items-center gap-4">
          {LogoutButton}
          {DateTimeHeader}
        </div>
      }
    >
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-white">
        {loading && employees.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading...</p>
          </div>
        ) : (
          <div className="flex-1 p-4 lg:p-6 overflow-hidden">
            <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* PANEL KIRI: PREMIUM MINIMALIST */}
              <div className="lg:col-span-7 flex flex-col min-h-0">
                {selectedEmp ? (
                  <div className="bg-white border border-slate-400 rounded-lg p-8 space-y-8">
                      {/* Header Identitas */}
                      <div className="flex items-center gap-6">
                        <div className="size-16 rounded-lg bg-[#151B3F] flex items-center justify-center text-2xl font-bold text-white">
                          {selectedEmp.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Karyawan Aktif</span>
                          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mt-1">{selectedEmp.name}</h2>
                          <div className="inline-flex mt-2">
                            <span className="text-[10px] font-bold px-3 py-1 rounded-md bg-slate-100 border border-slate-400 text-slate-800 uppercase tracking-widest">{selectedEmp.role}</span>
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-slate-400 w-full" />

                      {/* Status Toggle */}
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setAbsenType('in')}
                          disabled={hasCheckedInToday}
                          className={cn(
                            "h-16 rounded-lg font-black text-[11px] uppercase tracking-[0.2em] border-2",
                            absenType === 'in' ? "bg-[#4F39F6] border-[#4F39F6] text-white" : "bg-slate-50 border-slate-400 text-slate-600 hover:border-slate-500 hover:text-slate-800",
                            hasCheckedInToday && "opacity-20 cursor-not-allowed"
                          )}
                        >
                          {hasCheckedInToday ? 'Sudah Masuk' : 'Masuk Kerja'}
                        </button>
                        <button
                          onClick={() => setAbsenType('out')}
                          disabled={!hasCheckedInToday || hasCheckedOutToday}
                          className={cn(
                            "h-16 rounded-lg font-black text-[11px] uppercase tracking-[0.2em] border-2",
                            absenType === 'out' ? "bg-[#00BC7D] border-[#00BC7D] text-white" : "bg-slate-50 border-slate-400 text-slate-600 hover:border-slate-500 hover:text-slate-800",
                            (!hasCheckedInToday || hasCheckedOutToday) && "opacity-20 cursor-not-allowed"
                          )}
                        >
                          {hasCheckedOutToday ? 'Sudah Pulang' : 'Pulang Kerja'}
                        </button>
                      </div>

                      {/* Final Action */}
                      <button
                        disabled={uploading || (!cameraActive && !absenType && !(hasCheckedInToday && hasCheckedOutToday))}
                        onClick={() => {
                          if (hasCheckedInToday && hasCheckedOutToday) {
                            // Shift selesai → langsung kasir tanpa logout
                            setCheckedIn(true);
                            router.replace('/kasir');
                            return;
                          }

                          if (!cameraActive) {
                            setCameraActive(true);
                          } else {
                            const captureBtn = document.querySelector('[data-capture-btn]') as HTMLButtonElement;
                            if (captureBtn) captureBtn.click();
                          }
                        }}
                        className={cn(
                          "w-full h-16 rounded-lg flex items-center justify-center font-black text-[11px] uppercase tracking-[0.3em] border-2",
                          hasCheckedInToday && hasCheckedOutToday 
                            ? "bg-[#00BC7D] text-white border-[#00BC7D]" 
                            : !absenType ? "bg-slate-100 text-slate-400 border-slate-400 cursor-not-allowed opacity-50" 
                            : cameraActive ? "bg-[#4F39F6] text-white border-[#4F39F6]" : "bg-[#151B3F] text-white border-[#151B3F]"
                        )}
                      >
                        {uploading ? <RefreshCw className="size-4 animate-spin" /> : (
                          (hasCheckedInToday && hasCheckedOutToday) ? 'Shift Selesai → Kasir' : 
                          cameraActive ? 'Konfirmasi & Ambil Foto' : 'Aktifkan Kamera'
                        )}
                      </button>
                    </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-slate-400 rounded-lg p-12 text-center bg-slate-50">
                    <UserCircle2 className="size-16 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mt-6">Pilih Identitas</h3>
                    <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-8">
                      {employees.map(emp => (
                        <button key={emp.id} onClick={() => setSelectedEmp(emp)} className="p-5 rounded-lg bg-white border-2 border-slate-400 font-bold text-[11px] uppercase tracking-wider text-slate-700 hover:border-[#4F39F6] hover:text-[#4F39F6]">
                          {emp.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* PANEL KANAN: LOG AKTIVITAS */}
              <div className="lg:col-span-5 flex flex-col min-h-0 bg-white border border-slate-400 rounded-lg p-8">
                <div className="flex items-center gap-3 mb-8 shrink-0">
                  <div className="size-8 rounded-md bg-slate-100 flex items-center justify-center border border-slate-400">
                    <Clock className="size-4 text-slate-900" />
                  </div>
                  <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.3em]">Log Aktivitas</h3>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4 space-y-8">
                  {myHistory.length > 0 ? (
                    myHistory.map((item, idx) => (
                      <div key={item.id} className="relative flex gap-6">
                        {idx !== myHistory.length - 1 && <div className="absolute left-[7px] top-6 bottom-[-32px] w-0.5 bg-slate-400" />}
                        <div className={cn("relative z-10 size-4 rounded-sm border-2 border-white ring-1 ring-slate-400 mt-1 shrink-0", item.type === 'in' ? "bg-[#4F39F6]" : "bg-[#00BC7D]")} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">{item.type === 'in' ? 'Absen Masuk' : 'Absen Pulang'}</h4>
                            <span className="text-[10px] font-black text-slate-600">{format(new Date(item.created_at), 'HH:mm')}</span>
                          </div>
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-tight mb-4">{format(new Date(item.created_at), 'dd MMM yyyy', { locale: localeId })}</p>
                          {item.photo_url && (
                            <div className="relative aspect-square w-28 rounded-lg overflow-hidden border-2 border-slate-400">
                              <img src={item.photo_url} alt="Selfie" className="w-full h-full object-cover grayscale" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
                      <p className="text-[9px] font-bold uppercase tracking-widest">Belum ada riwayat</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* CAMERA OVERLAY */}
      {cameraActive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white rounded-lg overflow-hidden border-2 border-slate-900">
            <div className="aspect-[4/3] bg-slate-100">
              <CameraCapture onCapture={onCapture} onClose={() => setCameraActive(false)} />
            </div>
            
            {/* Header Overlay */}
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-none">
              <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20">
                <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Ambil Foto Absensi</p>
              </div>
              <button 
                onClick={() => setCameraActive(false)}
                className="size-10 rounded-lg bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/70 pointer-events-auto"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SHIFT SUMMARY OVERLAY */}
      {showSummary && summaryData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 flex flex-col items-center border-[6px] border-emerald-500 shadow-2xl">
             <div className="size-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
                <Check className="size-10 text-emerald-600" />
             </div>
             <h2 className="text-2xl font-black text-slate-900 tracking-tight text-center">Shift Selesai!</h2>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 mb-8 text-center">Laporan Kerja Hari Ini</p>
             
             <div className="w-full space-y-4 mb-10">
                <div className="bg-slate-50 p-6 rounded-lg border-2 border-slate-100 flex flex-col items-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Omzet</p>
                  <p className="text-xl font-black text-slate-900">Rp {summaryData.sales.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border-2 border-slate-100 flex flex-col items-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Transaksi</p>
                  <p className="text-xl font-black text-slate-900">{summaryData.count} Nota</p>
                </div>
             </div>

              <button
                onClick={async () => {
                  await clearAllLocalData();
                  router.replace('/login');
                }}
                className="w-full h-14 bg-emerald-600 text-white rounded-lg font-black text-[11px] uppercase tracking-[0.3em] shadow-lg shadow-emerald-200"
              >
                Selesai & Keluar
              </button>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}


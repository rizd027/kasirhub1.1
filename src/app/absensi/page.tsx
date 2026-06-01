'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';
import { clearAllLocalData } from '@/utils/auth';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { 
  Fingerprint, 
  Clock, 
  UserCircle2, 
  RefreshCw,
  Check,
  Power,
  Calendar,
  Camera as CameraIcon,
  LogOut,
  MapPin,
  ChevronRight,
  ArrowRight,
  History as HistoryIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/db/dexie';
import { useStaffStore } from '@/store/useStaffStore';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { CameraCapture } from '@/features/absensi/CameraCapture';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/services/cloudinary';
import { addToSyncQueue, runPushSync } from '@/services/sync/syncManager';
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
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            timeout: 10000, 
            enableHighAccuracy: true,
            maximumAge: 5000 
          });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (err: any) {
        console.warn('Geolocation failed or timed out:', err.message || err);
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
      
      // Trigger sync immediately (force push to cloud)
      await runPushSync(true);
      
      setCameraActive(false);
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
        if (session?.role !== 'staff') setSelectedEmp(null);
      }
    } catch (err: any) {
      toast.error('Gagal: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    const toastId = toast.loading('Mengunggah data dan keluar...');
    try {
      // Jika shift sudah selesai (absen masuk & pulang), logout langsung tanpa absensi lagi
      setCheckedIn(false);
      try {
        await runPushSync(true);
      } catch (e) {
        console.error('Sync before logout failed:', e);
      }
      await clearAllLocalData();
      router.replace('/login');
      toast.success('Berhasil keluar', { id: toastId });
    } catch (err) {
      toast.error('Gagal keluar', { id: toastId });
    }
  };

  const DateTimeHeader = (
    <div className="flex items-center gap-2 sm:gap-4 pl-2 sm:pl-4 border-l border-slate-100">
      <div className="flex flex-col items-end">
        <div className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-none">
          {format(currentTime, 'HH:mm')}
          <span className="text-[10px] ml-0.5 opacity-40 animate-pulse">:</span>
          {format(currentTime, 'ss')}
        </div>
        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 hidden sm:block">
          {format(currentTime, 'EEEE, dd MMM yyyy', { locale: localeId })}
        </div>
      </div>
      <div className="size-8 sm:size-10 rounded-md sm:rounded-lg bg-slate-50 border border-slate-100 hidden sm:flex items-center justify-center text-slate-400">
        <Calendar className="size-4 sm:size-5" />
      </div>
    </div>
  );

  const LogoutButton = (
    <button 
      onClick={handleLogout}
      className="flex items-center justify-center size-8 sm:size-10 sm:px-4 sm:w-auto rounded-md sm:rounded-lg bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-colors"
    >
      <LogOut className="size-4" />
      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline ml-2">Logout</span>
    </button>
  );

  return (
    <SettingsLayout 
      title="Absensi Karyawan" 
      leftAction={session?.role !== 'staff' ? undefined : <div className="w-0" />}
      rightAction={
        <div className="flex items-center gap-2 sm:gap-4">
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
          <div className="flex-1 p-3 overflow-y-auto bg-slate-50/50">
            <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* PANEL KIRI: ACTION CENTER */}
              <div className="lg:col-span-7 flex flex-col space-y-6">
                {selectedEmp ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    {/* Header Identitas - Compact & Balanced */}
                    <div className="bg-white rounded-xl p-4 lg:p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-2xl" />
                      
                      <div className="relative shrink-0">
                        <div className="size-20 lg:size-24 rounded-lg bg-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-indigo-100/50">
                          {selectedEmp.name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 size-8 rounded-md bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-lg">
                          <Check className="size-4 stroke-[3px]" />
                        </div>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Karyawan Aktif</span>
                          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-none">{selectedEmp.name}</h2>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                           <div className="px-4 py-1.5 rounded-md bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-100">
                             ID: {selectedEmp.id.slice(0, 8)}
                           </div>
                           <div className="px-4 py-1.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                             {selectedEmp.role}
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Cards - Masuk / Pulang (2 columns on mobile) */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <button
                        onClick={() => setAbsenType('in')}
                        disabled={hasCheckedInToday}
                        className={cn(
                          "group relative p-3 sm:p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-3 text-center overflow-hidden h-32 sm:h-36",
                          absenType === 'in' 
                            ? "bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-100 text-white" 
                            : "bg-white border-slate-100 text-slate-400 hover:border-indigo-200",
                          hasCheckedInToday && "opacity-40 grayscale cursor-not-allowed border-dashed"
                        )}
                      >
                        <div className={cn(
                          "size-10 sm:size-12 rounded-md flex items-center justify-center transition-all",
                          absenType === 'in' ? "bg-white/20" : "bg-slate-50 group-hover:bg-indigo-50"
                        )}>
                          <Fingerprint className={cn("size-5 sm:size-6", absenType === 'in' ? "text-white" : "text-slate-300 group-hover:text-indigo-400")} />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em]">Masuk</span>
                        </div>
                        {hasCheckedInToday && <div className="absolute top-2 right-2 sm:top-3 sm:right-3"><Check className="size-4 text-emerald-500" /></div>}
                      </button>

                      <button
                        onClick={() => setAbsenType('out')}
                        disabled={!hasCheckedInToday || hasCheckedOutToday}
                        className={cn(
                          "group relative p-3 sm:p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-3 text-center overflow-hidden h-32 sm:h-36",
                          absenType === 'out' 
                            ? "bg-emerald-600 border-emerald-600 shadow-xl shadow-emerald-100 text-white" 
                            : "bg-white border-slate-100 text-slate-400 hover:border-emerald-200",
                          (!hasCheckedInToday || hasCheckedOutToday) && "opacity-40 grayscale cursor-not-allowed border-dashed"
                        )}
                      >
                        <div className={cn(
                          "size-10 sm:size-12 rounded-md flex items-center justify-center transition-all",
                          absenType === 'out' ? "bg-white/20" : "bg-slate-50 group-hover:bg-emerald-50"
                        )}>
                          <LogOut className={cn("size-5 sm:size-6", absenType === 'out' ? "text-white" : "text-slate-300 group-hover:text-emerald-400")} />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em]">Pulang</span>
                        </div>
                        {hasCheckedOutToday && <div className="absolute top-2 right-2 sm:top-3 sm:right-3"><Check className="size-4 text-emerald-500" /></div>}
                      </button>
                    </div>

                    {/* Big Action Button */}
                    <button
                      disabled={uploading || (!cameraActive && !absenType && !(hasCheckedInToday && hasCheckedOutToday))}
                      onClick={() => {
                        if (hasCheckedInToday && hasCheckedOutToday) {
                          setCheckedIn(true);
                          router.replace('/kasir');
                          return;
                        }
                        if (!cameraActive) setCameraActive(true);
                        else {
                          const captureBtn = document.querySelector('[data-capture-btn]') as HTMLButtonElement;
                          if (captureBtn) captureBtn.click();
                        }
                      }}
                      className={cn(
                        "w-full h-20 rounded-md flex items-center justify-center font-black text-[13px] uppercase tracking-[0.3em] transition-all relative overflow-hidden group shadow-xl",
                        hasCheckedInToday && hasCheckedOutToday 
                          ? "bg-emerald-600 text-white shadow-emerald-100" 
                          : !absenType ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                          : cameraActive ? "bg-indigo-600 text-white shadow-indigo-200" : "bg-slate-900 text-white shadow-slate-300"
                      )}
                    >
                      <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                      <div className="relative flex items-center gap-4">
                        {uploading ? <RefreshCw className="size-6 animate-spin" /> : (
                          <>
                            {(hasCheckedInToday && hasCheckedOutToday) ? (
                              <>LANJUT BUKA KASIR <ArrowRight className="size-6" /></>
                            ) : cameraActive ? (
                              <><CameraIcon className="size-6" /> KONFIRMASI FOTO</>
                            ) : (
                              <><Fingerprint className="size-6" /> AKTIFKAN KAMERA</>
                            )}
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-100 rounded-lg p-12 text-center shadow-sm animate-in zoom-in-95 duration-500">
                    <div className="size-24 rounded-md bg-slate-50 flex items-center justify-center text-slate-200 mb-10 border border-slate-100 shadow-inner">
                      <UserCircle2 className="size-12" />
                    </div>
                    <div className="space-y-2 mb-12">
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-[0.3em]">Siapa Anda Hari Ini?</h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest max-w-[240px] mx-auto leading-relaxed">Pilih profil karyawan Anda untuk memulai sesi kerja</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                      {employees.map(emp => (
                        <button 
                          key={emp.id} 
                          onClick={() => setSelectedEmp(emp)} 
                          className="group p-6 rounded-md bg-slate-50 border border-transparent text-left transition-all hover:bg-white hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-100 flex items-center gap-4"
                        >
                          <div className="size-12 rounded-md bg-white border border-slate-100 flex items-center justify-center text-slate-300 font-black group-hover:text-indigo-600 group-hover:scale-110 transition-all">
                            {emp.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-black uppercase tracking-tight text-slate-800 truncate">{emp.name}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{emp.role}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* PANEL KANAN: LOG AKTIVITAS */}
              <div className="lg:col-span-5 flex flex-col min-h-0 bg-white rounded-lg border border-slate-100 shadow-sm p-4 lg:p-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
                  <Clock className="size-40 rotate-12" />
                </div>
                
                <div className="flex items-center justify-between mb-8 shrink-0 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-md bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
                      <HistoryIcon className="size-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Log Aktivitas</h3>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Real-time History</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar -mr-4 pr-4 space-y-8 relative z-10">
                  {myHistory.length > 0 ? (
                    myHistory.map((item, idx) => (
                      <div key={item.id} className="relative flex gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                        {idx !== myHistory.length - 1 && <div className="absolute left-[9px] top-6 bottom-[-36px] w-0.5 bg-slate-100" />}
                        <div className={cn(
                          "relative z-10 size-5 rounded-full border-4 border-white shadow mt-1 shrink-0", 
                          item.type === 'in' ? "bg-indigo-600 ring-2 ring-indigo-50" : "bg-emerald-500 ring-2 ring-emerald-50"
                        )} />
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                             <div className="space-y-1">
                                <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-tight leading-none">
                                  {item.type === 'in' ? 'Check-in Kerja' : 'Check-out Kerja'}
                                </h4>
                             </div>
                             <div className="text-right">
                                <span className="text-base font-black text-slate-900 tracking-tighter leading-none">{format(new Date(item.created_at), 'HH:mm')}</span>
                             </div>
                          </div>
                          
                          {item.photo_url && (
                            <div className="group relative w-full aspect-video rounded-md overflow-hidden border-2 border-white shadow-md shadow-slate-100 transition-all hover:scale-[1.02] cursor-pointer">
                              <img src={item.photo_url} alt="Proof" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="size-16 rounded-md bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner">
                        <RefreshCw className="size-6 text-slate-200" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">No Activity Yet</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* CAMERA OVERLAY - FULL SCREEN IMMERSIVE */}
      {cameraActive && (
        <div className="fixed inset-0 z-[110] bg-black">
          <CameraCapture 
            onCapture={onCapture} 
            onClose={() => setCameraActive(false)} 
          />
        </div>
      )}
      {/* SHIFT SUMMARY OVERLAY - PREMIUM REDESIGN */}
      {showSummary && summaryData && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-md rounded-lg p-8 lg:p-12 flex flex-col items-center relative overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border border-white">
             {/* Decorative Background Element */}
             <div className="absolute -top-24 -right-24 size-48 bg-emerald-500/10 rounded-full blur-3xl" />
             <div className="absolute -bottom-24 -left-24 size-48 bg-indigo-500/10 rounded-full blur-3xl" />
             
             {/* Success Icon Section */}
             <div className="relative mb-10">
                <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 animate-pulse" />
                <div className="relative size-24 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-200 rotate-6 transform transition-transform hover:rotate-0 duration-500">
                   <div className="size-16 rounded-md border-2 border-white/30 flex items-center justify-center">
                      <Check className="size-10 text-white stroke-[3px]" />
                   </div>
                </div>
             </div>

             <div className="text-center space-y-2 mb-10">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Shift Selesai!</h2>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Laporan Performa Hari Ini</p>
             </div>
             
             {/* Stats Grid - Premium Cards */}
              <div className="w-full grid grid-cols-2 gap-4 mb-12">
                 <div className="bg-slate-50/80 border border-slate-100 p-6 rounded-md flex flex-col items-center group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
                   <div className="size-10 rounded-md bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                     <div className="size-2 rounded-full bg-emerald-500" />
                   </div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Omzet</p>
                   <p className="text-lg font-black text-slate-900 tracking-tight">Rp {(summaryData?.sales || 0).toLocaleString('id-ID')}</p>
                 </div>
                 
                 <div className="bg-slate-50/80 border border-slate-100 p-6 rounded-md flex flex-col items-center group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
                   <div className="size-10 rounded-md bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                     <div className="size-2 rounded-full bg-indigo-500" />
                   </div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Transaksi</p>
                   <p className="text-lg font-black text-slate-900 tracking-tight">{(summaryData?.count || 0)} Nota</p>
                 </div>
              </div>

              {/* Action Button - Premium Gradient */}
              <button
                onClick={async () => {
                  const toastId = toast.loading('Mengunggah data shift terakhir...');
                  try {
                    await runPushSync(true);
                  } catch (e) {
                    console.error('Sync before logout failed:', e);
                  }
                  toast.loading('Membersihkan sesi...', { id: toastId });
                  await clearAllLocalData();
                  router.replace('/login');
                  toast.success('Sampai jumpa besok!', { id: toastId });
                }}
                className="group relative w-full h-20 bg-slate-900 text-white rounded-md font-black text-[13px] uppercase tracking-[0.3em] shadow-2xl shadow-slate-200 overflow-hidden active:scale-95 transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center justify-center gap-3">
                  SELESAI & KELUAR
                  <ArrowRight className="size-5 group-hover:translate- Gp-2 transition-transform" />
                </div>
              </button>
              
              <p className="mt-8 text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">KasirHub Premium POS &bull; v1.2</p>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}


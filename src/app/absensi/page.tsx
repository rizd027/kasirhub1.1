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
  ChevronRight
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

  const DateTimeHeader = (
    <div className="flex items-center gap-4 pl-4 border-l border-slate-100">
      <div className="flex flex-col items-end">
        <div className="text-sm font-black text-slate-900 tracking-tight leading-none">
          {format(currentTime, 'HH:mm')}
          <span className="text-[10px] ml-0.5 opacity-40 animate-pulse">:</span>
          {format(currentTime, 'ss')}
        </div>
        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          {format(currentTime, 'EEEE, dd MMM yyyy', { locale: localeId })}
        </div>
      </div>
      <div className="size-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
        <Calendar className="size-5" />
      </div>
    </div>
  );

  const LogoutButton = (
    <button 
      onClick={handleLogout}
      className="flex items-center gap-2 px-4 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-colors"
    >
      <LogOut className="size-4" />
      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Logout</span>
    </button>
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
                  <div className="bg-white rounded-3xl p-6 lg:p-10 space-y-10 shadow-xl shadow-slate-200/50 border border-slate-100">
                      {/* Header Identitas */}
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <div className="size-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-indigo-200">
                            {selectedEmp.name.charAt(0)}
                          </div>
                          <div className="absolute -bottom-2 -right-2 size-8 rounded-xl bg-emerald-500 border-4 border-white flex items-center justify-center text-white">
                            <Check className="size-4" />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Karyawan Aktif</span>
                          </div>
                          <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mt-1.5">{selectedEmp.name}</h2>
                          <div className="flex items-center gap-2 mt-3">
                             <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                               ID: {selectedEmp.id.slice(0, 8)}
                             </div>
                             <div className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                               {selectedEmp.role}
                             </div>
                          </div>
                        </div>
                      </div>

                      {/* Status Toggle - Premium Tabs */}
                      <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl gap-1">
                        <button
                          onClick={() => setAbsenType('in')}
                          disabled={hasCheckedInToday}
                          className={cn(
                            "h-14 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all",
                            absenType === 'in' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600",
                            hasCheckedInToday && "opacity-30 cursor-not-allowed"
                          )}
                        >
                          <div className={cn("size-2 rounded-full", hasCheckedInToday ? "bg-slate-400" : "bg-indigo-500")} />
                          {hasCheckedInToday ? 'Terabsen' : 'Masuk Kerja'}
                        </button>
                        <button
                          onClick={() => setAbsenType('out')}
                          disabled={!hasCheckedInToday || hasCheckedOutToday}
                          className={cn(
                            "h-14 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all",
                            absenType === 'out' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600",
                            (!hasCheckedInToday || hasCheckedOutToday) && "opacity-30 cursor-not-allowed"
                          )}
                        >
                          <div className={cn("size-2 rounded-full", hasCheckedOutToday ? "bg-slate-400" : "bg-emerald-500")} />
                          {hasCheckedOutToday ? 'Selesai' : 'Pulang Kerja'}
                        </button>
                      </div>

                      {/* Final Action - High End Button */}
                      <div className="pt-4">
                        <button
                          disabled={uploading || (!cameraActive && !absenType && !(hasCheckedInToday && hasCheckedOutToday))}
                          onClick={() => {
                            if (hasCheckedInToday && hasCheckedOutToday) {
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
                            "w-full h-20 rounded-2xl flex items-center justify-center font-black text-[13px] uppercase tracking-[0.3em] transition-all relative overflow-hidden group",
                            hasCheckedInToday && hasCheckedOutToday 
                              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" 
                              : !absenType ? "bg-slate-100 text-slate-300 cursor-not-allowed" 
                              : cameraActive ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100" : "bg-slate-900 text-white shadow-xl shadow-slate-200"
                          )}
                        >
                          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                          <div className="relative flex items-center gap-3">
                            {uploading ? <RefreshCw className="size-5 animate-spin" /> : (
                              <>
                                {(hasCheckedInToday && hasCheckedOutToday) ? (
                                  <>Selesai & Buka Kasir <ChevronRight className="size-5" /></>
                                ) : cameraActive ? (
                                  <><CameraIcon className="size-5" /> Ambil Foto & Konfirmasi</>
                                ) : (
                                  <><Fingerprint className="size-5" /> Aktifkan Kamera Absen</>
                                )}
                              </>
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center bg-slate-50/50">
                    <div className="size-20 rounded-2xl bg-white shadow-xl flex items-center justify-center text-slate-300 mb-8 border border-slate-100">
                      <UserCircle2 className="size-10" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Pilih Identitas Anda</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 mb-10">Silakan pilih nama karyawan untuk melanjutkan absensi</p>
                    
                    <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                      {employees.map(emp => (
                        <button 
                          key={emp.id} 
                          onClick={() => setSelectedEmp(emp)} 
                          className="group relative p-6 rounded-2xl bg-white border border-slate-200 text-center transition-all hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-50"
                        >
                          <div className="absolute top-2 right-2 size-2 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="text-[12px] font-black uppercase tracking-wider text-slate-700 group-hover:text-indigo-600">{emp.name}</div>
                          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">{emp.role}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* PANEL KANAN: TIMELINE LOG AKTIVITAS */}
              <div className="lg:col-span-5 flex flex-col min-h-0 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 lg:p-10 overflow-hidden">
                <div className="flex items-center justify-between mb-10 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
                      <Clock className="size-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Log Aktivitas</h3>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Riwayat absensi terbaru</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    {myHistory.length} Record
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 -mr-4 space-y-10">
                  {myHistory.length > 0 ? (
                    myHistory.map((item, idx) => (
                      <div key={item.id} className="relative flex gap-6">
                        {idx !== myHistory.length - 1 && <div className="absolute left-[7px] top-6 bottom-[-40px] w-0.5 bg-slate-100" />}
                        <div className={cn(
                          "relative z-10 size-4 rounded-full border-4 border-white shadow-sm mt-1 shrink-0", 
                          item.type === 'in' ? "bg-indigo-600 ring-2 ring-indigo-100" : "bg-emerald-500 ring-2 ring-emerald-100"
                        )} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-4 mb-2">
                             <div>
                                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-wider leading-none">
                                  {item.type === 'in' ? 'Absen Masuk' : 'Absen Pulang'}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-1.5 text-slate-400">
                                   <MapPin className="size-3" />
                                   <span className="text-[9px] font-bold uppercase tracking-tight">Store Location Verified</span>
                                </div>
                             </div>
                             <div className="text-right">
                                <span className="text-sm font-black text-slate-900 tracking-tight">{format(new Date(item.created_at), 'HH:mm')}</span>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{format(new Date(item.created_at), 'dd MMM yyyy', { locale: localeId })}</p>
                             </div>
                          </div>
                          
                          {item.photo_url && (
                            <div className="group relative mt-4 aspect-[4/3] w-48 rounded-2xl overflow-hidden border-2 border-white shadow-lg shadow-slate-200 transition-all hover:scale-[1.02]">
                              <img src={item.photo_url} alt="Selfie" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                <p className="text-[8px] font-black text-white uppercase tracking-widest">Selfie Verification</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-40">
                      <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <RefreshCw className="size-6 text-slate-300" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Belum ada riwayat hari ini</p>
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
                  <p className="text-xl font-black text-slate-900">Rp {(summaryData?.sales || 0).toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border-2 border-slate-100 flex flex-col items-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Transaksi</p>
                  <p className="text-xl font-black text-slate-900">{(summaryData?.count || 0)} Nota</p>
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


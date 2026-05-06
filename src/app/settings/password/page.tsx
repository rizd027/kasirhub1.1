'use client';

import { useState } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock } from 'lucide-react';

const PASSWORD_KEY = 'kasirhub_app_password';

export default function PasswordPage() {
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ current: '', new: '', confirm: '' });
  const savedPwd = typeof window !== 'undefined' ? localStorage.getItem(PASSWORD_KEY) : null;

  const handleSave = () => {
    if (savedPwd && form.current !== savedPwd) {
      toast.error('Password lama salah!');
      return;
    }
    if (form.new.length < 4) {
      toast.error('Password minimal 4 karakter');
      return;
    }
    if (form.new !== form.confirm) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    localStorage.setItem(PASSWORD_KEY, form.new);
    setForm({ current: '', new: '', confirm: '' });
    toast.success('Password berhasil diubah!');
  };

  const handleRemove = () => {
    if (!savedPwd) { toast.info('Belum ada password'); return; }
    if (form.current !== savedPwd) { toast.error('Password salah!'); return; }
    localStorage.removeItem(PASSWORD_KEY);
    setForm({ current: '', new: '', confirm: '' });
    toast.success('Password dihapus');
  };

  return (
    <SettingsLayout title="Password">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3 p-4 rounded-md bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {savedPwd ? 'Password aktif. Ubah di bawah ini.' : 'Belum ada password. Buat password baru.'}
          </span>
        </div>

        {savedPwd && (
          <div className="flex flex-col gap-2">
            <Label>Password Lama</Label>
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                placeholder="Masukkan password lama"
                value={form.current}
                onChange={e => setForm({ ...form, current: e.target.value })}
                className="pr-10"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPwd(!showPwd)}>
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Password Baru</Label>
          <Input type="password" placeholder="Min. 4 karakter" value={form.new} onChange={e => setForm({ ...form, new: e.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Konfirmasi Password Baru</Label>
          <Input type="password" placeholder="Ulangi password baru" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} />
        </div>

        <div className="flex gap-2 mt-2">
          {savedPwd && (
            <Button variant="outline" className="flex-1 text-destructive" onClick={handleRemove}>Hapus Password</Button>
          )}
          <Button className="flex-[2]" onClick={handleSave}>Simpan Password</Button>
        </div>
      </div>
    </SettingsLayout>
  );
}

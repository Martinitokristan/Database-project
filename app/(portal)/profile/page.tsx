'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { profileService } from '@/services/profileService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, User, Mail, Phone, MapPin, Calendar, Pencil, X, Camera } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';

const schema = z.object({
  first_name:    z.string().min(1, 'Required'),
  middle_name:   z.string().optional(),
  last_name:     z.string().min(1, 'Required'),
  suffix:        z.string().optional(),
  phone:         z.string().min(7, 'Invalid phone number'),
  address:       z.string().min(5, 'Required'),
  gender:        z.enum(['Male', 'Female', 'Other']),
  date_of_birth: z.string().min(1, 'Required'),
});
type FormData = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [profile, setProfile]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function loadProfile() {
    if (!user?.user_id) return;
    setLoading(true);
    const res = await profileService.get(user.user_id);
    if (res.success) {
      setProfile(res.data);
      reset({
        first_name:    res.data.first_name,
        middle_name:   res.data.middle_name ?? '',
        last_name:     res.data.last_name,
        suffix:        res.data.suffix ?? '',
        phone:         res.data.phone,
        address:       res.data.address,
        gender:        res.data.gender,
        date_of_birth: res.data.date_of_birth?.slice(0, 10),
      });
    }
    setLoading(false);
  }

  useEffect(() => { loadProfile(); }, [user?.user_id]);

  async function onSubmit(data: FormData) {
    if (!user?.user_id) return;
    setSaving(true);
    try {
      const res = await profileService.update(user.user_id, {
        ...data,
        middle_name: data.middle_name || null,
        suffix:      data.suffix      || null,
      });
      if (!res.success) { toast.error(res.message); return; }
      toast.success('Profile updated successfully.');
      setEditing(false);
      loadProfile();
      refresh();
    } catch { toast.error('An error occurred.'); }
    finally { setSaving(false); }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res  = await fetch('/api/profile/upload', { method: 'POST', credentials: 'include', body: form });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success('Profile photo updated.');
      await loadProfile();
      refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) return <LoadingSpinner />;

  const roleColor: Record<string, string> = {
    Admin:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Faculty: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Student: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="My Profile" description="Manage your personal information" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            {/* Avatar with upload overlay */}
            <div className="relative group">
              <UserAvatar
                src={profile?.avatar_url}
                name={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`}
                role={profile?.role_name}
                size={56}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Change photo"
              >
                {uploading
                  ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                  : <Camera className="h-4 w-4 text-white" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-semibold text-lg">{profile?.first_name} {profile?.middle_name ? profile.middle_name + ' ' : ''}{profile?.last_name}{profile?.suffix ? ' ' + profile.suffix : ''}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor[profile?.role_name] ?? ''}`}>
                  {profile?.role_name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{user?.user_id}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Hover over photo to change it</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            {profile?.email}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Personal Details</CardTitle>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
            </Button>
          )}
          {editing && (
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); loadProfile(); }}>
              <X className="mr-1.5 h-3.5 w-3.5" />Cancel
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!editing ? (
            <dl className="space-y-3">
              {[
                { icon: User,     label: 'Full Name',     value: `${profile?.first_name} ${profile?.middle_name ?? ''} ${profile?.last_name}${profile?.suffix ? ' ' + profile.suffix : ''}`.trim() },
                { icon: Phone,    label: 'Phone',         value: profile?.phone },
                { icon: MapPin,   label: 'Address',       value: profile?.address },
                { icon: User,     label: 'Gender',        value: profile?.gender },
                { icon: Calendar, label: 'Date of Birth', value: profile?.date_of_birth?.slice(0, 10) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium">{value || '—'}</p>
                  </div>
                </div>
              ))}
            </dl>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input {...register('first_name')} />
                  {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Middle Name</Label>
                  <Input {...register('middle_name')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input {...register('last_name')} />
                  {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Suffix <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input placeholder="Jr., Sr., III" {...register('suffix')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select defaultValue={profile?.gender} onValueChange={v => setValue('gender', v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && <p className="text-xs text-destructive">{errors.gender.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" {...register('phone')} />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth</Label>
                  <Input type="date" {...register('date_of_birth')} />
                  {errors.date_of_birth && <p className="text-xs text-destructive">{errors.date_of_birth.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input {...register('address')} />
                {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setEditing(false); loadProfile(); }}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

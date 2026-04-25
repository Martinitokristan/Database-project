'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authService } from '@/services/authService';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ShieldAlert } from 'lucide-react';

const schema = z.object({
  current_password:      z.string().min(1, 'Required'),
  new_password:          z.string().min(6, 'Minimum 6 characters'),
  confirm_password:      z.string().min(1, 'Required'),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path:    ['confirm_password'],
});
type FormData = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const router       = useRouter();
  const { refresh, user } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await authService.changePassword({
        current_password: data.current_password,
        new_password:     data.new_password,
      });
      if (!res.success) {
        toast.error(res.message || 'Failed to change password.');
        return;
      }
      toast.success('Password changed successfully.');
      await refresh();
      const role = (user?.role_name ?? '').toLowerCase();
      router.push(role === 'admin' ? '/dashboard' : '/home');
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-warning mb-1">
          <ShieldAlert className="h-5 w-5" />
          <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Password change required</span>
        </div>
        <CardTitle className="text-2xl">Set a new password</CardTitle>
        <CardDescription>You must change your default password before continuing.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">Current Password</Label>
            <Input id="current" type="password" {...register('current_password')} />
            {errors.current_password && <p className="text-xs text-destructive">{errors.current_password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new">New Password</Label>
            <Input id="new" type="password" {...register('new_password')} />
            {errors.new_password && <p className="text-xs text-destructive">{errors.new_password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm New Password</Label>
            <Input id="confirm" type="password" {...register('confirm_password')} />
            {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

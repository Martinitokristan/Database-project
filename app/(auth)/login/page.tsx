'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authService } from '@/services/authService';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Loader2, Eye, EyeOff, GraduationCap, Users, BookOpen,
  ClipboardList, BarChart3, Megaphone, ArrowLeft,
} from 'lucide-react';

const schema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

const features = [
  { icon: Users,         text: 'Manage students & faculty records' },
  { icon: BookOpen,      text: 'Academic departments, courses & subjects' },
  { icon: ClipboardList, text: 'Section enrollment & scheduling' },
  { icon: BarChart3,     text: 'Grade tracking & GWA computation' },
  { icon: Megaphone,     text: 'Announcements & deadline notifications' },
  { icon: GraduationCap, text: 'Complete semester lifecycle management' },
];

export default function LoginPage() {
  const router      = useRouter();
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await authService.login(data);
      if (!res.success) { toast.error(res.message || 'Login failed.'); return; }
      await refresh();
      const role = res.data?.role_name?.toLowerCase();
      router.push(res.data?.must_change_password ? '/change-password' : role === 'admin' ? '/dashboard' : '/home');
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary px-12 py-10 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-0 h-48 w-48 rounded-full bg-white/5" />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2.5 text-white hover:opacity-80 transition-opacity">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to home</span>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                <span className="text-lg font-bold">AT</span>
              </div>
              <span className="text-3xl font-bold tracking-tight">AcadTrack</span>
            </div>
            <h2 className="text-2xl font-semibold leading-snug mb-2">
              Your complete university<br />management platform
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Streamline academic operations for administrators, faculty, and students — all in one place.
            </p>
          </div>

          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15">
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm text-white/85">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} AcadTrack · University Management System
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-white">AT</span>
          </div>
          <span className="text-xl font-bold">AcadTrack</span>
        </div>

        <div className="w-full max-w-sm space-y-7">
          {/* Heading */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to access your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.edu"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                : 'Sign in'
              }
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            New student?{' '}
            <Link href="/apply" className="font-medium text-primary hover:underline">
              Apply for admission
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:underline">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

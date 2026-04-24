'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const editSchema = z.object({
  first_name:     z.string().min(1, 'Required'),
  last_name:      z.string().min(1, 'Required'),
  personal_email: z.string().email().optional().or(z.literal('')),
  phone:          z.string().min(7, 'Required'),
  gender:         z.enum(['Male', 'Female', 'Other']),
  date_of_birth:  z.string().min(1, 'Required'),
  address:        z.string().min(5, 'Required'),
  year_level:     z.string().optional(),
  section_id:     z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

interface StudentDetailsModalProps {
  student: any;
  sections?: any[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (data: EditFormData) => Promise<void>;
  onToggleActive: (student: any) => void;
  onDelete?: (student: any) => Promise<void>;
  isToggling: boolean;
  isSaving?: boolean;
}

export function StudentDetailsModal({
  student,
  sections = [],
  isOpen,
  onClose,
  onEdit,
  onToggleActive,
  isToggling,
  isSaving = false,
}: StudentDetailsModalProps) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (student) {
      reset({
        first_name:     student.first_name || '',
        last_name:      student.last_name || '',
        personal_email: student.personal_email || '',
        phone:          student.phone || '',
        gender:         student.gender || 'Other',
        date_of_birth:  student.date_of_birth
          ? new Date(student.date_of_birth).toISOString().split('T')[0]
          : '',
        address: (() => {
          if (!student.address) return '';
          try {
            const parsed = JSON.parse(student.address);
            const curr = parsed.current;
            if (!curr) return student.address;
            return [curr.streetBarangay, curr.city, curr.province, curr.postalCode].filter(Boolean).join(', ');
          } catch (e) {
            return student.address;
          }
        })(),
        year_level: student.year_level || '',
        section_id: student.section_id?.toString() || 'none',
      });
    }
  }, [student, reset]);

  if (!student) return null;

  const isActive = student.is_active !== false;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="p-0 w-[95vw] md:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl border-0 shadow-2xl"
      >
        {/* ── Header ── */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 px-6 pt-6 pb-8 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors rounded-full p-1"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold mb-1">
            Student Details
          </p>
          <h2 className="text-white text-xl font-bold">
            {student.first_name} {student.last_name}
          </h2>
          <p className="text-white/60 text-sm mt-0.5">{student.email}</p>
        </div>

        {/* ── Body ── */}
        <form
          onSubmit={handleSubmit(onEdit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-white">

            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  First Name
                </Label>
                <Input {...register('first_name')} className="h-9 text-sm" />
                {errors.first_name && (
                  <p className="text-xs text-red-500">{errors.first_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Last Name
                </Label>
                <Input {...register('last_name')} className="h-9 text-sm" />
                {errors.last_name && (
                  <p className="text-xs text-red-500">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            {/* Student ID (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Student ID
              </Label>
              <Input
                value={student.user_id}
                readOnly
                className="h-9 text-sm bg-slate-50 text-slate-500 font-mono"
              />
            </div>

            {/* Institutional email (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Institutional Email
              </Label>
              <Input
                value={student.email}
                readOnly
                className="h-9 text-sm bg-slate-50 text-slate-500"
              />
            </div>

            {/* Personal email */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Personal Email
              </Label>
              <Input
                {...register('personal_email')}
                type="email"
                placeholder="personal@gmail.com"
                className="h-9 text-sm"
              />
              {errors.personal_email && (
                <p className="text-xs text-red-500">{errors.personal_email.message}</p>
              )}
            </div>

            {/* Gender & DOB */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Gender
                </Label>
                <Select
                  value={watch('gender')}
                  onValueChange={(v) => setValue('gender', v as any, { shouldValidate: true })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Date of Birth
                </Label>
                <Input type="date" {...register('date_of_birth')} className="h-9 text-sm" />
                {errors.date_of_birth && (
                  <p className="text-xs text-red-500">{errors.date_of_birth.message}</p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Phone Number
              </Label>
              <Input {...register('phone')} className="h-9 text-sm" />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone.message}</p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Address
              </Label>
              <Input {...register('address')} className="h-9 text-sm" />
              {errors.address && (
                <p className="text-xs text-red-500">{errors.address.message}</p>
              )}
            </div>

            {/* Year Level & Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Year Level
                </Label>
                <Select
                  value={watch('year_level')}
                  onValueChange={(v) => setValue('year_level', v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Irregular'].map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Assigned Section
                </Label>
                <Select
                  value={watch('section_id')}
                  onValueChange={(v) => setValue('section_id', v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Assign section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Section</SelectItem>
                    {sections.map((sec) => {
                      const enrolled = sec.enrolled_count ?? 0;
                      const capacity = sec.capacity ?? 40;
                      const isFull = enrolled >= capacity;
                      return (
                        <SelectItem
                          key={sec.section_id}
                          value={sec.section_id.toString()}
                          disabled={isFull}
                        >
                          {sec.section_name}{' '}
                          <span className={cn('text-xs', isFull ? 'text-red-400' : 'text-slate-400')}>
                            {isFull ? '(Full)' : `(${enrolled}/${capacity})`}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 border-t bg-slate-50 px-6 py-3 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onToggleActive(student)}
              disabled={isToggling}
              className={cn(
                'text-xs font-bold h-9 px-4 border shadow-sm',
                isActive
                  ? 'text-red-600 bg-red-50 border-red-100 hover:bg-red-100'
                  : 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100',
              )}
            >
              {isToggling && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              {isActive ? 'Revoke Access' : 'Restore Access'}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-9 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                {isSaving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

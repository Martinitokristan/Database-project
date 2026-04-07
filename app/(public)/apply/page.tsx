'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { applicantService } from '@/services/applicantService';
import { courseService } from '@/services/courseService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';

const schema = z.object({
  first_name:    z.string().min(1, 'Required'),
  middle_name:   z.string().optional(),
  last_name:     z.string().min(1, 'Required'),
  suffix:        z.string().optional(),
  email:         z.string().email('Invalid email'),
  course_id:     z.string().min(1, 'Please select a course'),
  gender:        z.enum(['Male', 'Female', 'Other']),
  date_of_birth: z.string().min(1, 'Required'),
  phone:         z.string().min(7, 'Invalid phone number'),
  address:       z.string().min(5, 'Required'),
});
type FormData = z.infer<typeof schema>;

export default function ApplyPage() {
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [courses, setCourses]   = useState<any[]>([]);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    courseService.list().then(r => { if (r.success) setCourses(r.data ?? []); });
  }, []);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await applicantService.create({ ...data, course_id: Number(data.course_id) });
      if (!res.success) {
        toast.error(res.message || 'Submission failed.');
        return;
      }
      setSubmitted(true);
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Card className="text-center py-10">
        <CardContent className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold">Application Submitted!</h2>
          <p className="text-muted-foreground max-w-sm">
            Thank you for applying. The admissions office will review your application and contact you via email.
          </p>
          <Button variant="outline" onClick={() => setSubmitted(false)}>Submit another</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Student Application</CardTitle>
        <CardDescription>Fill out all fields to apply for admission to AcadTrack University.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Suffix <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Jr., Sr., III" {...register('suffix')} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select onValueChange={v => setValue('gender', v as any)}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-xs text-destructive">{errors.gender.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input type="tel" {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" {...register('date_of_birth')} />
              {errors.date_of_birth && <p className="text-xs text-destructive">{errors.date_of_birth.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Course</Label>
              <Select onValueChange={v => setValue('course_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => (
                    <SelectItem key={c.course_id} value={String(c.course_id)}>{c.course_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.course_id && <p className="text-xs text-destructive">{errors.course_id.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea rows={2} {...register('address')} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

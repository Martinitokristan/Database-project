'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { applicantService } from '@/services/applicantService';
import { courseService } from '@/services/courseService';
import { fetchProvinces, fetchCities, LocationItem } from '@/lib/philippines';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, GraduationCap, ShieldCheck, FileText } from 'lucide-react';

// ── Schema ──────────────────────────────────────────────────────
const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Last name is required'),
  suffix: z.string().optional(),
  email: z.string().email('Invalid email address'),
  course_id: z.string().min(1, 'Please select a course'),
  gender: z.string().min(1, 'Gender is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  phone: z.string().min(1, 'Phone number is required').max(11, 'Maximum 11 digits').regex(/^\d+$/, 'Numbers only'),
  // Current address
  current_province: z.string().min(1, 'Province is required'),
  current_city: z.string().min(1, 'City is required'),
  current_postalCode: z.string().min(1, 'Postal code is required'),
  current_streetBarangay: z.string().min(1, 'Street/Barangay is required'),
  // Home address (optional)
  home_province: z.string().optional(),
  home_city: z.string().optional(),
  home_postalCode: z.string().optional(),
  home_streetBarangay: z.string().optional(),
  // Consent
  agreeTerms: z.literal(true, {
    error: 'Please review the Privacy Policy and Terms and Condition before submitting your application, Thank you!'
  }),
});

type FormData = z.infer<typeof schema>;

// ── Main Component ──────────────────────────────────────────────
export default function ApplyPage() {
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [sameAsCurrentAddr, setSameAddr] = useState(false);
  const [showSuccessModal, setShowSuccess] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Cascading state
  const [provincesList, setProvincesList] = useState<LocationItem[]>([]);
  const [currentCities, setCurrentCities] = useState<LocationItem[]>([]);
  const [homeCities, setHomeCities] = useState<LocationItem[]>([]);

  const {
    register, handleSubmit, setValue, watch, formState: { errors }, reset, trigger,
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: {} });

  // Load static data
  useEffect(() => {
    courseService.list().then(r => { if (r.success) setCourses(r.data ?? []); });
    fetchProvinces().then(setProvincesList);
  }, []);

  // ─ Watch fields ─
  const currentProvince = watch('current_province');
  const currentCity = watch('current_city');
  const currentPostalCode = watch('current_postalCode');
  const currentStreetBarangay = watch('current_streetBarangay');

  const prevCurrentProv = useRef(currentProvince);
  const prevHomeProv = useRef(watch('home_province'));

  // Update current cities when current province changes
  useEffect(() => {
    if (currentProvince) {
      if (currentProvince !== prevCurrentProv.current) {
        setValue('current_city', ''); // Reset city on manual province change
        prevCurrentProv.current = currentProvince;
      }
      const p = provincesList.find(x => x.name === currentProvince);
      if (p) {
        fetchCities(p.code, p.isRegion).then(setCurrentCities);
      }
    } else {
      setCurrentCities([]);
    }
  }, [currentProvince, provincesList, setValue]);

  const homeProvince = watch('home_province');

  // Update home cities when home province changes
  useEffect(() => {
    if (homeProvince) {
      if (homeProvince !== prevHomeProv.current) {
        if (!sameAsCurrentAddr) setValue('home_city', '');
        prevHomeProv.current = homeProvince;
      }
      const p = provincesList.find(x => x.name === homeProvince);
      if (p) {
        fetchCities(p.code, p.isRegion).then(setHomeCities);
      }
    } else {
      setHomeCities([]);
    }
  }, [homeProvince, provincesList, setValue, sameAsCurrentAddr]);

  // Same as current address toggle
  const handleSameAddress = useCallback((checked: boolean) => {
    setSameAddr(checked);
    if (checked) {
      setValue('home_province', currentProvince || '');
      setValue('home_city', currentCity || '');
      setValue('home_postalCode', currentPostalCode || '');
      setValue('home_streetBarangay', currentStreetBarangay || '');
    } else {
      setValue('home_province', '');
      setValue('home_city', '');
      setValue('home_postalCode', '');
      setValue('home_streetBarangay', '');
    }
  }, [currentProvince, currentCity, currentPostalCode, currentStreetBarangay, setValue]);

  // Sync home address when current address changes while "same" is checked
  useEffect(() => {
    if (sameAsCurrentAddr) {
      setValue('home_province', currentProvince || '');
      setValue('home_city', currentCity || '');
      setValue('home_postalCode', currentPostalCode || '');
      setValue('home_streetBarangay', currentStreetBarangay || '');
    }
  }, [sameAsCurrentAddr, currentProvince, currentCity, currentPostalCode, currentStreetBarangay, setValue]);

  // Phone number input handler
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    setValue('phone', digits, { shouldValidate: true });
  };

  // ── Submit ──────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const payload = {
        first_name: data.first_name,
        middle_name: data.middle_name || null,
        last_name: data.last_name,
        suffix: data.suffix || null,
        email: data.email,
        course_id: Number(data.course_id),
        gender: data.gender,
        date_of_birth: data.date_of_birth,
        phone: data.phone,
        current_address: {
          province: data.current_province,
          city: data.current_city,
          postalCode: data.current_postalCode,
          streetBarangay: data.current_streetBarangay,
        },
        home_address: data.home_province ? {
          province: data.home_province,
          city: data.home_city || '',
          postalCode: data.home_postalCode || '',
          streetBarangay: data.home_streetBarangay || '',
        } : null,
      };

      const res = await applicantService.create(payload);
      if (!res.success) {
        toast.error(res.message || 'Submission failed.');
        return;
      }
      setShowSuccess(true);
      reset();
      setSameAddr(false);
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <Card className="shadow-lg border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Student Application</CardTitle>
          <CardDescription className="text-base">
            Fill out all required fields to apply for admission to AcadTrack University.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

            {/* ── Personal Information ────────────────────── */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-primary uppercase tracking-wider border-b pb-2 w-full">
                Personal Information
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>First Name <span className="text-destructive">*</span></Label>
                  <Input {...register('first_name')} placeholder="Juan" />
                  {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Middle Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input {...register('middle_name')} placeholder="Dela" />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name <span className="text-destructive">*</span></Label>
                  <Input {...register('last_name')} placeholder="Cruz" />
                  {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Suffix <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input placeholder="Jr., Sr., III" {...register('suffix')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender <span className="text-destructive">*</span></Label>
                  <Select onValueChange={v => setValue('gender', v, { shouldValidate: true })}>
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
                  <Label>Email Address <span className="text-destructive">*</span></Label>
                  <Input type="email" {...register('email')} placeholder="juan.delacruz@email.com" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number <span className="text-destructive">*</span></Label>
                  <Input
                    type="tel"
                    {...register('phone')}
                    onChange={handlePhoneInput}
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    inputMode="numeric"
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Date of Birth <span className="text-destructive">*</span></Label>
                  <Input type="date" {...register('date_of_birth')} />
                  {errors.date_of_birth && <p className="text-xs text-destructive">{errors.date_of_birth.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Course <span className="text-destructive">*</span></Label>
                  <Select onValueChange={v => setValue('course_id', v, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c: any) => (
                        <SelectItem key={c.course_id} value={String(c.course_id)}>{c.course_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground font-medium italic mt-1 bg-muted/30 px-2 py-1 rounded border border-dashed">
                    Note: New applicants are admitted to the 1st Year curriculum. Transferees please contact admission office.
                  </p>
                  {errors.course_id && <p className="text-xs text-destructive">{errors.course_id.message}</p>}
                </div>
              </div>
            </fieldset>

            {/* ── Current Address ─────────────────────────── */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-primary uppercase tracking-wider border-b pb-2 w-full">
                Current Address <span className="text-destructive">*</span>
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Province <span className="text-destructive">*</span></Label>
                  <Select onValueChange={v => setValue('current_province', v, { shouldValidate: true })} value={currentProvince || ''}>
                    <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {provincesList.map(p => (
                        <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.current_province && <p className="text-xs text-destructive">{errors.current_province.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>City / Municipality <span className="text-destructive">*</span></Label>
                  <Select
                    onValueChange={v => setValue('current_city', v, { shouldValidate: true })}
                    value={watch('current_city') || ''}
                    disabled={!currentProvince}
                  >
                    <SelectTrigger><SelectValue placeholder={currentProvince ? 'Select city' : 'Select province first'} /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {currentCities.map(c => (
                        <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.current_city && <p className="text-xs text-destructive">{errors.current_city.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Postal Code <span className="text-destructive">*</span></Label>
                  <Input {...register('current_postalCode')} placeholder="e.g. 1000" />
                  {errors.current_postalCode && <p className="text-xs text-destructive">{errors.current_postalCode.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Street / Barangay <span className="text-destructive">*</span></Label>
                  <Input {...register('current_streetBarangay')} placeholder="e.g. 123 Rizal St., Brgy. San Jose" />
                  {errors.current_streetBarangay && <p className="text-xs text-destructive">{errors.current_streetBarangay.message}</p>}
                </div>
              </div>
            </fieldset>

            {/* ── Home Address ────────────────────────────── */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-primary uppercase tracking-wider border-b pb-2 w-full">
                Home Address <span className="text-muted-foreground text-xs font-normal normal-case">(optional)</span>
              </legend>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="sameAddress"
                  checked={sameAsCurrentAddr}
                  onCheckedChange={(c) => handleSameAddress(c === true)}
                />
                <Label htmlFor="sameAddress" className="text-sm font-normal cursor-pointer">
                  Same as current address
                </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Province</Label>
                  <Select
                    onValueChange={v => { if (!sameAsCurrentAddr) setValue('home_province', v); }}
                    value={watch('home_province') || ''}
                    disabled={sameAsCurrentAddr}
                  >
                    <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {provincesList.map(p => (
                        <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>City / Municipality</Label>
                  <Select
                    onValueChange={v => { if (!sameAsCurrentAddr) setValue('home_city', v); }}
                    value={watch('home_city') || ''}
                    disabled={sameAsCurrentAddr || !watch('home_province')}
                  >
                    <SelectTrigger><SelectValue placeholder={watch('home_province') ? 'Select city' : 'Select province first'} /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {homeCities.map(c => (
                        <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Postal Code</Label>
                  <Input {...register('home_postalCode')} placeholder="e.g. 1000" disabled={sameAsCurrentAddr} />
                </div>
                <div className="space-y-1.5">
                  <Label>Street / Barangay</Label>
                  <Input
                    {...register('home_streetBarangay')}
                    placeholder="e.g. 123 Rizal St., Brgy. San Jose"
                    disabled={sameAsCurrentAddr}
                  />
                </div>
              </div>
            </fieldset>

            {/* ── Agreement ───────────────────────────────── */}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="agreeTerms"
                  checked={watch('agreeTerms') === true}
                  onCheckedChange={(c) => setValue('agreeTerms', c === true ? true : undefined as any, { shouldValidate: true })}
                />
                <Label htmlFor="agreeTerms" className="text-sm font-normal leading-relaxed cursor-pointer">
                  I agree to the{' '}
                  <button type="button" onClick={() => setShowPrivacy(true)} className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium">
                    Privacy Policy
                  </button>{' '}
                  and{' '}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium">
                    Terms and Conditions
                  </button>
                  <span className="text-destructive"> *</span>
                </Label>
              </div>
              {errors.agreeTerms && <p className="text-xs text-destructive ml-7">{errors.agreeTerms.message}</p>}
            </div>

            {/* ── Submit ──────────────────────────────────── */}
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Application
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      {/* ── Success Modal ──────────────────────────────────── */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccess}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl">Application Submitted!</DialogTitle>
            <DialogDescription className="text-center text-base leading-relaxed pt-2">
              Your application has been submitted successfully! You will be notified via email once an admin approves your application. Your login credentials will be sent to your email — please use them to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccess(false)} className="w-full sm:w-auto">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Privacy Policy Modal ───────────────────────────── */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <DialogTitle>Privacy Policy</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p><strong className="text-foreground">Effective Date:</strong> January 1, 2026</p>
            <p>AcadTrack University (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting the privacy and security of the personal information of its applicants, students, and users.</p>

            <h4 className="font-semibold text-foreground">1. Information We Collect</h4>
            <p>We collect personal information that you provide during the application process, including your full name, email address, phone number, date of birth, gender, address, and academic preferences. This data is essential for processing your application.</p>

            <h4 className="font-semibold text-foreground">2. How We Use Your Information</h4>
            <p>Your information is used to process your application, create your student account upon approval, communicate important updates, and maintain accurate academic records.</p>

            <h4 className="font-semibold text-foreground">3. Data Protection</h4>
            <p>We implement appropriate technical and organizational security measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.</p>

            <h4 className="font-semibold text-foreground">4. Data Sharing</h4>
            <p>We do not sell or share your personal information with third parties except as required by law or as necessary to provide our educational services.</p>

            <h4 className="font-semibold text-foreground">5. Your Rights</h4>
            <p>You have the right to access, correct, or request deletion of your personal data in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).</p>

            <h4 className="font-semibold text-foreground">6. Contact</h4>
            <p>For privacy-related inquiries, please contact our Data Protection Officer at <span className="text-primary">privacy@acadtrack.edu.ph</span>.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrivacy(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Terms & Conditions Modal ──────────────────────── */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <DialogTitle>Terms and Conditions</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p><strong className="text-foreground">Effective Date:</strong> January 1, 2026</p>
            <p>By submitting an application through AcadTrack University&apos;s online portal, you agree to the following terms and conditions:</p>

            <h4 className="font-semibold text-foreground">1. Accuracy of Information</h4>
            <p>You certify that all information provided in this application is true, accurate, and complete. Providing false or misleading information may result in the rejection of your application or dismissal from the university.</p>

            <h4 className="font-semibold text-foreground">2. Application Review</h4>
            <p>Submission of an application does not guarantee admission. All applications are subject to review and approval by the university&apos;s admissions committee.</p>

            <h4 className="font-semibold text-foreground">3. Account Credentials</h4>
            <p>Upon approval, a student account with generated credentials will be provided. You are responsible for maintaining the confidentiality of your login credentials and must change your temporary password upon first login.</p>

            <h4 className="font-semibold text-foreground">4. Communication</h4>
            <p>You agree to receive application-related communications via the email address provided in your application, including approval notifications, account credentials, and important academic updates.</p>

            <h4 className="font-semibold text-foreground">5. Code of Conduct</h4>
            <p>Upon enrollment, you agree to abide by the university&apos;s code of conduct, academic integrity policies, and all applicable rules and regulations.</p>

            <h4 className="font-semibold text-foreground">6. Modifications</h4>
            <p>AcadTrack University reserves the right to modify these terms at any time. Continued use of the platform constitutes acceptance of any changes.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTerms(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

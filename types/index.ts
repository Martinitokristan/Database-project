export interface Role {
  role_id:   number;
  role_name: 'Admin' | 'Faculty' | 'Student';
}

export interface User {
  user_id:              string;
  email:                string;
  role_id:              number;
  role?:                Role;
  role_name?:           string;
  must_change_password: boolean;
  is_active?:           boolean;
  profile?:             Profile;
  first_name?:          string;
  last_name?:           string;
  middle_name?:         string;
  avatar_url?:          string | null;
  created_at?:          string;
}

export interface Profile {
  profile_id:    number;
  user_id?:      string;
  applicant_id?: number;
  first_name:    string;
  middle_name?:  string;
  last_name:     string;
  suffix?:       string;
  address:       string;
  phone:         string;
  gender:        'Male' | 'Female' | 'Other';
  date_of_birth: string;
  avatar_url?:   string | null;
}

export interface Applicant {
  applicant_id: number;
  email:        string;
  course_id:    number;
  course?:      Course;
  status:       'Pending' | 'Enrolled' | 'Rejected';
  applied_at:   string;
  profile?:     Profile;
}

export interface Department {
  dept_id:             number;
  department_name:     string;
  department_head_id?: string;
  head?:               User;
}

export interface Course {
  course_id:   number;
  dept_id:     number;
  course_name: string;
  department?: Department;
}

export interface Subject {
  subject_id:   number;
  course_id:    number;
  code:         string;
  title:        string;
  credit_units: number;
  course?:      Course;
}

export interface Semester {
  semester_id: number;
  school_year: string;
  term:        string;
  start_date:  string;
  end_date:    string;
  status:      'Active' | 'Inactive';
}

export interface Section {
  section_id:      number;
  subject_id:      number;
  instructor_id:   string;
  semester_id:     number;
  section_name:    string;
  capacity:        number;
  subject?:        Subject;
  instructor?:     User;
  semester?:       Semester;
  enrolled_count?: number;
}

export interface Schedule {
  schedule_id: number;
  section_id:  number;
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  start_time:  string;
  end_time:    string;
  room:        string;
}

export interface Enrollment {
  enrollment_id:  number;
  user_id:        string;
  section_id:     number;
  status:         'Pending' | 'Enrolled' | 'Rejected';
  date_enrolled?: string;
  student?:       User;
  section?:       Section;
  grades?:        Grade;
}

export interface Grade {
  grade_id:       number;
  enrollment_id:  number;
  prelim_grade?:  number;
  midterm_grade?: number;
  final_grade?:   number;
  remarks?:       'Passed' | 'Failed' | 'Incomplete';
}

export interface Announcement {
  announcement_id: number;
  sender_id:       string;
  title:           string;
  content:         string;
  type:            'General' | 'Section';
  section_id?:     number;
  target_role_id?: number;
  created_at:      string;
  sender?:         User;
}

export interface AuthState {
  user:       User | null;
  role:       'admin' | 'faculty' | 'student' | null;
  mustChange: boolean;
  isLoading:  boolean;
}

import { fetchApi } from '@/lib/fetchApi';

export const authService = {
  login:          (data: { email: string; password: string }) =>
    fetchApi('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout:         () =>
    fetchApi('/api/auth/logout', { method: 'POST' }),
  me:             () =>
    fetchApi('/api/auth/me'),
  changePassword: (data: { current_password: string; new_password: string }) =>
    fetchApi('/api/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
};

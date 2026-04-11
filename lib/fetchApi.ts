export async function fetchApi<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; message?: string }> {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(url, {
    credentials: 'include',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthenticated');
  }
  return res.json();
}

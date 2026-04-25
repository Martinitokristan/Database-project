'use client';

import Image from 'next/image';

interface UserAvatarProps {
  src?:       string | null;
  name?:      string;
  role?:      string;
  size?:      number;
  className?: string;
}

const ROLE_COLORS: Record<string, string> = {
  Admin:   'bg-red-500',
  Faculty: 'bg-blue-500',
  Student: 'bg-green-600',
};

function initials(name?: string): string {
  if (!name) return 'AT';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({ src, name, role, size = 32, className = '' }: UserAvatarProps) {
  const bg    = ROLE_COLORS[role ?? ''] ?? 'bg-primary';
  const label = initials(name);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden ${bg} ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={name ?? 'Avatar'}
          width={size}
          height={size}
          className="object-cover w-full h-full"
          unoptimized
        />
      ) : (
        <span
          className="font-semibold text-white select-none"
          style={{ fontSize: Math.max(10, size * 0.38) }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

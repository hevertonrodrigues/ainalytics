import { avatarColor, initials } from '../utils';

interface AvatarProps {
  email: string;
  name: string | null;
  size?: 'sm' | 'md';
}

export function Avatar({ email, name, size = 'sm' }: AvatarProps) {
  const sizeClass = size === 'md' ? 'w-9 h-9 sm:w-10 sm:h-10' : 'w-9 h-9';
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center shrink-0 text-xs font-bold border ${avatarColor(email)}`}
    >
      {initials(name, email)}
    </div>
  );
}

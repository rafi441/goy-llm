'use client';

interface AvatarProps {
  path?: string | null;
  name: string;
  size?: number;
}

export function Avatar({ path, name, size = 28 }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  if (path) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatars/${encodeURIComponent(path)}`}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)] font-medium text-[var(--fg-muted)]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}

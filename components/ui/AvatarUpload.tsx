'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Avatar } from './Avatar';
import { useUi } from '@/lib/store/ui';

async function resizeToSquarePng(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  const min = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - min) / 2;
  const sy = (bitmap.height - min) / 2;
  ctx.drawImage(bitmap, sx, sy, min, min, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}

export function AvatarUpload({
  value,
  name,
  onChange,
}: {
  value: string | null;
  name: string;
  onChange: (path: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pushToast = useUi((s) => s.pushToast);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const blob = await resizeToSquarePng(file);
      const form = new FormData();
      form.append('file', new File([blob], 'avatar.png', { type: 'image/png' }));
      const res = await fetch('/api/avatars', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const data = (await res.json()) as { avatar_path: string };
      onChange(data.avatar_path);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Avatar upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar path={value} name={name} size={56} />
      <div className="flex flex-col gap-1">
        <button
          className="btn btn-ghost btn-sm gap-1.5"
          onClick={() => ref.current?.click()}
          disabled={busy}
        >
          <Upload size={14} /> {busy ? 'Uploading…' : 'Upload'}
        </button>
        {value && (
          <button className="btn btn-ghost btn-xs text-[var(--fg-subtle)]" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Drawer } from './Drawer';
import { useUi } from '@/lib/store/ui';
import { useTheme } from '@/lib/store/theme';
import { ConfirmHost } from '@/components/ui/ConfirmDialog';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { PromptInspector } from '@/components/chat/PromptInspector';
import { CharacterEditor } from '@/components/characters/CharacterEditor';
import { ImportDialog } from '@/components/characters/ImportDialog';

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const chatId = pathname.startsWith('/c/') ? pathname.slice(3) : null;
  const mobileOpen = useUi((s) => s.sidebarMobileOpen);
  const setMobileOpen = useUi((s) => s.setSidebarMobile);
  const setPlayMode = useUi((s) => s.setPlayMode);
  const initTheme = useTheme((s) => s.init);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '1') setPlayMode('as_user');
      if (e.ctrlKey && e.key === '2') setPlayMode('as_char');
      if (e.ctrlKey && e.key === '3') setPlayMode('narrator');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPlayMode]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-[280px] max-w-[85vw]">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header chatId={chatId} />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      <Drawer chatId={chatId} />

      <ConfirmHost />
      <SettingsDialog />
      <CharacterEditor />
      <ImportDialog />
      {chatId && <PromptInspector chatId={chatId} />}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useUi } from '@/lib/store/ui';
import { ConnectionsSettings } from './ConnectionsSettings';
import { ModelsPresetsSettings } from './ModelsPresetsSettings';
import { PromptOrderSettings } from './PromptOrderSettings';
import { BehaviorSettings } from './BehaviorSettings';
import { DataBackupSettings } from './DataBackupSettings';
import { AppearanceSettings } from './AppearanceSettings';

const SECTIONS = [
  { key: 'connections', label: 'Connections' },
  { key: 'models', label: 'Models & Presets' },
  { key: 'prompt', label: 'Prompt Order' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'behavior', label: 'Behavior' },
  { key: 'data', label: 'Data & Backup' },
  { key: 'about', label: 'About' },
] as const;

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const close = useUi((s) => s.closeSettings);
  const section = useUi((s) => s.settingsSection);
  const openSettings = useUi((s) => s.openSettings);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => SECTIONS.filter((s) => s.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <Modal open={open} onClose={close} title="Settings" size="xl" bodyClassName="!p-0">
      <div className="flex min-h-[60dvh]">
        <nav className="w-44 shrink-0 border-r border-[var(--border)] p-2">
          <input
            className="input input-xs mb-2 w-full border-[var(--border)] bg-[var(--bg)]"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {filtered.map((s) => (
            <button
              key={s.key}
              className={`mb-0.5 block w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                section === s.key ? 'bg-[var(--bg-hover)] text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)]'
              }`}
              onClick={() => openSettings(s.key)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="scrollbar-thin max-h-[70dvh] flex-1 overflow-y-auto p-5">
          {section === 'connections' && <ConnectionsSettings />}
          {section === 'models' && <ModelsPresetsSettings />}
          {section === 'prompt' && <PromptOrderSettings />}
          {section === 'appearance' && <AppearanceSettings />}
          {section === 'behavior' && <BehaviorSettings />}
          {section === 'data' && <DataBackupSettings />}
          {section === 'about' && <AboutSettings />}
        </div>
      </div>
    </Modal>
  );
}

function AboutSettings() {
  return (
    <div className="prose-chat text-sm text-[var(--fg-muted)]">
      <h3 className="text-[var(--fg)]">GoyLLM</h3>
      <p>
        Self-hosted LLM roleplay client. Local-first — all data lives in a local SQLite database. No
        account, no cloud, no telemetry.
      </p>
      <p>
        Runs on Next.js with the Node runtime. It cannot be deployed to serverless platforms because
        SQLite needs a persistent filesystem. Target: <code>next start</code> or Docker with a volume.
      </p>
      <p>API keys are encrypted at rest and never sent to the browser.</p>
    </div>
  );
}

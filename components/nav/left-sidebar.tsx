'use client';

import { MessageSquare, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MenuKey = 'chat';

const MENU_ITEMS: { key: MenuKey; label: string; icon: LucideIcon }[] = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
];

export function LeftSidebar({
  active,
  onSelect,
}: {
  active: MenuKey;
  onSelect: (key: MenuKey) => void;
}) {
  return (
    <aside className="hidden w-52 shrink-0 flex-col rounded-lg border md:flex">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        <span className="text-sm font-semibold">Bedrock Chat</span>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {MENU_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              active === key
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

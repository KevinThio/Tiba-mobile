"use client";

import { Bell, CheckCheck, ChevronRight, CircleAlert, FileSignature, ReceiptText, Star, UsersRound, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notification-actions";
import { cn } from "@/lib/utils";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  href: string;
  createdAt: string;
  read: boolean;
};

const ICONS: Record<string, LucideIcon> = {
  invoice: ReceiptText,
  invoice_issue: CircleAlert,
  duplicate: UsersRound,
  review: Star,
  contract: FileSignature,
};

/**
 * Notifications (spec v2 section 5b and the prototype): newest first, a New badge on unread
 * ones, and Mark all as read. Each opens the screen where it's handled and is marked read.
 */
export function NotificationsList({ rows, emptyText }: { rows: NotificationRow[]; emptyText: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [opening, setOpening] = useState<string | null>(null);
  const unread = rows.filter((r) => !r.read).length;

  function open(row: NotificationRow) {
    setOpening(row.id);
    startTransition(async () => {
      if (!row.read) await markNotificationRead(row.id).catch(() => {});
      router.push(row.href);
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState icon={Bell} title="You're all caught up">
        {emptyText}
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-muted-foreground">{unread ? `${unread} new` : "Nothing new"}</p>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(async () => void (await markAllNotificationsRead().catch(() => {})))}
          >
            <CheckCheck aria-hidden /> Mark all as read
          </Button>
        )}
      </div>
      <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm" aria-label="Notifications">
        {rows.map((row) => {
          const Icon = ICONS[row.type] ?? Bell;
          return (
            <li key={row.id} className="border-b border-border-subtle last:border-b-0">
              <button
                type="button"
                onClick={() => open(row)}
                disabled={pending && opening === row.id}
                className="group flex w-full items-center gap-4 px-4 py-4 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    row.read ? "bg-muted text-muted-foreground" : "bg-secondary text-primary",
                  )}
                  aria-hidden
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block break-words", row.read ? "font-medium" : "font-semibold")}>{row.title}</span>
                  <span className="block text-small text-muted-foreground">
                    {row.detail && <>{row.detail} · </>}
                    <RelativeDay iso={row.createdAt} withTime />
                  </span>
                </span>
                {!row.read && <Badge variant="info">New</Badge>}
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

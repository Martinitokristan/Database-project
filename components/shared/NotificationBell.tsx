'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Notification {
  notification_id: number;
  title:       string;
  message:     string;
  is_read:     boolean;
  created_at:  string;
  sender_id?:     string | null;
  sender_first?:  string | null;
  sender_last?:   string | null;
  sender_avatar?: string | null;
  sender_role?:   string | null;
}

function senderName(n: Notification): string {
  if (!n.sender_id) return 'AcadTrack';
  if (n.sender_role === 'Admin') return 'AcadTrack';
  return [n.sender_first, n.sender_last].filter(Boolean).join(' ') || 'AcadTrack';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen]                   = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unread = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setNotifications(data.data ?? []);
    } catch { /* silently ignore network errors */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 3_000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchNotifications(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', fetchNotifications);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', fetchNotifications);
    };
  }, [fetchNotifications]);

  const allRead = notifications.length > 0 && notifications.every(n => n.is_read);

  async function toggleReadAll() {
    if (allRead) {
      await Promise.all(
        notifications.map(n =>
          fetch(`/api/notifications/${n.notification_id}`, { method: 'PUT', credentials: 'include' })
        )
      );
      setNotifications(prev => prev.map(n => ({ ...n, is_read: false })));
    } else {
      await fetch('/api/notifications', { method: 'PUT', credentials: 'include' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  }

  async function deleteAll() {
    await Promise.all(
      notifications.map(n =>
        fetch(`/api/notifications/${n.notification_id}`, { method: 'DELETE', credentials: 'include' })
      )
    );
    setNotifications([]);
  }

  async function deleteNotification(id: number) {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
    setNotifications(prev => prev.filter(n => n.notification_id !== id));
  }

  async function handleNotificationClick(n: Notification) {
    setSelectedNotification(n);
    if (!n.is_read) {
      // Mark as read
      await fetch(`/api/notifications/${n.notification_id}`, { method: 'PUT', credentials: 'include' });
      setNotifications(prev => prev.map(item => 
        item.notification_id === n.notification_id ? { ...item, is_read: true } : item
      ));
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                {unread}
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={toggleReadAll}>
                <CheckCheck className="h-3.5 w-3.5" />
                {allRead ? 'Mark all unread' : 'Mark all read'}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete all" onClick={deleteAll}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-20" />
              No notifications yet
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.notification_id}
                onClick={() => handleNotificationClick(n)}
                className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer ${!n.is_read ? 'bg-primary/5' : ''}`}
              >
                {/* Unread dot */}
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full transition-colors ${!n.is_read ? 'bg-primary' : 'bg-transparent'}`} />

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Sender row */}
                  <div className="flex items-center gap-1.5">
                    <UserAvatar
                      src={n.sender_role !== 'Admin' ? (n.sender_avatar ?? undefined) : undefined}
                      name={senderName(n)}
                      role={n.sender_role ?? 'Admin'}
                      size={18}
                    />
                    <span className="text-xs font-semibold text-primary">{senderName(n)}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                  </div>
                  {/* Message */}
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.message}</p>
                </div>

                {/* Delete per item — visible on hover */}
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 shrink-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(n.notification_id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary/10 px-6 py-8 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Bell className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 mb-1">Notification Detail</p>
              <h2 className="text-xl font-black text-foreground leading-tight px-4">{selectedNotification?.title}</h2>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-muted-foreground/10">
              <UserAvatar 
                src={selectedNotification?.sender_role !== 'Admin' ? (selectedNotification?.sender_avatar ?? undefined) : undefined}
                name={selectedNotification ? senderName(selectedNotification) : ''}
                role={selectedNotification?.sender_role ?? 'Admin'}
                size={40}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{selectedNotification ? senderName(selectedNotification) : ''}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {selectedNotification?.sender_role || 'System'} · {selectedNotification && timeAgo(selectedNotification.created_at)}
                </p>
              </div>
            </div>

            <ScrollArea className="max-h-[300px] w-full rounded-md border p-4 bg-muted/20">
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {selectedNotification?.message}
              </div>
            </ScrollArea>

            <Button 
              className="w-full bg-primary hover:bg-primary/90 font-bold" 
              onClick={() => setSelectedNotification(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}

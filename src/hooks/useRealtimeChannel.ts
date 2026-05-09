/**
 * useRealtimeChannel — wrapper untuk Supabase realtime yang:
 * 1. Auto-reconnect saat channel CLOSED/TIMED_OUT
 * 2. Re-subscribe saat app kembali aktif (visibilitychange event)
 * 3. Cleanup channel saat komponen unmount
 *
 * Gunakan hook ini sebagai pengganti supabase.channel().on().subscribe()
 * untuk semua fitur realtime.
 */

import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

type ChannelFactory = () => RealtimeChannel;

export function useRealtimeChannel(
  channelFactory: ChannelFactory,
  deps: React.DependencyList = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscribe = useCallback(() => {
    // Remove any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = channelFactory();
    channelRef.current = channel;

    channel.subscribe((status) => {
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Auto-retry after 3 seconds if channel drops
        setTimeout(() => {
          if (channelRef.current === channel) {
            subscribe();
          }
        }, 3000);
      }
    });

    return channel;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    subscribe();

    // Re-subscribe when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App resumed, re-syncing channel...');
        subscribe();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribe]);

  return channelRef;
}

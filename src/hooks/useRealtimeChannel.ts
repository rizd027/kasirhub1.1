
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
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = channelFactory();
    channelRef.current = channel;

    channel.subscribe((status) => {
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
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

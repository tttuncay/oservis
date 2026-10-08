import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import {
  LIVE_POLL_INTERVAL_MS,
  WS_NAMESPACE,
  type TripLiveDto,
  type TripPathQueryDto,
  type WsTripPositionEvent,
  type WsTripStateEvent,
} from '@servisapp/shared';
import { currentAccessToken } from '@/auth/session-store';
import { api } from './client';

/**
 * Live tracking — FR-TRK-090, FR-TRK-100, FR-INT-020.
 *
 * ## The socket and the poll are the same screen, not two
 *
 * SDD §6.3: *"where the socket cannot connect, the client polls `GET /trips/:id/live` at
 * 15-second intervals"*. Both paths land in the **same** TanStack Query cache entry, so a
 * component reads one value and never asks which transport produced it. A screen that
 * branched on the transport would have two rendering paths, and the one exercised least —
 * the fallback — would be the one that broke.
 *
 * The socket does not replace the poll; it *suspends* it. `refetchInterval` is switched
 * off while a socket is connected and switched back on the moment it drops, which is the
 * whole of FR-INT-020 and needs no other state.
 */
export const trackingKeys = {
  fleet: ['tracking', 'fleet'] as const,
  live: ['tracking', 'live'] as const,
  path: ['tracking', 'path'] as const,
};

/**
 * FR-TRK-090 — the Admin's fleet.
 *
 * Polls every fifteen seconds, always. A fleet map has no single trip to subscribe to,
 * and subscribing to every active trip would open one room per vehicle to receive what
 * one small request already answers — with the vehicle roster, the plates and the crew
 * names the socket does not carry.
 */
export function useFleet(date?: string) {
  return useQuery({
    queryKey: [...trackingKeys.fleet, date ?? 'today'] as const,
    queryFn: () => api.tracking.fleet(date ? { date } : {}),
    refetchInterval: LIVE_POLL_INTERVAL_MS,
    // A stale marker is worse than a missing one on a map an Admin is watching to decide
    // whether to ring a driver.
    refetchOnWindowFocus: true,
  });
}

/** FR-TRK-100 — the recorded path of a past trip. Static; nothing here polls. */
export function useTripPath(tripId: string | undefined, query: Partial<TripPathQueryDto> = {}) {
  return useQuery({
    queryKey: [...trackingKeys.path, tripId ?? '', query] as const,
    queryFn: () => api.tracking.path(tripId as string, query),
    enabled: tripId !== undefined,
    // A replay does not change. Refetching it on every focus would be a request per
    // window switch for a trip that finished this morning.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * One trip's live state, over the socket where it connects and by polling where it does
 * not.
 *
 * @returns the query result, plus whether the socket is currently carrying it — which the
 *   UI shows, because *"live"* and *"refreshed fifteen seconds ago"* are different
 *   promises to make to somebody watching a vehicle.
 */
export function useTripLive(tripId: string | undefined, options: { enabled?: boolean } = {}) {
  const enabled = (options.enabled ?? true) && tripId !== undefined;
  const client = useQueryClient();
  const connected = useTripSocket(enabled ? tripId : undefined);

  const key = [...trackingKeys.live, tripId ?? ''] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.tracking.live(tripId as string),
    enabled,
    // FR-INT-020's fallback, and only the fallback: while the socket is connected the
    // interval is off and every update arrives as a push.
    refetchInterval: connected ? false : LIVE_POLL_INTERVAL_MS,
  });

  // The socket's pushes are written into the same cache entry the poll fills, so the
  // component below reads one value either way.
  useEffect(() => {
    if (!connected.socket || !tripId) return;

    const socket = connected.socket;

    const onPosition = (event: WsTripPositionEvent): void => {
      client.setQueryData<TripLiveDto>(key, (current) =>
        current
          ? {
              ...current,
              at: new Date().toISOString(),
              signalLost: false,
              position: {
                lat: event.lat,
                lng: event.lng,
                headingDeg: event.headingDeg,
                speedMps: event.speedMps,
                at: event.at,
              },
            }
          : current,
      );
    };

    const onState = (event: WsTripStateEvent): void => {
      // A state change reshapes more than the field it names — a finished trip has stops
      // that are all terminal — so this refetches rather than patching, which is the one
      // case where the round trip is worth more than the latency it costs.
      client.setQueryData<TripLiveDto>(key, (current) =>
        current ? { ...current, state: event.state } : current,
      );
      void client.invalidateQueries({ queryKey: key });
    };

    const onStopState = (): void => void client.invalidateQueries({ queryKey: key });

    socket.on('trip:position', onPosition);
    socket.on('trip:state', onState);
    socket.on('stop:state', onStopState);
    socket.on('route:changed', onStopState);

    return () => {
      socket.off('trip:position', onPosition);
      socket.off('trip:state', onState);
      socket.off('stop:state', onStopState);
      socket.off('route:changed', onStopState);
    };
  }, [client, connected.socket, key, tripId]);

  return { ...query, live: connected.connected && connected.subscribed };
}

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  /** Whether the server admitted this client to the trip's room (SDD §9.3). */
  subscribed: boolean;
}

const SOCKET_URL: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/api\/v\d+\/?$/,
  '',
);

/**
 * Opens `/ws`, subscribes to one trip, and reports whether the server allowed it.
 *
 * ## `subscribe` can be refused, and that is not an error
 *
 * SDD §9.3's window closes on its own: the trip finishes, or the child is set down. The
 * server answers `{ ok: false, code }` and the client stops claiming to be live —
 * `subscribed` goes false, `refetchInterval` comes back, and the screen keeps working
 * from the REST surface, which applies exactly the same rule.
 *
 * ## No reconnection storm
 *
 * `socket.io-client` reconnects with backoff by default and that is kept. What is *not*
 * kept is retrying an authentication refusal: a rejected token produces `connect_error`
 * and the socket is closed rather than retried, because the same token would be rejected
 * again and the REST client's own refresh is what fixes it.
 */
export function useTripSocket(tripId: string | undefined): SocketState {
  const [state, setState] = useState<SocketState>({
    socket: null,
    connected: false,
    subscribed: false,
  });

  // Held in a ref as well as in state, so the cleanup closes the socket it opened rather
  // than whichever one the last render happened to see.
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!tripId) return;

    const token = currentAccessToken();
    if (!token) return;

    const socket = io(`${SOCKET_URL}${WS_NAMESPACE}`, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;
    setState({ socket, connected: false, subscribed: false });

    socket.on('connect', () => {
      setState((current) => ({ ...current, socket, connected: true }));

      void socket
        .emitWithAck('subscribe', { tripId })
        .then((ack: { ok: boolean }) =>
          setState((current) => ({ ...current, subscribed: ack?.ok === true })),
        )
        .catch(() => setState((current) => ({ ...current, subscribed: false })));
    });

    socket.on('disconnect', () =>
      setState((current) => ({ ...current, connected: false, subscribed: false })),
    );

    socket.on('connect_error', () => {
      // Authentication, or the server being unreachable. Either way the polling fallback
      // is what carries the screen, and hammering the socket would only add noise.
      setState((current) => ({ ...current, connected: false, subscribed: false }));
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
      setState({ socket: null, connected: false, subscribed: false });
    };
  }, [tripId]);

  return state;
}

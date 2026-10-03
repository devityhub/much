import { api } from './api';
import type { UserProfile } from './types';

const TTL_MS = 30_000;
const cache = new Map<number, { profile: UserProfile; at: number }>();
const inflight = new Map<number, Promise<UserProfile>>();

/** Perfil ainda fresco no cache (sem ir à rede). */
export function peekProfile(id: number): UserProfile | null {
  const hit = cache.get(id);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) return null;
  return hit.profile;
}

export function primeProfile(profile: UserProfile) {
  cache.set(profile.user.id, { profile, at: Date.now() });
}

export function invalidateProfile(id: number) {
  cache.delete(id);
  inflight.delete(id);
}

/** Uma requisição por usuário: popover, modal e painel lateral compartilham o mesmo fetch. */
export function fetchProfile(id: number, opts?: { force?: boolean }): Promise<UserProfile> {
  if (!opts?.force) {
    const hit = peekProfile(id);
    if (hit) return Promise.resolve(hit);
    const pending = inflight.get(id);
    if (pending) return pending;
  }

  const request = api<UserProfile>(`/users/${id}`)
    .then((profile) => {
      primeProfile(profile);
      return profile;
    })
    .finally(() => {
      if (inflight.get(id) === request) inflight.delete(id);
    });

  inflight.set(id, request);
  return request;
}

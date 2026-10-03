import { createContext, useCallback, useContext, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import type { PublicUser, Room } from '../lib/types';

export type SettingsSection = 'account' | 'profile' | 'connections' | 'voice' | 'video' | 'screen' | 'devices' | 'appearance' | 'desktop';

export interface Anchor {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** 'self' abre acima do painel do usuário; 'user' abre o perfil de qualquer pessoa ao lado do elemento. */
export type ProfileTarget = { kind: 'self'; anchor: Anchor } | { kind: 'user'; user: PublicUser; anchor: Anchor };

export interface UserMenuTarget {
  user: PublicUser;
  x: number;
  y: number;
}

interface UiContextValue {
  settingsSection: SettingsSection | null;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  createRoomOpen: boolean;
  setCreateRoomOpen: (open: boolean) => void;
  screenShareOpen: boolean;
  setScreenShareOpen: (open: boolean) => void;
  profile: ProfileTarget | null;
  openProfile: (target: ProfileTarget) => void;
  closeProfile: () => void;
  /** Perfil completo, no cartão centralizado por cima do app. */
  fullProfile: PublicUser | null;
  openFullProfile: (user: PublicUser) => void;
  closeFullProfile: () => void;
  editingRoom: Room | null;
  setEditingRoom: (room: Room | null) => void;
  userMenu: UserMenuTarget | null;
  openUserMenu: (target: UserMenuTarget) => void;
  closeUserMenu: () => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function anchorOf(el: Element): Anchor {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [screenShareOpen, setScreenShareOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  const [fullProfile, setFullProfile] = useState<PublicUser | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [userMenu, setUserMenu] = useState<UserMenuTarget | null>(null);
  const openSettings = useCallback((section: SettingsSection = 'voice') => {
    setProfile(null);
    setUserMenu(null);
    setSettingsSection(section);
  }, []);
  const closeSettings = useCallback(() => setSettingsSection(null), []);
  const openProfile = useCallback((target: ProfileTarget) => {
    setUserMenu(null);
    setProfile(target);
  }, []);
  const openUserMenu = useCallback((target: UserMenuTarget) => setUserMenu(target), []);
  const closeUserMenu = useCallback(() => setUserMenu(null), []);
  const closeProfile = useCallback(() => setProfile(null), []);
  // O cartão substitui o popover: abrir um fecha o outro para não ficar perfil em dobro na tela.
  const openFullProfile = useCallback((user: PublicUser) => {
    setProfile(null);
    setUserMenu(null);
    setFullProfile(user);
  }, []);
  const closeFullProfile = useCallback(() => setFullProfile(null), []);
  const value = useMemo(
    () => ({
      settingsSection,
      openSettings,
      closeSettings,
      createRoomOpen,
      setCreateRoomOpen,
      screenShareOpen,
      setScreenShareOpen,
      profile,
      openProfile,
      closeProfile,
      fullProfile,
      openFullProfile,
      closeFullProfile,
      editingRoom,
      setEditingRoom,
      userMenu,
      openUserMenu,
      closeUserMenu,
    }),
    [
      settingsSection,
      openSettings,
      closeSettings,
      createRoomOpen,
      screenShareOpen,
      profile,
      openProfile,
      closeProfile,
      fullProfile,
      openFullProfile,
      closeFullProfile,
      editingRoom,
      userMenu,
      openUserMenu,
      closeUserMenu,
    ],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi precisa estar dentro de UiProvider');
  return ctx;
}

/** Props para qualquer elemento que represente um usuário: clique abre o perfil, botão direito abre o menu. */
export function useUserTrigger() {
  const { openProfile, openUserMenu } = useUi();
  return useCallback(
    (user: PublicUser) => ({
      onClick: (e: ReactMouseEvent<HTMLElement>) => {
        e.stopPropagation();
        openProfile({ kind: 'user', user, anchor: anchorOf(e.currentTarget) });
      },
      onContextMenu: (e: ReactMouseEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        openUserMenu({ user, x: e.clientX, y: e.clientY });
      },
    }),
    [openProfile, openUserMenu],
  );
}

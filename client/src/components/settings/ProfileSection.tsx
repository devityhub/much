import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Check, ImagePlus, Trash2 } from 'lucide-react';
import Avatar from '../Avatar';
import Spinner from '../Spinner';
import ProfileCard from '../profile/ProfileCard';
import { AVATAR_CROP, BANNER_CROP, DropZone, useImagePicker } from '../media/ImagePicker';
import { Button } from '../ui';
import { useToast } from '../../context/toast';
import { useAuth } from '../../lib/auth';
import CoverPhoto from '../CoverPhoto';
import { AVATARS, COVERS } from '../../lib/theme';
import { visiblePresence } from '../../lib/users';
import type { SelfUser } from '../../lib/types';

interface Draft {
  displayName: string;
  pronouns: string;
  bio: string;
  customStatus: string;
  avatar: string;
  banner: string;
  avatarImage: string | null;
  bannerImage: string | null;
}

function draftOf(user: SelfUser): Draft {
  return {
    displayName: user.displayName ?? '',
    pronouns: user.pronouns ?? '',
    bio: user.bio ?? '',
    customStatus: user.customStatus ?? '',
    avatar: user.avatar,
    banner: user.banner ?? 'cover-1',
    avatarImage: user.avatarImage ?? null,
    bannerImage: user.bannerImage ?? null,
  };
}

function Label({ children, counter }: { children: string; counter?: string }) {
  return (
    <div className="mb-1.5 flex items-center justify-between text-xs font-bold tracking-wider text-muted uppercase">
      <span>{children}</span>
      {counter && <span className="font-medium tracking-normal text-faint normal-case">{counter}</span>}
    </div>
  );
}

export default function ProfileSection() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(user ? draftOf(user) : null);
  const [saving, setSaving] = useState(false);
  const [shake, setShake] = useState(0);
  const avatarPicker = useImagePicker(AVATAR_CROP, (url) => setDraft((d) => (d ? { ...d, avatarImage: url } : d)));
  const bannerPicker = useImagePicker(BANNER_CROP, (url) => setDraft((d) => (d ? { ...d, bannerImage: url } : d)));

  useEffect(() => {
    if (user && !draft) setDraft(draftOf(user));
  }, [user, draft]);

  const dirty = useMemo(() => {
    if (!user || !draft) return false;
    const base = draftOf(user);
    return (Object.keys(base) as Array<keyof Draft>).some((k) => base[k] !== draft[k]);
  }, [user, draft]);

  if (!user || !draft) return null;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(draft);
      toast('Perfil salvo', 'success');
      setDraft(null);
    } catch (err) {
      toast((err as Error).message, 'error');
      setShake((s) => s + 1);
    } finally {
      setSaving(false);
    }
  };

  const preview: SelfUser = { ...user, ...draft, displayName: draft.displayName || null };

  return (
    <div className="grid gap-8 pb-20 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <div>
          <Label counter={`${draft.displayName.length}/32`}>Nome de exibição</Label>
          <input className="input" value={draft.displayName} maxLength={32} placeholder={user.nick} onChange={(e) => set({ displayName: e.target.value })} />
          <p className="mt-1.5 text-xs text-faint">É o nome que seus amigos veem. Seu nick ({user.nick}) continua o mesmo.</p>
        </div>

        <div>
          <Label counter={`${draft.pronouns.length}/30`}>Pronomes</Label>
          <input className="input" value={draft.pronouns} maxLength={30} placeholder="ela/dela, ele/dele..." onChange={(e) => set({ pronouns: e.target.value })} />
        </div>

        <div>
          <Label counter={`${draft.customStatus.length}/60`}>Status personalizado</Label>
          <input
            className="input"
            value={draft.customStatus}
            maxLength={60}
            placeholder="No que você está pensando?"
            onChange={(e) => set({ customStatus: e.target.value })}
          />
        </div>

        <div>
          <Label counter={`${draft.bio.length}/190`}>Sobre mim</Label>
          <textarea
            className="input min-h-28 resize-none"
            value={draft.bio}
            maxLength={190}
            placeholder="Conte um pouco sobre você"
            onChange={(e) => set({ bio: e.target.value })}
          />
        </div>

        <div>
          <Label>Foto de perfil</Label>
          <DropZone onFile={avatarPicker.handleFile} className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="flex items-center gap-4">
              <button type="button" onClick={avatarPicker.open} className="group relative shrink-0 rounded-full" aria-label="Escolher foto de perfil">
                <Avatar nick={user.nick} avatar={draft.avatar} image={draft.avatarImage} size={72} />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition group-hover:opacity-100">
                  <Camera size={22} />
                </span>
                {avatarPicker.uploading && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                    <Spinner />
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">PNG, JPG, WEBP ou GIF animado. Você também pode arrastar a imagem para cá.</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button size="sm" onClick={avatarPicker.open} disabled={avatarPicker.uploading}>
                    <ImagePlus size={15} /> {draft.avatarImage ? 'Trocar foto' : 'Enviar foto'}
                  </Button>
                  {draft.avatarImage && (
                    <Button size="sm" variant="ghost" onClick={() => set({ avatarImage: null })}>
                      <Trash2 size={15} /> Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DropZone>
          {avatarPicker.element}
          <p className="mt-3 mb-2 text-xs text-faint">{draft.avatarImage ? 'Ou volte para um avatar de cor:' : 'Ou use um avatar de cor:'}</p>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(AVATARS).map(([id, info]) => (
              <motion.button
                key={id}
                type="button"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => set({ avatar: id, avatarImage: null })}
                title={info.label}
                className={`rounded-full p-0.5 transition ${!draft.avatarImage && draft.avatar === id ? 'ring-2 ring-white' : 'opacity-70 hover:opacity-100'}`}
              >
                <Avatar nick={user.nick} avatar={id} size={36} />
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <Label>Banner</Label>
          <DropZone onFile={bannerPicker.handleFile} className="rounded-2xl">
            <button
              type="button"
              onClick={bannerPicker.open}
              className="group relative flex aspect-[3/1] w-full items-center justify-center overflow-hidden rounded-2xl border border-line"
              aria-label="Escolher imagem do banner"
            >
              <CoverPhoto cover={draft.banner} image={draft.bannerImage} className="absolute inset-0" />
              <span className="relative z-10 flex items-center gap-2 rounded-xl bg-black/55 px-4 py-2 text-sm font-semibold opacity-0 backdrop-blur transition group-hover:opacity-100">
                <ImagePlus size={16} /> {draft.bannerImage ? 'Trocar imagem' : 'Enviar imagem'}
              </span>
              {bannerPicker.uploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Spinner />
                </span>
              )}
            </button>
          </DropZone>
          {bannerPicker.element}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={bannerPicker.open} disabled={bannerPicker.uploading}>
              <ImagePlus size={15} /> {draft.bannerImage ? 'Trocar imagem' : 'Enviar imagem'}
            </Button>
            {draft.bannerImage && (
              <Button size="sm" variant="ghost" onClick={() => set({ bannerImage: null })}>
                <Trash2 size={15} /> Remover imagem
              </Button>
            )}
            <span className="text-xs text-faint">Recomendado: 1200 × 400</span>
          </div>
          <p className="mt-3 mb-2 text-xs text-faint">Ou escolha uma cor:</p>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
            {Object.entries(COVERS).map(([id, gradient]) => (
              <motion.button
                key={id}
                type="button"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => set({ banner: id, bannerImage: null })}
                className="flex h-10 items-center justify-center rounded-xl"
                style={{ background: gradient }}
                aria-label={`Banner ${id}`}
              >
                {!draft.bannerImage && draft.banner === id && <Check size={18} className="drop-shadow" />}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label>Prévia</Label>
        <div className="sticky top-4 rounded-2xl border border-line shadow-2xl shadow-black/40">
          <ProfileCard user={preview} status={visiblePresence(user.presence)} bg="var(--color-surface-2)" />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center px-4">
        <AnimatePresence>
          {dirty && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto w-full max-w-[640px]"
            >
              <motion.div
                key={shake}
                animate={{ x: shake ? [0, -10, 10, -6, 6, 0] : 0 }}
                transition={{ duration: 0.4 }}
                className={`flex items-center gap-4 rounded-2xl border bg-surface-3/95 px-5 py-3 shadow-2xl shadow-black/60 backdrop-blur ${shake ? 'border-danger/60' : 'border-line'}`}
              >
                <span className="flex-1 text-sm font-medium">Cuidado, você tem alterações não salvas!</span>
                <Button variant="ghost" size="sm" onClick={() => setDraft(draftOf(user))}>
                  Redefinir
                </Button>
                <Button variant="success" size="sm" disabled={saving} onClick={() => void save()}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

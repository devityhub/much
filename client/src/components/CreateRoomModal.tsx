import { useState, type FormEvent } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import CoverPhoto from './CoverPhoto';
import Modal from './Modal';
import RoomIcon from './RoomIcon';
import Spinner from './Spinner';
import { DropZone, ROOM_COVER_CROP, ROOM_ICON_CROP, useImagePicker } from './media/ImagePicker';
import { Button, Toggle } from './ui';
import { useCall } from '../context/call';
import { useRooms } from '../context/rooms';
import { useToast } from '../context/toast';
import type { Room } from '../lib/types';

/** Cria uma sala nova ou, com `room`, edita uma sala existente (só o dono). */
export default function CreateRoomModal({ room, onClose }: { room?: Room | null; onClose: () => void }) {
  const { createRoom, updateRoom } = useRooms();
  const { joinRoom } = useCall();
  const toast = useToast();
  const editing = Boolean(room);
  const [name, setName] = useState(room?.name ?? '');
  const cover = room?.cover ?? 'cover-1';
  const [coverImage, setCoverImage] = useState<string | null>(room?.coverImage ?? null);
  const [iconImage, setIconImage] = useState<string | null>(room?.iconImage ?? null);
  const [description, setDescription] = useState(room?.description ?? '');
  const [promoted, setPromoted] = useState(room?.promoted ?? false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const coverPicker = useImagePicker(ROOM_COVER_CROP, (url) => setCoverImage(url || null));
  const iconPicker = useImagePicker(ROOM_ICON_CROP, (url) => setIconImage(url || null));
  const uploading = coverPicker.uploading || iconPicker.uploading;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = { name: name.trim(), cover, coverImage, iconImage, description: description.trim(), promoted };
    try {
      if (room) {
        await updateRoom(room.id, data);
        toast('Sala atualizada', 'success');
        onClose();
      } else {
        const created = await createRoom(data);
        onClose();
        joinRoom(created);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Editar sala' : 'Criar sala pública'}
      subtitle={editing ? 'Mude o nome, a descrição, a capa e o ícone da sala.' : 'Qualquer pessoa do PassTime pode entrar e transmitir aqui.'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <DropZone onFile={coverPicker.handleFile} className="rounded-xl">
          <CoverPhoto
            cover={cover}
            image={coverImage}
            role="button"
            tabIndex={0}
            onClick={coverPicker.open}
            onKeyDown={(e) => e.key === 'Enter' && coverPicker.open()}
            className="group flex aspect-[21/9] cursor-pointer items-end rounded-xl p-4"
            aria-label="Escolher capa da sala"
          >
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
            <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-semibold opacity-0 backdrop-blur transition group-hover:opacity-100">
              <ImagePlus size={14} /> {coverImage ? 'Trocar capa' : 'Enviar capa'}
            </span>
            <div className="relative flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  iconPicker.open();
                }}
                className="group/icon relative rounded-[20px] ring-4 ring-black/30"
                aria-label="Escolher ícone da sala"
              >
                <RoomIcon name={name || 'Sala'} cover={cover} image={iconImage} size={64} />
                <span className="absolute inset-0 flex items-center justify-center rounded-[19px] bg-black/55 opacity-0 transition group-hover/icon:opacity-100">
                  <Camera size={20} />
                </span>
                {iconPicker.uploading && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-[19px] bg-black/60">
                    <Spinner />
                  </span>
                )}
              </button>
              <span className="font-display text-2xl font-semibold drop-shadow">{name || 'nome-da-sala'}</span>
            </div>
            {coverPicker.uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Spinner />
              </span>
            )}
          </CoverPhoto>
        </DropZone>
        {coverPicker.element}
        {iconPicker.element}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-surface-1 p-3">
            <p className="text-xs font-bold tracking-wider text-muted uppercase">Capa</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={coverPicker.open} disabled={coverPicker.uploading}>
                <ImagePlus size={14} /> {coverImage ? 'Trocar' : 'Enviar'}
              </Button>
              {coverImage && (
                <Button size="sm" variant="ghost" onClick={() => setCoverImage(null)} aria-label="Remover capa">
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface-1 p-3">
            <p className="text-xs font-bold tracking-wider text-muted uppercase">Ícone</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={iconPicker.open} disabled={iconPicker.uploading}>
                <ImagePlus size={14} /> {iconImage ? 'Trocar' : 'Enviar'}
              </Button>
              {iconImage && (
                <Button size="sm" variant="ghost" onClick={() => setIconImage(null)} aria-label="Remover ícone">
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>
        </div>
        <p className="-mt-2 text-xs text-faint">PNG, JPG ou WEBP leve (até 2 MB). Arraste a imagem até a capa para enviar mais rápido.</p>

        <div>
          <label className="mb-1.5 block text-xs font-bold tracking-wider text-muted uppercase">Nome da sala</label>
          <input className="input" placeholder="Ex.: Noite do filme" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus required />
        </div>

        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs font-bold tracking-wider text-muted uppercase">
            Descrição
            <span className="font-medium tracking-normal normal-case text-faint">{240 - description.length}</span>
          </label>
          <textarea
            className="input min-h-[72px] resize-none"
            placeholder="Conte o que rola na sala: filme, música, conversa jogada fora..."
            value={description}
            maxLength={240}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-line bg-surface-1 px-4">
          <Toggle
            checked={promoted}
            onChange={setPromoted}
            label="Divulgar no meu perfil"
            hint="Quem abrir seu perfil vê a sala com banner, ícone e descrição, e entra com um clique. Só uma sala por vez."
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={busy || uploading || name.trim().length < 2} size="lg" className="w-full">
          {busy ? (editing ? 'Salvando...' : 'Criando...') : editing ? 'Salvar alterações' : 'Criar e entrar'}
        </Button>
      </form>
    </Modal>
  );
}

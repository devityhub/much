import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ImagePlus, Loader2, Search, Trash2, X } from 'lucide-react';
import { useToast } from '../../context/toast';
import { EMOJI_CATEGORIES, loadEmojiRecents, saveEmojiRecent, searchEmojis, type Emoji } from '../../lib/emoji';
import {
  addSticker,
  builtinStickerUrl,
  deleteSticker,
  listStickers,
  BUILTIN_STICKERS,
  MAX_STICKERS,
  type Sticker,
} from '../../lib/stickers';
import { MAX_GIF_BYTES, uploadImage, validateImageFile } from '../../lib/upload';

type Tab = 'emoji' | 'sticker';

interface ChatPickerProps {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onEmoji: (char: string) => void;
  onSticker: (url: string) => void;
  onClose: () => void;
}

function EmojiGrid({ emojis, onPick }: { emojis: Emoji[]; onPick: (char: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {emojis.map((emoji) => (
        <button
          key={emoji.char}
          onClick={() => onPick(emoji.char)}
          title={emoji.keywords.split(' ')[0]}
          className="flex h-9 items-center justify-center rounded-lg text-[22px] leading-none transition hover:bg-surface-4"
        >
          {emoji.char}
        </button>
      ))}
    </div>
  );
}

function EmojiTab({ onEmoji }: { onEmoji: (char: string) => void }) {
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<Emoji[]>(() => loadEmojiRecents());
  const scroller = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchEmojis(query), [query]);

  const pick = (char: string) => {
    setRecents(saveEmojiRecent(char));
    onEmoji(char);
  };

  const goTo = (id: string) => {
    const el = scroller.current?.querySelector(`[data-cat="${id}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Search size={14} className="shrink-0 text-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar emoji (ex.: coração, risada)"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
        {query && (
          <button onClick={() => setQuery('')} className="shrink-0 text-faint hover:text-white" aria-label="Limpar busca">
            <X size={14} />
          </button>
        )}
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {query ? (
          results.length ? (
            <EmojiGrid emojis={results} onPick={pick} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">Nenhum emoji para "{query}"</p>
          )
        ) : (
          <>
            {recents.length > 0 && (
              <section className="mb-2">
                <h4 className="px-1 pb-1 text-[11px] font-bold tracking-wider text-faint uppercase">Usados há pouco</h4>
                <EmojiGrid emojis={recents} onPick={pick} />
              </section>
            )}
            {EMOJI_CATEGORIES.map((category) => (
              <section key={category.id} data-cat={category.id} className="mb-2 scroll-mt-2">
                <h4 className="sticky top-0 z-10 bg-surface-2/95 px-1 pb-1 text-[11px] font-bold tracking-wider text-faint uppercase backdrop-blur">
                  {category.label}
                </h4>
                <EmojiGrid emojis={category.emojis} onPick={pick} />
              </section>
            ))}
          </>
        )}
      </div>
      {!query && (
        <div className="flex shrink-0 items-center justify-between border-t border-line px-2 py-1.5">
          {EMOJI_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => goTo(category.id)}
              title={category.label}
              aria-label={category.label}
              className="rounded-lg px-1.5 py-1 text-lg leading-none transition hover:bg-surface-4"
            >
              {category.icon}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function StickerTab({ onSticker }: { onSticker: (url: string) => void }) {
  const toast = useToast();
  const [mine, setMine] = useState<Sticker[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listStickers()
      .then((stickers) => !cancelled && setMine(stickers))
      .catch(() => !cancelled && setMine([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const upload = async (picked: File) => {
    const problem = validateImageFile(picked) ?? (picked.size > MAX_GIF_BYTES ? 'Figurinha grande demais (máximo de 6 MB).' : null);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    setUploading(true);
    try {
      // Vai sem recorte para GIFs continuarem animados e a transparência ficar intacta.
      const url = await uploadImage(picked);
      const sticker = await addSticker(url, picked.name.replace(/\.[^.]+$/, '').slice(0, 40));
      setMine((all) => [sticker, ...(all ?? [])]);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (sticker: Sticker) => {
    setMine((all) => (all ?? []).filter((s) => s.id !== sticker.id));
    try {
      await deleteSticker(sticker.id);
    } catch (err) {
      toast((err as Error).message, 'error');
      setMine(await listStickers().catch(() => mine ?? []));
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <section>
        <h4 className="pb-1.5 text-[11px] font-bold tracking-wider text-faint uppercase">Pacote do PassTime</h4>
        <div className="grid grid-cols-4 gap-1.5">
          {BUILTIN_STICKERS.map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => onSticker(builtinStickerUrl(sticker.id))}
              title={sticker.name}
              className="aspect-square rounded-xl p-1.5 transition hover:bg-surface-4"
            >
              <img src={builtinStickerUrl(sticker.id)} alt={sticker.name} className="h-full w-full object-contain" draggable={false} />
            </button>
          ))}
        </div>
      </section>

      <section className="mt-3">
        <h4 className="flex items-baseline justify-between pb-1.5 text-[11px] font-bold tracking-wider text-faint uppercase">
          Suas figurinhas
          {mine && (
            <span className="font-medium normal-case">
              {mine.length}/{MAX_STICKERS}
            </span>
          )}
        </h4>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => file.current?.click()}
            disabled={uploading || (mine?.length ?? 0) >= MAX_STICKERS}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-faint transition hover:border-accent/60 hover:text-accent disabled:opacity-40"
            title="Enviar uma imagem como figurinha"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            <span className="text-[10px] font-semibold">Enviar</span>
          </button>
          {mine?.map((sticker) => (
            <div key={sticker.id} className="group relative aspect-square">
              <button
                onClick={() => onSticker(sticker.url)}
                title={sticker.name || 'Figurinha'}
                className="h-full w-full rounded-xl p-1.5 transition hover:bg-surface-4"
              >
                <img src={sticker.url} alt={sticker.name} className="h-full w-full object-contain" draggable={false} />
              </button>
              <button
                onClick={() => void remove(sticker)}
                className="absolute -top-1 -right-1 hidden rounded-full border border-line bg-surface-2 p-1 text-muted shadow-lg group-hover:block hover:text-danger"
                title="Apagar figurinha"
                aria-label="Apagar figurinha"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
        {mine?.length === 0 && <p className="mt-2 text-xs text-muted">Mande um PNG, WEBP ou GIF (até 6 MB) para virar figurinha sua.</p>}
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = '';
            if (picked) void upload(picked);
          }}
        />
      </section>
    </div>
  );
}

/** Painel de emojis e figurinhas do chat. */
export default function ChatPicker({ tab, onTab, onEmoji, onSticker, onClose }: ChatPickerProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // No próximo tick para o clique que abriu o painel não fechá-lo.
    const id = setTimeout(() => document.addEventListener('pointerdown', onDown));
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={panel}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 bottom-full z-30 mb-2 flex h-[380px] w-[352px] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-2xl shadow-black/60"
    >
      <div className="flex shrink-0 gap-1 border-b border-line p-1.5">
        {(
          [
            ['emoji', 'Emojis'],
            ['sticker', 'Figurinhas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => onTab(id)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition ${tab === id ? 'bg-surface-4 text-white' : 'text-muted hover:bg-surface-3'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'emoji' ? <EmojiTab onEmoji={onEmoji} /> : <StickerTab onSticker={onSticker} />}
    </motion.div>
  );
}

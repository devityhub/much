import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ImageIcon, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../ui';
import { useToast } from '../../context/toast';
import { IMAGE_TYPES, uploadImage, validateImageFile } from '../../lib/upload';

export interface CropSpec {
  title: string;
  /** Largura ÷ altura do recorte. */
  aspect: number;
  shape: 'circle' | 'rect';
  /** Tamanho final da imagem enviada, em pixels. */
  width: number;
  height: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function ImageCropModal({ file, spec, onCancel, onApply }: { file: File; spec: CropSpec; onCancel: () => void; onApply: (blob: Blob) => void }) {
  const [src] = useState(() => URL.createObjectURL(file));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const frameW = spec.shape === 'circle' ? 300 : 460;
  const frameH = Math.round(frameW / spec.aspect);
  const base = natural ? Math.max(frameW / natural.w, frameH / natural.h) : 1;
  const dispW = natural ? natural.w * base * zoom : frameW;
  const dispH = natural ? natural.h * base * zoom : frameH;

  const clamp = useCallback(
    (o: { x: number; y: number }, z: number) => {
      if (!natural) return o;
      const maxX = (natural.w * base * z - frameW) / 2;
      const maxY = (natural.h * base * z - frameH) / 2;
      return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) };
    },
    [natural, base, frameW, frameH],
  );

  useEffect(() => () => URL.revokeObjectURL(src), [src]);
  useEffect(() => setOffset((o) => clamp(o, zoom)), [zoom, clamp]);

  const apply = () => {
    if (!img.current || !natural) return;
    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    const scale = spec.width / frameW;
    const left = (frameW - dispW) / 2 + offset.x;
    const top = (frameH - dispH) / 2 + offset.y;
    ctx.drawImage(img.current, left * scale, top * scale, dispW * scale, dispH * scale);
    // WebP leve: upload rápido e preview quase imediato.
    canvas.toBlob((blob) => blob && onApply(blob), 'image/webp', 0.72);
  };

  // Captura antes dos outros modais para o Esc fechar só o recorte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const onPointerDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }, zoom));
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-lg rounded-2xl border border-line bg-surface-2 p-6 shadow-2xl shadow-black/60"
      >
        <h2 className="font-display text-xl font-semibold">{spec.title}</h2>
        <p className="mt-1 text-sm text-muted">Arraste para posicionar e use o zoom para ajustar.</p>

        <div className="mt-5 flex justify-center rounded-xl bg-bg p-4">
          <div
            className={`relative touch-none overflow-hidden ${spec.shape === 'circle' ? 'rounded-xl' : 'rounded-lg'} ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ width: frameW, height: frameH }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z - e.deltaY * 0.0015)))}
          >
            <img
              ref={img}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="absolute top-1/2 left-1/2 max-w-none select-none"
              style={{ width: dispW, height: dispH, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`, opacity: natural ? 1 : 0 }}
            />
            <div
              className={`pointer-events-none absolute inset-0 border-2 border-white/70 ${spec.shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <ZoomOut size={18} className="shrink-0 text-muted" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="slider flex-1"
            style={{ ['--fill' as string]: `${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%` }}
            aria-label="Zoom"
          />
          <ZoomIn size={18} className="shrink-0 text-muted" />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={apply} disabled={!natural}>
            Aplicar
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Abre o seletor de arquivo, recorta a imagem e envia ao servidor.
 * GIFs são enviados sem recorte para continuarem animados.
 */
export function useImagePicker(spec: CropSpec, onUploaded: (url: string) => void) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const callback = useRef(onUploaded);
  callback.current = onUploaded;
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (blob: Blob) => {
      setUploading(true);
      // Mostra a imagem na hora; troca pela URL do servidor quando o upload terminar.
      const preview = URL.createObjectURL(blob);
      callback.current(preview);
      try {
        const url = await uploadImage(blob);
        callback.current(url);
        if (blob.type === 'image/gif') toast('GIF enviado inteiro para continuar animado', 'success');
      } catch (err) {
        callback.current('');
        toast((err as Error).message, 'error');
      } finally {
        URL.revokeObjectURL(preview);
        setUploading(false);
      }
    },
    [toast],
  );

  const handleFile = useCallback(
    (f: File) => {
      const error = validateImageFile(f);
      if (error) return toast(error, 'error');
      if (f.type === 'image/gif') void upload(f);
      else setFile(f);
    },
    [toast, upload],
  );

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) handleFile(f);
  };

  const element: ReactNode = (
    <>
      <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} hidden onChange={onChange} />
      {createPortal(
        <AnimatePresence>
          {file && (
            <ImageCropModal
              key="crop"
              file={file}
              spec={spec}
              onCancel={() => setFile(null)}
              onApply={(blob) => {
                setFile(null);
                void upload(blob);
              }}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );

  return { open: () => input.current?.click(), handleFile, uploading, element };
}

/** Área que aceita soltar uma imagem arrastada do computador. */
export function DropZone({ onFile, children, className = '' }: { onFile: (file: File) => void; children: ReactNode; className?: string }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`relative ${className}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      {children}
      <AnimatePresence>
        {over && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-accent bg-accent/20 text-sm font-semibold backdrop-blur-sm"
          >
            <ImageIcon size={18} /> Solte a imagem aqui
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const AVATAR_CROP: CropSpec = { title: 'Ajustar foto de perfil', aspect: 1, shape: 'circle', width: 256, height: 256 };
export const BANNER_CROP: CropSpec = { title: 'Ajustar banner', aspect: 3, shape: 'rect', width: 960, height: 320 };
export const ROOM_COVER_CROP: CropSpec = { title: 'Ajustar capa da sala', aspect: 21 / 9, shape: 'rect', width: 840, height: 360 };
export const ROOM_ICON_CROP: CropSpec = { title: 'Ajustar ícone da sala', aspect: 1, shape: 'rect', width: 128, height: 128 };
export const GROUP_ICON_CROP: CropSpec = { title: 'Ajustar ícone do grupo', aspect: 1, shape: 'circle', width: 128, height: 128 };

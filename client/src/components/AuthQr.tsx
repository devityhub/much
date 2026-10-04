import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { LogoMark } from './Logo';

export default function AuthQr() {
  const url = typeof window === 'undefined' ? 'https://passtime.app' : window.location.origin;
  const [src, setSrc] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(url, {
      width: 196,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#6d28d9', light: '#f5f3ff' },
    }).then((data) => {
      if (alive) setSrc(data);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside className="hidden w-[250px] shrink-0 flex-col items-center text-center md:flex">
      <div className="rounded-2xl border border-line bg-surface-2 p-3">
        <div className="relative overflow-hidden rounded-xl">
          {src ? (
            <img src={src} alt="Código QR do PassTime" width={196} height={196} className="block" />
          ) : (
            <div className="h-[196px] w-[196px] bg-[#f5f3ff]" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl bg-white p-1.5 shadow-md">
              <LogoMark size={34} />
            </div>
          </div>
        </div>
      </div>
      <h2 className="font-display mt-5 text-lg font-bold">No celular</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Escaneie e o PassTime abre no navegador. Entra com a mesma conta.
      </p>
      <button type="button" onClick={() => void copy()} className="mt-4 text-sm font-semibold text-accent hover:underline">
        {copied ? 'Link copiado' : 'Copiar endereço do site'}
      </button>
    </aside>
  );
}

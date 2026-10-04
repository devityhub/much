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
      width: 184,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#111214', light: '#ffffff' },
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
    <div className="hidden w-[240px] shrink-0 flex-col items-center text-center md:flex">
      <div className="relative rounded-sm bg-white p-2">
        {src ? (
          <img src={src} alt="Código QR do PassTime" width={184} height={184} className="block" />
        ) : (
          <div className="h-[184px] w-[184px] bg-white" />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-md bg-white p-1 shadow-sm">
            <LogoMark size={36} />
          </div>
        </div>
      </div>
      <h2 className="mt-6 text-xl font-bold text-white">Entrar pelo celular</h2>
      <p className="mt-2 text-sm leading-snug text-[#b5bac1]">
        Aponte a câmera do celular para este código e abra o <span className="font-semibold text-white">PassTime</span> no
        navegador. Depois entre com a mesma conta.
      </p>
      <button type="button" onClick={() => void copy()} className="auth-link mt-4">
        {copied ? 'Link copiado' : 'Ou copie o endereço do site'}
      </button>
    </div>
  );
}

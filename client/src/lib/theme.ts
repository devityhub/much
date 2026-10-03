export const AVATARS: Record<string, { label: string; gradient: string }> = {
  red: { label: 'Violeta', gradient: 'linear-gradient(135deg, #8b5cf6, #4c1d95)' },
  blue: { label: 'Oceano', gradient: 'linear-gradient(135deg, #4facfe, #3a5bd9)' },
  yellow: { label: 'Lavanda', gradient: 'linear-gradient(135deg, #c4b5fd, #7c3aed)' },
  green: { label: 'Menta', gradient: 'linear-gradient(135deg, #43e97b, #1b9e77)' },
  purple: { label: 'Uva', gradient: 'linear-gradient(135deg, #a78bfa, #6d28d9)' },
  pink: { label: 'Índigo', gradient: 'linear-gradient(135deg, #818cf8, #312e81)' },
  orange: { label: 'Ameixa', gradient: 'linear-gradient(135deg, #6d28d9, #2e1065)' },
  teal: { label: 'Aurora', gradient: 'linear-gradient(135deg, #2af598, #009efd)' },
};

export const COVERS: Record<string, string> = {
  'cover-1': 'linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)',
  'cover-2': 'linear-gradient(135deg, #4facfe 0%, #6d28d9 100%)',
  'cover-3': 'linear-gradient(135deg, #a78bfa 0%, #4338ca 100%)',
  'cover-4': 'linear-gradient(135deg, #43e97b 0%, #0ea5e9 100%)',
  'cover-5': 'linear-gradient(135deg, #6d28d9 0%, #1e1b4b 100%)',
  'cover-6': 'linear-gradient(135deg, #0f2027 0%, #2c5364 100%)',
  'cover-7': 'linear-gradient(135deg, #312e81 0%, #581c87 100%)',
  'cover-8': 'linear-gradient(135deg, #232526 0%, #50535c 100%)',
};

export function avatarGradient(avatar: string) {
  return (AVATARS[avatar] ?? AVATARS.red).gradient;
}

export function coverGradient(cover: string) {
  return COVERS[cover] ?? COVERS['cover-1'];
}

/** Fundo CSS de banner/capa: a imagem enviada, ou o degradê escolhido. */
export function coverBackground(cover: string | undefined, image?: string | null) {
  const gradient = coverGradient(cover ?? 'cover-1');
  return image ? `center / cover no-repeat url("${image}"), ${gradient}` : gradient;
}

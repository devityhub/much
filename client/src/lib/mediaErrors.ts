export function mediaErrorMessage(err: unknown, device: string): string | null {
  const error = err as DOMException;
  switch (error?.name) {
    case 'NotAllowedError':
      return device === 'tela' ? null : `Permissão para usar ${device} negada. Libere nas configurações do navegador.`;
    case 'AbortError':
      return null;
    case 'NotFoundError':
      return `Nenhum dispositivo de ${device} encontrado.`;
    case 'NotReadableError':
      return `Não foi possível acessar ${device}: está em uso por outro programa?`;
    case 'OverconstrainedError':
      return `O dispositivo de ${device} escolhido não suporta essa configuração.`;
    default:
      return error?.message || `Erro ao acessar ${device}.`;
  }
}

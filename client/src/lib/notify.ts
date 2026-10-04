/** Notificação do sistema, só quando o PassTime está em segundo plano e o usuário permitiu. */
export function notify(title: string, body: string, onClick?: () => void) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
  const n = new Notification(title, { body, icon: '/favicon.svg', silent: true });
  n.onclick = () => {
    window.focus();
    onClick?.();
    n.close();
  };
}

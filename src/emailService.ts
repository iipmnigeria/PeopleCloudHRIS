export interface EmailPayload {
  id: string;
  from: string;
  to: string;
  subject: string;
  bodyHtml: string;
  timestamp: string;
  status: 'sending' | 'delivered' | 'failed';
}

type EmailListener = (email: EmailPayload) => void;
const listeners = new Set<EmailListener>();

export function subscribeToEmails(listener: EmailListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function triggerEmail(email: Omit<EmailPayload, 'id' | 'timestamp' | 'status'>) {
  const fullEmail: EmailPayload = {
    ...email,
    id: 'mail-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    status: 'sending'
  };

  // Dispatch sending state
  listeners.forEach(l => l(fullEmail));

  // Simulate SMTP handshakes and delivery
  setTimeout(() => {
    const deliveredEmail: EmailPayload = {
      ...fullEmail,
      status: 'delivered'
    };
    listeners.forEach(l => l(deliveredEmail));
  }, 1500);
}

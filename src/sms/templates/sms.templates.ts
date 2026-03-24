export const SMS_TEMPLATES = {
  LARGE_LOSS: 'ALERT: Your position on {{asset}} is down {{percentage}}%. Review at {{link}}',
  SECURITY: "New login detected from {{location}}. If this wasn't you, secure your account: {{link}}",
  PAYOUT_FAILED: 'Payout of {{amount}} failed. Action required: {{link}}',
};

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
}

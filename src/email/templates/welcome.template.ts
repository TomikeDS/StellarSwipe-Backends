export interface EmailTemplate {
  subject: string;
  html: string;
  variables: string[];
}

export const welcomeTemplate: EmailTemplate = {
  subject: 'Welcome to StellarSwipe',
  html: `
    <h1>Welcome to StellarSwipe!</h1>
    <p>Hi {{name}},</p>
    <p>Thank you for joining StellarSwipe. We're excited to have you on board!</p>
    <p>Get started by exploring our platform and setting up your first trade.</p>
    <a href="{{link}}">Go to Dashboard</a>
  `,
  variables: ['name', 'link'],
};

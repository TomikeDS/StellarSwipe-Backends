import { EmailTemplate } from './welcome.template';

export const payoutCompletedTemplate: EmailTemplate = {
  subject: 'Payout Completed: {{amount}}',
  html: `
    <h1>Payout Completed</h1>
    <p>Your payout of <strong>{{amount}}</strong> has been successfully processed.</p>
    <p><strong>Destination:</strong> {{destination}}</p>
    <p><strong>Transaction ID:</strong> {{transactionId}}</p>
    <p><strong>Date:</strong> {{date}}</p>
    <a href="{{link}}">View Transaction Details</a>
  `,
  variables: ['amount', 'destination', 'transactionId', 'date', 'link'],
};

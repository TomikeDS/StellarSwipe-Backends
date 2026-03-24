import { EmailTemplate } from './welcome.template';

export const tradeExecutedTemplate: EmailTemplate = {
  subject: 'Trade Executed: {{asset}}',
  html: `
    <h1>Trade Executed Successfully</h1>
    <p>Your trade on <strong>{{asset}}</strong> has been executed at <strong>{{price}}</strong>.</p>
    <p><strong>Amount:</strong> {{amount}}</p>
    <p><strong>Transaction ID:</strong> {{transactionId}}</p>
    <a href="{{link}}">View Details in Dashboard</a>
  `,
  variables: ['asset', 'price', 'amount', 'transactionId', 'link'],
};

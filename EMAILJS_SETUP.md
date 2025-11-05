# EmailJS Setup Guide

To enable email notifications for consent requests, follow these steps:

## 1. Create EmailJS Account
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Sign up for a free account (up to 200 emails/month)

## 2. Create Email Service
1. In EmailJS dashboard, go to "Email Services"
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow setup instructions
5. Note your **Service ID**

## 3. Create Email Template
1. Go to "Email Templates"
2. Click "Create New Template"
3. Use this template content:

```
Subject: Consent Request from {{from_name}}

Hello {{to_name}},

{{from_name}} ({{from_email}}) has sent you a consent request.

Activity/Purpose:
{{activity}}

Additional Details:
{{details}}

Deadline: {{deadline}}

To respond to this consent request, please:
1. Visit: {{app_link}}
2. Log in with your email
3. Navigate to the "Record" tab
4. Fill out your consent response

Request ID: {{request_id}}

Please respond at your earliest convenience.

Best regards,
Consent App System
```

4. Save the template and note your **Template ID**

## 4. Get Public Key
1. Go to "Account" → "General"
2. Copy your **Public Key**

## 5. Update Configuration
In `script.js`, update the emailJSConfig object with your values:

```javascript
this.emailJSConfig = {
    publicKey: 'YOUR_ACTUAL_PUBLIC_KEY',    // From step 4
    serviceId: 'YOUR_ACTUAL_SERVICE_ID',    // From step 2
    templateId: 'YOUR_ACTUAL_TEMPLATE_ID'   // From step 3
};
```

## 6. Deploy
1. Commit and push your changes
2. Test the consent request feature

## Template Variables Available
- `{{to_email}}` - Recipient email
- `{{to_name}}` - Recipient name
- `{{from_name}}` - Requester name  
- `{{from_email}}` - Requester email
- `{{activity}}` - Activity description
- `{{details}}` - Additional details
- `{{deadline}}` - Response deadline
- `{{app_link}}` - Link to the app
- `{{request_id}}` - Unique request ID

## Notes
- Free tier: 200 emails/month
- Emails may go to spam initially
- Test with your own email first
- Consider upgrading for higher volume
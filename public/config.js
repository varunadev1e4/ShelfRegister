/* Edit these values, then redeploy. The anon key is meant to be public:
   the database rules in supabase/schema.sql are what protect your data.
   NEVER put the service_role key in this file. */
window.CONFIG = {
  SUPABASE_URL: "https://uptrszneyodmmvaapzmg.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwdHJzem5leW9kbW12YWFwem1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3OTgzNTYsImV4cCI6MjEwOTM3NDM1Nn0.BjxmhAPmy1k7DmcPg7g9yE4EShw6LNdqOMp7IdHTM08",

  LIBRARY_NAME: "Varun's Library",
  OWNER_NAME: "Varun",

  // How friends contact you. Use digits only for WhatsApp, with country code (India: 91...).
  // Leave a value empty ("") to hide that button.
  CONTACT_WHATSAPP: "",
  CONTACT_EMAIL: "varunisvarun@hotmail.com",

  // How friends ask to borrow: "app" (a form that lands in your Requests tab),
  // "whatsapp" (opens a chat with you), or "both".
  REQUEST_MODE: "app",

  // Optional. Your site address, if shelf QR labels should use a custom domain
  // instead of the address you opened the owner app on. Example: "https://books.example.com"
  PUBLIC_URL: "varunslibrary.vercel.app",

  // Owner app: lending defaults.
  LOAN_DAYS: 14,                 // default days until a book is due back
  DEFAULT_COUNTRY_CODE: "91"     // added to 10-digit phone numbers for WhatsApp reminders
};

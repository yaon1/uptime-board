export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    databasePath: './data/uptime.sqlite',
    adminToken: '',
    telegramBotToken: '',
    telegramChatId: '',
    certWarnDays: 14,
    slackWebhookUrl: '',
    webhookUrl: '',
    webhookSecret: '',
    /** Days of check history to keep. */
    retentionDays: 90,
    public: { title: 'Status', description: '' },
  },
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: { '* * * * *': ['monitors:run'] },
  },
  app: { head: { meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }] } },
})

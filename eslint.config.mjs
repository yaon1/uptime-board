import { createConfigForNuxt } from '@nuxt/eslint-config/flat'
import prettier from 'eslint-config-prettier'

export default createConfigForNuxt()
  .append({ ignores: ['.output', '.nuxt', 'data'] })
  .append({ rules: { 'vue/multi-word-component-names': 'off' } })
  .append(prettier)

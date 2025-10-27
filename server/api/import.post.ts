import { importMonitors } from '../utils/transfer'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  try {
    return importMonitors(useDatabase(), await readBody(event))
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: (e as Error).message })
  }
})

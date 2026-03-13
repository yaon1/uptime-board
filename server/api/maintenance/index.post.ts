import { scheduleMaintenance } from '../../utils/maintenance'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = (await readBody<Record<string, unknown>>(event)) ?? {}
  const startsAt = Date.parse(String(body.starts_at ?? ''))
  const endsAt = Date.parse(String(body.ends_at ?? ''))
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt))
    throw createError({ statusCode: 400, statusMessage: 'starts_at and ends_at must be ISO dates' })
  try {
    setResponseStatus(event, 201)
    return scheduleMaintenance(useDatabase(), {
      monitor_id: body.monitor_id == null ? null : Number(body.monitor_id),
      starts_at: startsAt,
      ends_at: endsAt,
      note: typeof body.note === 'string' ? body.note.slice(0, 500) : '',
    })
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: (e as Error).message })
  }
})

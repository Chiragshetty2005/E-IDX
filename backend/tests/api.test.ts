import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { buildApp } from '../src/app.js'
import { closePool, pool, query } from '../src/db.js'
import { containsRiskField } from '../src/lib/privacy.js'

const SESSION_COOKIE = 'eidx_session'
const DEMO_STUDENT = '1DS23CS0048'
const REVOKED_STUDENT = '1DS23CS0084'

const app = await buildApp({ logger: false })

async function login(role: string, usn?: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/preview-login',
    payload: { role, usn },
  })
  assert.equal(response.statusCode, 200, `login failed for ${role} ${usn ?? ''}`)
  const cookie = response.cookies.find((entry) => entry.name === SESSION_COOKIE)
  assert.ok(cookie, 'session cookie was not issued')
  return cookie.value
}

function cookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}`
}

async function authGet(token: string, url: string) {
  return app.inject({ method: 'GET', url, headers: { cookie: cookieHeader(token) } })
}

async function authPost(token: string, url: string, payload: unknown) {
  return app.inject({
    method: 'POST',
    url,
    headers: { cookie: cookieHeader(token) },
    payload: payload as never,
  })
}

before(async () => {
  const result = await pool.query<{ students: number }>(
    `SELECT COUNT(*)::int AS students FROM app_users WHERE role = 'student'`,
  )
  const students = result.rows[0]?.students ?? 0
  if (students === 0) {
    throw new Error(
      'The database is empty. Run "npm run migrate && npm run seed" before the tests.',
    )
  }
})

after(async () => {
  await app.close()
  await closePool()
})

describe('health and session', () => {
  it('reports database health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().status, 'ok')
  })

  it('issues a server session for a preview sign-in', async () => {
    const token = await login('student', DEMO_STUDENT)
    const response = await authGet(token, '/api/v1/me')
    assert.equal(response.statusCode, 200)
    const body = response.json()
    assert.equal(body.user.usn, DEMO_STUDENT)
    assert.equal(body.user.role, 'student')
    assert.ok(Array.isArray(body.permissions))
  })

  it('refuses unauthenticated staff routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/overview' })
    assert.equal(response.statusCode, 401)
  })
})

describe('student surfaces never carry academic risk', () => {
  it('keeps /me free of risk fields', async () => {
    const token = await login('student', DEMO_STUDENT)
    const response = await authGet(token, '/api/v1/me')
    assert.equal(response.statusCode, 200)
    assert.equal(containsRiskField(response.json()), null)
  })

  it('keeps the card payload free of risk fields', async () => {
    const token = await login('student', DEMO_STUDENT)
    const response = await authGet(token, '/api/v1/me/card')
    assert.equal(response.statusCode, 200)
    assert.equal(containsRiskField(response.json()), null)
  })

  it('keeps the campus pass free of risk fields', async () => {
    const token = await login('student', DEMO_STUDENT)
    const response = await authPost(token, '/api/v1/me/pass', {})
    assert.equal(response.statusCode, 201)
    assert.equal(containsRiskField(response.json()), null)
    assert.ok(response.json().pass.token)
  })

  it('keeps attendance and campus services free of risk fields', async () => {
    const token = await login('student', DEMO_STUDENT)
    for (const url of [
      '/api/v1/me/attendance',
      '/api/v1/me/academics',
      '/api/v1/me/library',
      '/api/v1/me/exams',
      '/api/v1/me/fees',
    ]) {
      const response = await authGet(token, url)
      assert.equal(response.statusCode, 200, url)
      assert.equal(containsRiskField(response.json()), null, url)
    }
  })

  it('refuses a student facing risk endpoint explicitly', async () => {
    const token = await login('student', DEMO_STUDENT)
    const response = await authGet(token, '/api/v1/me/risk')
    assert.equal(response.statusCode, 403)
    assert.equal(response.json().error.code, 'risk_is_staff_only')
  })

  it('blocks a student from the staff student records', async () => {
    const token = await login('student', DEMO_STUDENT)
    const response = await authGet(token, '/api/v1/students/1DS23CS0017')
    assert.equal(response.statusCode, 403)
  })
})

describe('database level risk isolation', () => {
  it('cannot read the risk base table with the runtime role', async () => {
    await assert.rejects(
      () => query('SELECT COUNT(*) FROM risk.predictions'),
      /permission denied/i,
    )
  })

  it('cannot read a risk row outside the staff scope', async () => {
    const result = await query<{ total: number }>('SELECT COUNT(*)::int AS total FROM risk.staff_predictions')
    assert.equal(result.rows[0]?.total, 0)
  })
})

describe('staff risk surfaces', () => {
  it('returns campus risk totals for an admin', async () => {
    const token = await login('admin')
    const response = await authGet(token, '/api/v1/admin/overview')
    assert.equal(response.statusCode, 200)
    const body = response.json()
    assert.equal(body.campus.students, 4786)
    assert.equal(body.risk.support + body.risk.watch + body.risk.on_track, 4786)
    assert.ok(body.recent_card_updates.length > 0)
  })

  it('returns tier shares and thresholds for insights', async () => {
    const token = await login('admin')
    const response = await authGet(token, '/api/v1/insights/risk')
    assert.equal(response.statusCode, 200)
    const body = response.json()
    assert.equal(body.total, 4786)
    assert.ok(body.thresholds.needs_support > body.thresholds.watch)
    assert.ok(body.driver_groups.length > 0)
  })

  it('publishes the frozen model contract', async () => {
    const token = await login('faculty')
    const response = await authGet(token, '/api/v1/insights/model')
    assert.equal(response.statusCode, 200)
    const model = response.json().model
    assert.match(model.version, /^catboost-cutoff60-/)
    assert.equal(model.cutoff_day, 60)
    assert.equal(model.feature_count, 45)
    assert.ok(model.metrics.cross_validation_auc > 0.8)
    assert.ok(model.metrics.temporal_test_auc > 0.75)
    assert.ok(model.fairness_selection_gaps.highest_education > 0)
  })

  it('serves a prediction payload that matches the frozen schema', async () => {
    const token = await login('faculty')
    const response = await authGet(token, '/api/v1/students/1DS23CS0017')
    assert.equal(response.statusCode, 200)
    const risk = response.json().risk
    assert.ok(Array.isArray(risk) && risk.length > 0)
    const prediction = risk[0]
    for (const key of [
      'model_version',
      'cutoff_day',
      'generated_at',
      'risk_probability',
      'risk_tier',
      'drivers',
    ]) {
      assert.ok(key in prediction, `missing ${key}`)
    }
    assert.ok(['support', 'watch', 'on-track'].includes(prediction.risk_tier))
    assert.ok(prediction.risk_probability >= 0 && prediction.risk_probability <= 1)
    assert.ok(prediction.drivers.length <= 5)
    for (const driver of prediction.drivers) {
      for (const key of [
        'feature',
        'label',
        'group',
        'value',
        'display',
        'shap_value',
        'direction',
      ]) {
        assert.ok(key in driver, `driver missing ${key}`)
      }
      assert.ok(['increases-risk', 'reduces-risk'].includes(driver.direction))
    }
  })

  it('paginates the student list for staff', async () => {
    const token = await login('admin')
    const response = await authGet(token, '/api/v1/students?page=1&limit=5')
    assert.equal(response.statusCode, 200)
    const body = response.json()
    assert.equal(body.students.length, 5)
    assert.equal(body.pagination.total, 4786)
  })
})

describe('card updates', () => {
  it('queues an update and replays the same idempotency key', async () => {
    const token = await login('admin')
    const key = `test-${Date.now()}`
    const body = {
      change_type: 'validity',
      summary: 'Validity extended to Jun 2027',
      payload: { valid_to: '2027-06-30' },
      idempotency_key: key,
    }
    const first = await authPost(token, '/api/v1/students/1DS23CS0038/card-updates', body)
    assert.equal(first.statusCode, 201)
    assert.equal(first.json().update.idempotent_replay, false)

    const second = await authPost(token, '/api/v1/students/1DS23CS0038/card-updates', body)
    assert.equal(second.statusCode, 200)
    assert.equal(second.json().update.idempotent_replay, true)
    assert.equal(second.json().update.id, first.json().update.id)
  })

  it('refuses a card update that carries risk data', async () => {
    const token = await login('admin')
    const response = await authPost(token, '/api/v1/students/1DS23CS0038/card-updates', {
      change_type: 'validity',
      summary: 'Sneaky update',
      payload: { valid_to: '2027-06-30', risk_probability: 0.99 },
      idempotency_key: `leak-${Date.now()}`,
    })
    assert.equal(response.statusCode, 422)
  })

  it('requires an idempotency key', async () => {
    const token = await login('admin')
    const response = await authPost(token, '/api/v1/students/1DS23CS0038/card-updates', {
      change_type: 'validity',
      summary: 'No key',
      payload: {},
    })
    assert.equal(response.statusCode, 400)
  })
})

describe('verification', () => {
  it('accepts a valid campus pass', async () => {
    const token = await login('student', DEMO_STUDENT)
    const pass = (await authPost(token, '/api/v1/me/pass', {})).json().pass.token
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      payload: { token: pass, method: 'nfc', readerId: 'GATE 01' },
    })
    assert.equal(response.statusCode, 200)
    const body = response.json()
    assert.equal(body.result, 'accepted')
    assert.equal(body.student.usn, DEMO_STUDENT)
  })

  it('rejects an invalid pass', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      payload: { token: 'not-a-pass', method: 'qr', readerId: 'GATE 01' },
    })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().result, 'rejected')
    assert.equal(response.json().reason, 'invalid_or_expired_pass')
  })

  it('does not issue a pass for a revoked card', async () => {
    const token = await login('student', REVOKED_STUDENT)
    const response = await authPost(token, '/api/v1/me/pass', {})
    assert.equal(response.statusCode, 403)
  })

  it('lists verification events for staff only', async () => {
    const studentToken = await login('student', DEMO_STUDENT)
    const denied = await authGet(studentToken, '/api/v1/verifications')
    assert.equal(denied.statusCode, 403)

    const adminToken = await login('admin')
    const allowed = await authGet(adminToken, '/api/v1/verifications?limit=10')
    assert.equal(allowed.statusCode, 200)
    const page = allowed.json()
    assert.ok(page.verifications.length > 0)
    assert.equal(page.pagination.page, 1)
    assert.equal(page.pagination.limit, 10)
    assert.equal(page.pagination.pages, Math.ceil(page.pagination.total / 10))
  })
})

describe('readers and sessions', () => {
  it('requires the reader key for taps', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions/00000000-0000-0000-0000-000000000000/taps',
      payload: { card_uid: 'EIDX-0048', method: 'nfc' },
    })
    assert.equal(response.statusCode, 401)
  })

  it('opens and closes an attendance session', async () => {
    const token = await login('faculty')
    const created = await authPost(token, '/api/v1/sessions', {
      course_code: 'CS604',
      title: 'Minor project review',
      room: 'Project lab 2',
      starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    assert.equal(created.statusCode, 201)
    const sessionId = created.json().session.id
    assert.ok(sessionId)

    const opened = await authPost(token, `/api/v1/sessions/${sessionId}/open`, {})
    assert.equal(opened.statusCode, 200)
    assert.equal(opened.json().session.state, 'open')

    const closed = await authPost(token, `/api/v1/sessions/${sessionId}/close`, {})
    assert.equal(closed.statusCode, 200)
    assert.equal(closed.json().session.state, 'closed')
  })
})

describe('mentor notes', () => {
  it('appends a note with an author and a timestamp', async () => {
    const token = await login('faculty')
    const response = await authPost(
      token,
      '/api/v1/faculty/students/1DS23CS0017/interventions',
      { note: 'Reviewed the missed assessments and agreed a catch up plan.' },
    )
    assert.equal(response.statusCode, 201)
    const note = response.json().intervention
    assert.equal(note.source, 'mentor')
    assert.ok(note.created_at)
  })
})

module.exports = handlePullRequestChange

const getStatusFree = require('./free/get-status')
const setStatusFree = require('./free/set-status')

const getStatusPro = require('./pro/get-status')
const setStatusPro = require('./pro/set-status')

const getConfig = require('./app-config')
const getPlan = require('./common/get-plan')
const hasStatusChange = require('./common/has-status-change')
const legacyHandler = require('./legacy/handle-pull-request-change')

async function handlePullRequestChange (app, context) {
  const { action, pull_request: pr, repository: repo } = context.payload
  const accountId = repo.owner.id

  try {
    // 1. get new status based on marketplace plan
    const plan = await getPlan(app, accountId)
    const newStatus = plan === 'free' ? await getStatusFree(context) : await getStatusPro(context)
    const shortUrl = `${repo.full_name}#${pr.number}`

    // 2. if status did not change then don’t create a new check run. Quotas for
    //    mutations are more restrictive so we want to avoid them if possible
    const hasChange = await hasStatusChange(newStatus, context)
    const log = context.log.child({
      name: getConfig().name,
      event: context.event.event,
      action,
      account: repo.owner.id,
      plan,
      repo: repo.id,
      private: repo.private,
      change: hasChange,
      override: newStatus.override,
      wip: newStatus.wip,
      location: newStatus.location,
      match: newStatus.match
    })

    // if status did not change then don’t call .createStatus. Quotas for mutations
    // are much more restrictive so we want to avoid them if possible
    if (!hasChange) {
      return log.info(`😐 ${shortUrl}`)
    }

    // 3. Create check run
    if (plan === 'free') {
      await setStatusFree(newStatus, context)
    } else {
      await setStatusPro(newStatus, context)
    }

    const logStatus = newStatus.override
      ? '❗️'
      : newStatus.wip ? '⏳' : '✅'
    let message = `${logStatus} ${shortUrl}`
    if (newStatus.wip) {
      message += ` - "${newStatus.match}" found in ${newStatus.location}`
    }
    log.info(message)
  } catch (error) {
    try {
      // workaround for https://github.com/octokit/rest.js/issues/684
      const parsed = JSON.parse(error.message)
      for (const key in parsed) {
        error[key] = parsed[key]
      }

      // Resource not accessible by integration
      // That means the user did not accept the new permissions yet, so we
      // handle it the old school way
      if (error.code === 403) {
        return legacyHandler(context)
      }

      context.log.error(error)
    } catch (e) {
      context.log.error(error)
    }
  }
}

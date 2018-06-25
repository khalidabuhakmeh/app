module.exports = handlePullRequestChange

const getStatusFree = require('./free/get-status')
const getStatusPor = require('./pro/get-status')
const getCurrentStatus = require('./common/get-current-status')
const getPlan = require('./common/get-plan')

async function handlePullRequestChange (robot, context) {
  const {action, pull_request: pr, repository: repo} = context.payload
  const accountId = repo.owner.id

  try {
    // 1. get new status based on marketplace plan
    const plan = await getPlan(robot, accountId)
    const newStatus = plan === 'free' ? await getStatusFree(context) : await getStatusPor(context)
    const isWip = newStatus === 'pending'
    const logStatus = isWip ? '⏳' : '✅'
    const shortUrl = `${repo.full_name}#${pr.number}`

    // 2. if status did not change then don’t call .createStatus. Quotas for
    //    mutations are more restrictive so we want to avoid them if possible
    const currentStatus = await getCurrentStatus(context)
    const hasChange = currentStatus !== newStatus
    const log = context.log.child({
      name: 'wip',
      event: context.event.event,
      action,
      account: repo.owner.id,
      plan,
      repo: repo.id,
      change: hasChange,
      wip: isWip
    })

    // if status did not change then don’t call .createStatus. Quotas for mutations
    // are much more restrictive so we want to avoid them if possible
    if (!hasChange) {
      return log.info(`😐${logStatus} ${shortUrl}`)
    }

    // 3. Set new status
    await context.github.repos.createStatus(context.repo({
      sha: pr.head.sha,
      state: newStatus,
      target_url: 'https://github.com/apps/wip',
      description: isWip ? 'work in progress' : 'ready for review',
      context: 'WIP (beta)'
    }))

    log.info(`💾${logStatus} ${shortUrl}`)
  } catch (err) {
    context.log.error(err)
  }
}

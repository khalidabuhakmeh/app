module.exports = handlePullRequestChange

const getStatusFree = require('./free/get-status')
const getStatusPor = require('./pro/get-status')
const getCurrentStatus = require('./common/get-current-status')
const getPlan = require('./common/get-plan')

const locationLabel = {
  title: 'title',
  label_name: 'label',
  commit_subject: 'commit subject'
}

async function handlePullRequestChange (app, context) {
  const {action, pull_request: pr, repository: repo} = context.payload
  const accountId = repo.owner.id

  try {
    // 1. get new status based on marketplace plan
    const plan = await getPlan(app, accountId)
    const newStatus = plan === 'free' ? await getStatusFree(context) : await getStatusPor(context)
    const isWip = newStatus === 'pending'
    const logStatus = isWip ? '⏳' : '✅'
    const shortUrl = `${repo.full_name}#${pr.number}`

    // 2. if status did not change then don’t call .createStatus. Quotas for
    //    mutations are more restrictive so we want to avoid them if possible
    const currentStatus = await getCurrentStatus(context)
    const hasChange = currentStatus.wip !== newStatus.wip
    const log = context.log.child({
      name: 'wip',
      event: context.event.event,
      action,
      account: repo.owner.id,
      plan,
      repo: repo.id,
      change: hasChange,
      wip: newStatus.wip
    })

    // if status did not change then don’t call .createStatus. Quotas for mutations
    // are much more restrictive so we want to avoid them if possible
    if (!hasChange) {
      return log.info(`😐${logStatus} ${shortUrl}`)
    }

    // 3. Set new status
    const conclusion = newStatus.wip ? 'action_required' : 'success'
    const output = {
      title: newStatus.wip ? 'Work in progress' : 'Ready for review',
      summary: newStatus.wip
        ? `The ${locationLabel[newStatus.location]} "${newStatus.text}" contains "${newStatus.match}".

You can override the status by adding "@wip ready for review" to the end of the pull request description`
        : `No match found based on configuration`,
      text: `TO BE DONE: show current configuration for paid plan, show something meaningful for free plan`
    }
    const actions = []

    if (newStatus.wip) {
      actions.push({
        label: '✅ Ready for review',
        description: 'override status to "success"',
        identifier: `override:${pr.number}`
      })
    }

    if (newStatus.override) {
      output.title += ' (override)'
      actions.push({
        label: '🔄 Reset',
        description: 'Remove status override',
        identifier: `reset:${pr.number}`
      })
    }

    await context.github.checks.create(context.repo({
      owner: 'wip',
      repo: 'sandbox',
      name: 'WIP (beta)',
      head_branch: '', // workaround for https://github.com/octokit/rest.js/issues/874
      head_sha: pr.head.sha,
      status: 'completed',
      conclusion,
      completed_at: new Date(),
      output,
      actions
    }))

    log.info(`💾${logStatus} ${shortUrl}`)
  } catch (err) {
    context.log.error(err)
  }
}

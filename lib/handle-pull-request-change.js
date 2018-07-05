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

    // 2. if status did not change then don’t create a new check run. Quotas for
    //    mutations are more restrictive so we want to avoid them if possible
    const currentStatus = await getCurrentStatus(context)
    const hasChange = currentStatus.wip !== newStatus.wip || newStatus.override !== currentStatus.override
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

    // 3. Create check run
    const status = newStatus.wip ? 'in_progress' : 'completed'
    const conclusion = newStatus.wip ? undefined : 'success'
    const completedAt = status === 'completed' ? new Date() : undefined

    const output = {
      title: newStatus.wip ? 'Work in progress' : 'Ready for review',
      summary: newStatus.wip
        ? `The ${locationLabel[newStatus.location]} "${newStatus.text}" contains "${newStatus.match}".`
        : `No match found based on configuration`,
      text: plan === 'free'
        ? `By default, WIP only checks the pull request title for the terms "WIP", "Work in progress" and "🚧".

You can configure both the terms and the location that the WIP app will look for by signing up for the pro plan: https://github.com/marketplace/wip.
All revenue will be donated to [Rails Girls Summer of Code](https://railsgirlssummerofcode.org/).`
        : newStatus.config
          ? `The following configuration from \`.github/wip.yml\` was applied:

\`\`\`yaml
${newStatus.config}
\`\`\``
          : `\`.github/wip.yml\` does not exist, the default configuration is applied:

\`\`\`yaml
terms:
  - wip
  - work in progress
  - 🚧
locations: title
\`\`\`

Read more about [WIP configuration](#tbd)`
    }
    const actions = []

    if (plan === 'pro' && newStatus.wip) {
      output.summary += '\n\nYou can override the status by adding "@wip ready for review" to the end of the pull request description.'
      actions.push({
        label: '✅ Ready for review',
        description: 'override status to "success"',
        identifier: `override:${pr.number}`
      })
    }

    if (newStatus.override) {
      output.title += ' (override)'
      output.summary = 'The status has been set to success by adding `@wip ready for review` to the pull request comment. You can reset the status by removing it.'
      output.details = 'Learn more about [WIP override](#tbd)'
      actions.push({
        label: '🔄 Reset',
        description: 'Remove status override',
        identifier: `reset:${pr.number}`
      })
    }

    await context.github.checks.create(context.repo({
      name: 'WIP (beta)',
      head_branch: '', // workaround for https://github.com/octokit/rest.js/issues/874
      head_sha: pr.head.sha,
      status,
      completed_at: completedAt,
      conclusion,
      output,
      actions
    }))

    log.info(`💾${logStatus} ${shortUrl}`)
  } catch (error) {
    context.log.error(error)
  }
}

module.exports = setStatusPro

const getAppConfig = require('../app-config')

const locationLabel = {
  title: 'title',
  label_name: 'label',
  commit_subject: 'commit subject'
}

function setStatusPro (newStatus, context) {
  const pullRequest = context.payload.pull_request
  const { name } = getAppConfig()

  const checkOptions = {
    name: name,
    status: 'in_progress',
    head_branch: '', // workaround for https://github.com/octokit/rest.js/issues/874
    head_sha: pullRequest.head.sha,
    output: {
      title: 'Work in progress',
      summary: `The ${locationLabel[newStatus.location]} "${newStatus.text}" contains "${newStatus.match}".

  You can override the status by adding "@wip ready for review" to the end of the [pull request description](${pullRequest.html_url}#discussion_bucket).`,
      text: `\`.github/wip.yml\` does not exist, the default configuration is applied:

\`\`\`yaml
terms:
- wip
- work in progress
- 🚧
locations: title
\`\`\`

Read more about [WIP configuration](#tbd)`
    },
    actions: [{
      label: '✅ Ready for review',
      description: 'override status to "success"',
      identifier: `override:${pullRequest.number}`
    }]
  }

  if (!newStatus.wip) {
    checkOptions.status = 'completed'
    checkOptions.conclusion = 'success'
    checkOptions.completed_at = new Date()
    checkOptions.output.title = 'Ready for review'
    checkOptions.output.summary = 'No match found based on configuration.'
    checkOptions.actions = []
  }

  if (newStatus.config) {
    checkOptions.output.text = `The following configuration from \`.github/wip.yml\` was applied:

\`\`\`yaml
${newStatus.config}
\`\`\``
  }

  if (newStatus.override) {
    checkOptions.output.title += ' (override)'
    checkOptions.output.summary = 'The status has been set to success by adding `@wip ready for review` to the pull request comment. You can reset the status by removing it.'
    checkOptions.output.text = 'Learn more about [WIP override](#tbd)'
    checkOptions.actions.push({
      label: '🔄 Reset',
      description: 'Remove status override',
      identifier: `reset:${pullRequest.number}`
    })
  }

  return context.github.checks.create(context.repo(checkOptions))
}

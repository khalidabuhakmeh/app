module.exports = getCurrentStatus

async function getCurrentStatus (context) {
  const {data: {statuses}} = await context.github.repos.getCombinedStatusForRef(context.repo({
    ref: context.payload.pull_request.head.sha
  }))

  return (statuses.find(status => status.context === 'WIP (beta)') || {}).state
}

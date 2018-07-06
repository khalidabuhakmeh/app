module.exports = handleRequestedAction

const getConfig = require('./app-config')

// add or remove "@wip ready for review" to/from the pull request description
// based on the requested action: "override" or "reset"
async function handleRequestedAction (app, context) {
  const {action, repository: repo} = context.payload
  const [requestedAction, prNumber] = context.payload.requested_action.identifier.split(':')
  const shortUrl = `${repo.full_name}#${prNumber}`
  const log = context.log.child({
    name: getConfig().name,
    event: context.event.event,
    action,
    requested: requestedAction,
    account: repo.owner.id,
    repo: repo.id,
    private: repo.private
  })

  try {
    const {data: {body}} = await context.github.pullRequests.get(context.repo({
      number: prNumber
    }))

    if (requestedAction === 'override') {
      await context.github.pullRequests.update(context.repo({
        number: prNumber,
        body: body.trim() ? `${body.trim()}\n\n@wip ready for review` : '@wip ready for review'
      }))
      return log.info(`🙈 ${shortUrl}`)
    }

    await context.github.pullRequests.update(context.repo({
      number: prNumber,
      body: body.replace(/\s*@wip ready for review[!,.]?\s*/, '')
    }))
    return log.info(`🙉 ${shortUrl}`)
  } catch (error) {
    context.log.error(error)
  }
}

module.exports = handleRequestedAction

// add or remove "@wip ready for review" to the pull request description
// based on the requested action: "override" or "reset"
async function handleRequestedAction (app, context) {
  const accountId = context.payload.repository.owner.id
  const [action, pullRequestNumber] = context.payload.requested_action.identifier.split(':')
  const state = {
    accountId,
    action
  }

  try {
    const {data: {title, body, html_url: url}} = await context.github.pullRequests.get(context.repo({
      number: pullRequestNumber
    }))
    state.title = title
    state.body = body.trim()
    state.url = url

    if (action === 'override') {
      await context.github.pullRequests.update(context.repo({
        number: pullRequestNumber,
        body: body ? `${body}\n\n@wip ready for review` : '@wip ready for review'
      }))
      return context.log.info(state)
    }

    await context.github.pullRequests.update(context.repo({
      number: pullRequestNumber,
      body: body.replace(/\s*@wip ready for review[!,.]?\s*/, '')
    }))
    context.log.info(state)
  } catch (error) {
    context.log.error({...state, error: error.toString()})
  }
}

module.exports = wip

const sendLogs = require('./lib/send-logs')
const handlePullRequestChange = require('./lib/handle-pull-request-change')
const handleRequestedAction = require('./lib/handle-requested-action')

function wip (app) {
  app.on([
    'pull_request.opened',
    'pull_request.edited',
    'pull_request.labeled',
    'pull_request.unlabeled',
    'pull_request.synchronize'
  ], handlePullRequestChange.bind(null, app))

  app.on('check_run.requested_action', handleRequestedAction.bind(null, app))

  sendLogs(app)
}

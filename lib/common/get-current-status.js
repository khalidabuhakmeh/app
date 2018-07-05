module.exports = getCurrentStatus

const getAppConfig = require('../app-config')

async function getCurrentStatus (context) {
  const appConfig = getAppConfig()
  const {data: {check_runs: checkRuns}} = await context.github.checks.listForRef(context.repo({
    ref: context.payload.pull_request.head.sha,
    check_name: appConfig.name
  }))

  if (checkRuns.length === 0) {
    return {}
  }

  const [{conclusion, output}] = checkRuns

  return {
    wip: conclusion !== 'success',
    override: output && /override/.test(output.title)
  }
}

module.exports = getCurrentStatus

async function getCurrentStatus (context) {
  const {data: {check_runs: [{conclusion, output} = {}]}} = await context.github.checks.listForRef(context.repo({
    ref: context.payload.pull_request.head.sha,
    check_name: 'WIP (beta)'
  }))

  return {
    wip: conclusion !== 'success',
    override: output && /override/.test(output.title)
  }
}

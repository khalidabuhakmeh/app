module.exports = getStatusPro

const normalizeConfig = require('./normalize-config')

async function getStatusPro (context) {
  const {pull_request: pr} = context.payload
  const labelNames = pr.labels.map(label => label.name)

  const config = normalizeConfig(await context.config('wip.yml'))

  const state = {
    isWip: false,
    commitSubjects: []
  }

  for (var i = 0; i < config.length; i++) {
    const termsContainWIP = containsWIP.bind(null, config[i].terms)
    const titleIsWip = config[i].locations.includes('title') && termsContainWIP(pr.title)
    const labelIsWip = config[i].locations.includes('label_name') && labelNames.some(termsContainWIP)
    const commitIsWip = config[i].locations.includes('commit_subject') && (await getCommitSubjects(state, context)).some(termsContainWIP)

    if (titleIsWip || labelIsWip || commitIsWip) {
      state.isWip = true
    }
  }

  return state.isWip ? 'pending' : 'success'
}

async function getCommitSubjects (state, context) {
  if (state.commitSubjects.length) {
    return state.commitSubjects
  }

  const commits = await context.github.pullRequests.getCommits(context.repo({
    number: context.payload.pull_request.number
  }))

  state.commitSubjects = commits.data.map(element => element.commit.message.split('\n')[0])

  return state.commitSubjects
}

const containsWIP = (terms, string) => {
  // \b word boundaries don’t work around emoji, e.g.
  //   > /\b🚧/i.test('🚧')
  //   < false
  // but
  //   > /(^|[^\w])🚧/i.test('🚧')
  //   < true
  //   > /(^|[^\w])🚧/i.test('foo🚧')
  //   < false
  //   > /(^|[^\w])🚧/i.test('foo 🚧')
  //   < true
  return new RegExp(`(^|[^\\w])(${terms.join('|')})([^\\w]|$)`, 'i').test(string)
}

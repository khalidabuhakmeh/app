module.exports = getStatusPro

const getConfig = require('./get-config')

async function getStatusPro (context) {
  const {pull_request: pr} = context.payload
  const labelNames = pr.labels.map(label => label.name)
  const body = pr.body

  if (/@wip ready for review/i.test(body)) {
    return {
      wip: false,
      override: true
    }
  }

  const {config, rawConfig} = await getConfig(context)

  const state = {
    commitSubjects: []
  }

  for (var i = 0; i < config.length; i++) {
    const matchText = matchTerms.bind(null, config[i].terms, config[i].locations)
    const titleMatch = matchText('title', pr.title)
    const [labelMatch] = labelNames.map(matchText.bind(null, 'label_name')).filter(Boolean)
    const [commitMatch] = (await getCommitSubjects(state, context)).map(matchText.bind(null, 'commit_subject')).filter(Boolean)
    const match = titleMatch || labelMatch || commitMatch

    if (match) {
      return {
        wip: true,
        config: rawConfig,
        ...match
      }
    }
  }

  return {
    wip: false,
    config: rawConfig
  }
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

const matchTerms = (terms, locations, location, text) => {
  if (!locations.includes(location)) {
    return null
  }

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
  const matches = text.match(new RegExp(`(^|[^\\w])(${terms.join('|')})([^\\w]|$)`, 'i'))
  return matches ? {
    location,
    text,
    match: matches[2]
  } : null
}

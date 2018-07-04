const lolex = require('lolex')
const {Application} = require('probot')
const simple = require('simple-mock')
const {beforeEach, test} = require('tap')

const plugin = require('../../')
const NOT_FOUND_ERROR = new Error('Not found')
NOT_FOUND_ERROR.code = 404
const NOW = new Date(0)

beforeEach(function (done) {
  lolex.install()
  this.app = new Application()
  this.githubMock = {
    apps: {
      checkMarketplaceListingAccount: simple.mock().resolveWith({
        data: {
          marketplace_purchase: {
            plan: {
              price_model: 'FLAT_RATE'
            }
          }
        }
      })
    },
    checks: {
      create: simple.mock(),
      listForRef: simple.mock()
    },
    repos: {
      getContent: simple.mock()
    },
    pullRequests: {
      getCommits: simple.mock().resolveWith({data: []})
    }
  }
  this.app.auth = () => Promise.resolve(this.githubMock)
  this.logMock = simple.mock()
  this.logMock.info = simple.mock()
  this.logMock.error = simple.mock().callFn(console.log)
  this.logMock.child = simple.mock().returnWith(this.logMock)
  this.app.log = this.logMock
  this.app.load(plugin)
  done()
})

test('new pull request with "Test" title', async function (t) {
  // no configuration
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)

  // no existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))

  // check for current status
  t.is(this.githubMock.checks.listForRef.callCount, 1)
  t.deepEqual(this.githubMock.checks.listForRef.lastCall.arg, {
    check_name: 'WIP (beta)',
    owner: 'wip',
    repo: 'app',
    ref: 'sha123'
  })

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(this.githubMock.checks.create.callCount, 1)
  t.is(createCheckParams.owner, 'wip')
  t.is(createCheckParams.repo, 'app')
  t.is(createCheckParams.name, 'WIP (beta)')
  t.is(createCheckParams.status, 'completed')
  t.same(createCheckParams.completed_at, NOW)
  t.is(createCheckParams.conclusion, 'success')
  t.is(createCheckParams.output.title, 'Ready for review')
  t.match(createCheckParams.output.summary, /No match found based on configuration/)
  t.match(createCheckParams.output.text, /`.github\/wip.yml` does not exist, the default configuration is applied/)
  t.deepEqual(createCheckParams.actions, [])

  // check resulting logs
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    plan: 'pro',
    status: {
      wip: false,
      changed: true,
      config: null
    },
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })

  t.end()
})

test('new pull request with "[WIP] Test" title', async function (t) {
  // no configuration
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)

  // no existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-wip-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.conclusion, 'action_required')
  t.deepEqual(createCheckParams.actions, [{
    label: '✅ Ready for review',
    description: 'override status to "success"',
    identifier: 'override:1'
  }])
  t.is(createCheckParams.output.title, 'Work in progress')
  t.match(createCheckParams.output.summary, /The title "\[WIP\] Test" contains "WIP"/)
  t.match(createCheckParams.output.summary, /You can override the status by adding "@wip ready for review"/)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, true)
  t.is(logParams.status.changed, true)
  t.is(logParams.status.location, 'title')
  t.is(logParams.status.match, 'WIP')
  t.is(logParams.status.text, '[WIP] Test')

  t.end()
})

test('pending pull request with "Test" title', async function (t) {
  // no configuration
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)

  // simulate existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: [{
        conclusion: 'action_required'
      }]
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.conclusion, 'success')

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, false)
  t.is(logParams.status.changed, true)

  t.end()
})

test('ready pull request with "[WIP] Test" title', async function (t) {
  // no configuration
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)

  // simulate existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: [{
        conclusion: 'success'
      }]
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-wip-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.conclusion, 'action_required')

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, true)
  t.is(logParams.status.changed, true)

  t.end()
})

test('pending pull request with "[WIP] Test" title', async function (t) {
  // no configuration
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)

  // simulate existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: [{
        conclusion: 'action_required'
      }]
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-wip-title.json'))

  // does not create new check run
  t.is(this.githubMock.checks.create.callCount, 0)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, true)
  t.is(logParams.status.changed, false)

  t.end()
})

test('ready pull request with "Test" title', async function (t) {
  // no configuration
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)

  // simulate existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: [{
        conclusion: 'success'
      }]
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))

  // does not create new check run
  t.is(this.githubMock.checks.create.callCount, 0)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, false)
  t.is(logParams.status.changed, false)

  t.end()
})

test('custom term: 🚧', async function (t) {
  // custom configuration
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from('terms: 🚧').toString('base64')
    }
  })

  // no existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-emoji-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(this.githubMock.checks.create.callCount, 1)
  t.is(createCheckParams.owner, 'wip')
  t.is(createCheckParams.repo, 'app')
  t.is(createCheckParams.name, 'WIP (beta)')
  t.is(createCheckParams.status, 'completed')
  t.same(createCheckParams.completed_at, NOW)
  t.is(createCheckParams.conclusion, 'action_required')
  t.is(createCheckParams.output.title, 'Work in progress')
  t.match(createCheckParams.output.summary, /The title "🚧 Test" contains "🚧"/)
  t.match(createCheckParams.output.summary, /You can override the status by adding "@wip ready for review"/)
  t.match(createCheckParams.output.text, /terms: 🚧/)
  t.deepEqual(createCheckParams.actions, [{
    description: 'override status to "success"',
    identifier: 'override:1',
    label: '✅ Ready for review'
  }])

  // check resulting logs
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    plan: 'pro',
    status: {
      wip: true,
      changed: true,
      config: 'terms: 🚧',
      location: 'title',
      match: '🚧',
      text: '🚧 Test'
    },
    title: '🚧 Test',
    url: 'https://github.com/wip/app/issues/1'
  })

  t.end()
})

test('custom location: label_name', async function (t) {
  // custom configuration
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from('locations: label_name').toString('base64')
    }
  })

  // no existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-wip-label.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.conclusion, 'action_required')
  t.match(createCheckParams.output.summary, /The label "WIP" contains "WIP"/)
  t.match(createCheckParams.output.summary, /You can override the status by adding "@wip ready for review"/)
  t.match(createCheckParams.output.text, /locations: label_name/)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.deepEqual(logParams.status.config, 'locations: label_name')
  t.deepEqual(logParams.status.location, 'label_name')
  t.deepEqual(logParams.status.match, 'WIP')
  t.deepEqual(logParams.status.text, 'WIP')

  t.end()
})

test('custom location: commits', async function (t) {
  // custom configuration
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from('locations: commit_subject').toString('base64')
    }
  })

  // no existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })

  // commit with "WIP: test" subject
  this.githubMock.pullRequests.getCommits = simple.mock().resolveWith({
    data: [{
      commit: {
        message: 'WIP: test'
      }
    }]
  })

  await this.app.receive(require('./events/new-pull-request-with-wip-label.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.conclusion, 'action_required')
  t.match(createCheckParams.output.summary, /The commit subject "WIP: test" contains "WIP"/)
  t.match(createCheckParams.output.summary, /You can override the status by adding "@wip ready for review"/)
  t.match(createCheckParams.output.text, /locations: commit_subject/)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.deepEqual(logParams.status.config, 'locations: commit_subject')
  t.deepEqual(logParams.status.location, 'commit_subject')
  t.deepEqual(logParams.status.match, 'WIP')
  t.deepEqual(logParams.status.text, 'WIP: test')

  t.end()
})

test('complex config', async function (t) {
  // custom configuration
  const config = `
- terms:
  - 🚧
  - WIP
  locations:
  - title
  - label_name
- terms:
  - fixup!
  - squash!
  locations: commit_subject`
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from(config).toString('base64')
    }
  })

  // no existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })

  // commits
  this.githubMock.pullRequests.getCommits = simple.mock().resolveWith({
    data: [{
      commit: {
        message: 'fixup! test'
      }
    }, {
      commit: {
        message: 'test'
      }
    }]
  })

  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.conclusion, 'action_required')
  t.match(createCheckParams.output.summary, /The commit subject "fixup! test" contains "fixup!"/)
  t.match(createCheckParams.output.summary, /You can override the status by adding "@wip ready for review"/)
  t.match(createCheckParams.output.text, /locations: commit_subject/)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.deepEqual(logParams.status.config, config)
  t.deepEqual(logParams.status.location, 'commit_subject')
  t.deepEqual(logParams.status.match, 'fixup!')
  t.deepEqual(logParams.status.text, 'fixup! test')

  t.end()
})

test('loads commits once only', async function (t) {
  // custom configuration
  const config = `
- terms: 'foo'
  locations: commit_subject
- terms: 'bar'
  locations: commit_subject`
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from(config).toString('base64')
    }
  })

  // no existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })

  // commits
  this.githubMock.pullRequests.getCommits = simple.mock().resolveWith({
    data: [{
      commit: {
        message: 'test'
      }
    }]
  })

  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))

  t.is(this.githubMock.pullRequests.getCommits.callCount, 1)

  t.end()
})

test('override', async function (t) {
  // no configuration
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)

  // no existing check runs
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-wip-title-and-override.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.conclusion, 'success')
  t.deepEqual(createCheckParams.actions, [{
    label: '🔄 Reset',
    description: 'Remove status override',
    identifier: 'reset:1'
  }])
  t.is(createCheckParams.output.title, 'Ready for review (override)')
  t.match(createCheckParams.output.summary, /The status has been set to success by adding `@wip ready for review` to the pull request comment/)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, false)
  t.is(logParams.status.override, true)
  t.is(logParams.status.changed, true)

  t.end()
})

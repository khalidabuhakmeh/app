const lolex = require('lolex')
const {Application} = require('probot')
const simple = require('simple-mock')
const {beforeEach, test} = require('tap')

const plugin = require('../../')
const NOT_FOUND_ERROR = new Error('Not found')
NOT_FOUND_ERROR.code = 404
const SERVER_ERROR = new Error('Ooops')
SERVER_ERROR.code = 500
const NOW = new Date(0)

beforeEach(function (done) {
  lolex.install()
  this.app = new Application()
  this.githubMock = {
    apps: {
      checkMarketplaceListingAccount: simple.mock().rejectWith(NOT_FOUND_ERROR)
    },
    checks: {
      create: simple.mock(),
      listForRef: simple.mock().resolveWith({
        data: {
          check_runs: []
        }
      })
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
  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))

  // check for current status
  t.is(this.githubMock.checks.listForRef.callCount, 1)
  t.deepEqual(this.githubMock.checks.listForRef.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    ref: 'sha123',
    check_name: 'WIP (beta)'
  })

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(this.githubMock.checks.create.callCount, 1)
  t.is(createCheckParams.owner, 'wip')
  t.is(createCheckParams.repo, 'app')
  t.is(createCheckParams.name, 'WIP (beta)')
  t.is(createCheckParams.status, 'completed')
  t.same(createCheckParams.completed_at, NOW)
  t.is(createCheckParams.status, 'completed')
  t.is(createCheckParams.conclusion, 'success')
  t.is(createCheckParams.output.title, 'Ready for review')
  t.match(createCheckParams.output.summary, /No match found based on configuration/)
  t.match(createCheckParams.output.text, /WIP only checks the pull request title for the terms "WIP", "Work in progress" and "🚧"/)
  t.match(createCheckParams.output.text, /You can configure both the terms and the location that the WIP app will look for by signing up for the pro plan/)
  t.match(createCheckParams.output.text, /All revenue will be donated/)
  t.is(createCheckParams.actions, undefined)

  // check resulting logs
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    plan: 'free',
    status: {
      wip: false,
      changed: true
    },
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })

  t.end()
})

test('new pull request with "[WIP] Test" title', async function (t) {
  await this.app.receive(require('./events/new-pull-request-with-wip-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.status, 'in_progress')
  t.is(createCheckParams.output.title, 'Work in progress')
  t.match(createCheckParams.output.summary, /The title "\[WIP\] Test" contains "WIP"/)
  t.notMatch(createCheckParams.output.summary, /You can override the status by adding "@wip ready for review"/)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, true)
  t.is(logParams.status.changed, true)
  t.is(logParams.status.location, 'title')
  t.is(logParams.status.match, 'WIP')
  t.is(logParams.status.text, '[WIP] Test')

  t.end()
})

test('new pull request with "[Work in Progress] Test" title', async function (t) {
  await this.app.receive(require('./events/new-pull-request-with-work-in-progress-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.status, 'in_progress')
  t.is(createCheckParams.output.title, 'Work in progress')
  t.match(createCheckParams.output.summary, /The title "\[Work in Progress\] Test" contains "Work in Progress"/)
  t.notMatch(createCheckParams.output.summary, /You can override the status by adding "@wip ready for review"/)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, true)
  t.is(logParams.status.changed, true)
  t.is(logParams.status.location, 'title')
  t.is(logParams.status.match, 'Work in Progress')
  t.is(logParams.status.text, '[Work in Progress] Test')

  t.end()
})

test('new pull request with "🚧 Test" title', async function (t) {
  await this.app.receive(require('./events/new-pull-request-with-emoji-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.status, 'in_progress')
  t.is(createCheckParams.output.title, 'Work in progress')
  t.match(createCheckParams.output.summary, /The title "🚧 Test" contains "🚧"/)
  t.notMatch(createCheckParams.output.summary, /You can override the status by adding "@wip ready for review"/)

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, true)
  t.is(logParams.status.changed, true)
  t.is(logParams.status.location, 'title')
  t.is(logParams.status.match, '🚧')
  t.is(logParams.status.text, '🚧 Test')

  t.end()
})

test('pending pull request with "Test" title', async function (t) {
  // simulate existing check runs
  this.githubMock.checks.listForRef = simple.mock().resolveWith({
    data: {
      check_runs: [{
        status: 'pending'
      }]
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.status, 'completed')
  t.is(createCheckParams.conclusion, 'success')

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, false)
  t.is(logParams.status.changed, true)

  t.end()
})

test('ready pull request with "[WIP] Test" title', async function (t) {
  // simulate existing check runs
  this.githubMock.checks.listForRef = simple.mock().resolveWith({
    data: {
      check_runs: [{
        conclusion: 'success'
      }]
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-wip-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.status, 'in_progress')

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, true)
  t.is(logParams.status.changed, true)

  t.end()
})

test('pending pull request with "[WIP] Test" title', async function (t) {
  // simulate existing check runs
  this.githubMock.checks.listForRef = simple.mock().resolveWith({
    data: {
      check_runs: [{
        status: 'pending'
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
  // simulate existing check runs
  this.githubMock.checks.listForRef = simple.mock().resolveWith({
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

test('active marketplace "free" plan', async function (t) {
  // simulate that user subscribed to free plan
  this.githubMock.apps.checkMarketplaceListingAccount = simple.mock().resolveWith({
    data: {
      marketplace_purchase: {
        plan: {
          price_model: 'FREE'
        }
      }
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))

  // create new check run
  const createCheckParams = this.githubMock.checks.create.lastCall.arg
  t.is(createCheckParams.status, 'completed')
  t.is(createCheckParams.conclusion, 'success')

  // check resulting logs
  const logParams = this.logMock.info.lastCall.arg
  t.is(logParams.status.wip, false)
  t.is(logParams.status.changed, true)

  t.end()
})

test('request error', async function (t) {
  // simulate request error
  this.githubMock.checks.listForRef = simple.mock().rejectWith(SERVER_ERROR)
  this.logMock.error = simple.mock()

  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))

  // does not try to create new check run
  t.is(this.githubMock.checks.create.callCount, 0)

  // check resulting logs
  const logParams = this.logMock.error.lastCall.arg
  t.is(logParams.accountId, 1)
  t.is(logParams.plan, 'free')
  t.is(logParams.status.wip, false)
  t.is(logParams.title, 'Test')
  t.is(logParams.url, 'https://github.com/wip/app/issues/1')
  t.is(logParams.error.code, 500)
  t.is(logParams.error.message, 'Ooops')

  t.end()
})

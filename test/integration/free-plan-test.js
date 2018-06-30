const {Application} = require('probot')
const simple = require('simple-mock')
const {beforeEach, test} = require('tap')

const plugin = require('../../')
const NOT_FOUND_ERROR = new Error('Not found')
NOT_FOUND_ERROR.code = 404
const SERVER_ERROR = new Error('Ooops')
SERVER_ERROR.code = 500

beforeEach(function (done) {
  this.app = new Application()
  this.githubMock = {
    apps: {
      checkMarketplaceListingAccount: simple.mock().rejectWith(NOT_FOUND_ERROR)
    },
    repos: {
      createStatus: simple.mock().resolveWith(),
      getCombinedStatusForRef: simple.mock()
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

test('new pull request with "Test" title', {only: true}, async function (t) {
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: []
    }
  })
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')

  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.repos.getCombinedStatusForRef.callCount, 1)
  t.deepEqual(this.githubMock.repos.getCombinedStatusForRef.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    ref: 'sha123'
  })
  t.is(this.githubMock.repos.createStatus.callCount, 1)
  t.deepEqual(this.githubMock.repos.createStatus.lastCall.arg, {
    context: 'WIP (beta)',
    description: 'ready',
    owner: 'wip',
    repo: 'app',
    sha: 'sha123',
    state: 'success',
    target_url: 'https://github.com/apps/wip'
  })
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    changed: true,
    plan: 'free',
    status: 'success',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('new pull request with "[WIP] Test" title', async function (t) {
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: []
    }
  })
  const newPullRequestWithWipTitle = require('./events/new-pull-request-with-wip-title.json')

  await this.app.receive(newPullRequestWithWipTitle)
  t.is(this.githubMock.repos.getCombinedStatusForRef.callCount, 1)
  t.deepEqual(this.githubMock.repos.getCombinedStatusForRef.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    ref: 'sha123'
  })
  t.is(this.githubMock.repos.createStatus.callCount, 1)
  t.deepEqual(this.githubMock.repos.createStatus.lastCall.arg, {
    context: 'WIP (beta)',
    description: 'work in progress',
    owner: 'wip',
    repo: 'app',
    sha: 'sha123',
    state: 'pending',
    target_url: 'https://github.com/apps/wip'
  })
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    changed: true,
    plan: 'free',
    status: 'pending',
    title: '[WIP] Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('pending pull request with "Test" title', async function (t) {
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: [{
        context: 'WIP (beta)',
        state: 'pending'
      }]
    }
  })

  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.repos.createStatus.callCount, 1)
  t.deepEqual(this.githubMock.repos.createStatus.lastCall.arg, {
    context: 'WIP (beta)',
    description: 'ready',
    owner: 'wip',
    repo: 'app',
    sha: 'sha123',
    state: 'success',
    target_url: 'https://github.com/apps/wip'
  })
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    changed: true,
    plan: 'free',
    status: 'success',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('ready pull request with "[WIP] Test" title', async function (t) {
  const newPullRequestWithWipTitle = require('./events/new-pull-request-with-wip-title.json')
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: [{
        context: 'WIP (beta)',
        state: 'success'
      }]
    }
  })

  await this.app.receive(newPullRequestWithWipTitle)
  t.is(this.githubMock.repos.createStatus.callCount, 1)
  t.deepEqual(this.githubMock.repos.createStatus.lastCall.arg, {
    context: 'WIP (beta)',
    description: 'work in progress',
    owner: 'wip',
    repo: 'app',
    sha: 'sha123',
    state: 'pending',
    target_url: 'https://github.com/apps/wip'
  })
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    changed: true,
    plan: 'free',
    status: 'pending',
    title: '[WIP] Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('pending pull request with "[WIP] Test" title', async function (t) {
  const newPullRequestWithWipTitle = require('./events/new-pull-request-with-wip-title.json')
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: [{
        context: 'WIP (beta)',
        state: 'pending'
      }]
    }
  })

  await this.app.receive(newPullRequestWithWipTitle)
  t.is(this.githubMock.repos.createStatus.callCount, 0)
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    changed: false,
    plan: 'free',
    status: 'pending',
    title: '[WIP] Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('ready pull request with "Test" title', async function (t) {
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: [{
        context: 'WIP (beta)',
        state: 'success'
      }]
    }
  })

  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.repos.createStatus.callCount, 0)
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    changed: false,
    plan: 'free',
    status: 'success',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('request error', async function (t) {
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')
  this.githubMock.repos.getCombinedStatusForRef.rejectWith(SERVER_ERROR)

  this.logMock.error = simple.mock()
  this.logMock.trace = simple.mock()
  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.repos.createStatus.callCount, 0)
  t.is(this.logMock.error.lastCall.arg.accountId, 1)
  t.is(this.logMock.error.lastCall.arg.plan, 'free')
  t.is(this.logMock.error.lastCall.arg.status, 'success')
  t.is(this.logMock.error.lastCall.arg.title, 'Test')
  t.is(this.logMock.error.lastCall.arg.url, 'https://github.com/wip/app/issues/1')
  t.is(this.logMock.error.lastCall.arg.error.code, 500)
  t.end()
})

test('active marketplace "free" plan', async function (t) {
  this.githubMock.apps.checkMarketplaceListingAccount = simple.mock().resolveWith({
    data: {
      marketplace_purchase: {
        plan: {
          price_model: 'FREE'
        }
      }
    }
  })
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: []
    }
  })
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')

  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.repos.createStatus.callCount, 1)
  t.deepEqual(this.githubMock.repos.createStatus.lastCall.arg, {
    context: 'WIP (beta)',
    description: 'ready',
    owner: 'wip',
    repo: 'app',
    sha: 'sha123',
    state: 'success',
    target_url: 'https://github.com/apps/wip'
  })
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    changed: true,
    plan: 'free',
    status: 'success',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

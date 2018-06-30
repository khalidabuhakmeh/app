const {Application} = require('probot')
const simple = require('simple-mock')
const {beforeEach, test} = require('tap')

const plugin = require('../../')
const NOT_FOUND_ERROR = new Error('Not found')
NOT_FOUND_ERROR.code = 404

beforeEach(function (done) {
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
    repos: {
      createStatus: simple.mock().resolveWith(),
      getCombinedStatusForRef: simple.mock(),
      getContent: simple.mock()
    },
    pullRequests: {
      getCommits: simple.mock()
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
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)
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
    plan: 'pro',
    status: 'success',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('new pull request with "[WIP] Test" title', async function (t) {
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)
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
    plan: 'pro',
    status: 'pending',
    title: '[WIP] Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('pending pull request with "Test" title', async function (t) {
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)
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
    plan: 'pro',
    status: 'success',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('ready pull request with "[WIP] Test" title', async function (t) {
  const newPullRequestWithWipTitle = require('./events/new-pull-request-with-wip-title.json')
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)
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
    plan: 'pro',
    status: 'pending',
    title: '[WIP] Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('pending pull request with "[WIP] Test" title', async function (t) {
  const newPullRequestWithWipTitle = require('./events/new-pull-request-with-wip-title.json')
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)
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
    plan: 'pro',
    status: 'pending',
    title: '[WIP] Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('ready pull request with "Test" title', async function (t) {
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')
  this.githubMock.repos.getContent.rejectWith(NOT_FOUND_ERROR)
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
    plan: 'pro',
    status: 'success',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('custom term: 🚧', async function (t) {
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from('terms: 🚧').toString('base64')
    }
  })
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: []
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-emoji-title.json'))
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
    plan: 'pro',
    status: 'pending',
    title: '🚧 Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('custom location: label_name', async function (t) {
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from('locations: label_name').toString('base64')
    }
  })
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: []
    }
  })

  await this.app.receive(require('./events/new-pull-request-with-wip-label.json'))
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
    plan: 'pro',
    status: 'pending',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('custom location: commits', async function (t) {
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from('locations: commit_subject').toString('base64')
    }
  })
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: []
    }
  })
  this.githubMock.pullRequests.getCommits.resolveWith({
    data: [{
      commit: {
        message: 'WIP: test'
      }
    }]
  })

  await this.app.receive(require('./events/new-pull-request-with-wip-label.json'))
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
    plan: 'pro',
    status: 'pending',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('complex config', async function (t) {
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from(`
- terms:
    - 🚧
    - WIP
  locations:
    - title
    - label_name
- terms:
    - fixup!
    - squash!
  locations: commit_subject`).toString('base64')
    }
  })
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: []
    }
  })
  this.githubMock.pullRequests.getCommits.resolveWith({
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
    plan: 'pro',
    status: 'pending',
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('loads commits once only', async function (t) {
  this.githubMock.repos.getContent.resolveWith({
    data: {
      content: Buffer.from(`
- terms: 'foo'
  locations: commit_subject
- terms: 'bar'
  locations: commit_subject`).toString('base64')
    }
  })
  this.githubMock.repos.getCombinedStatusForRef.resolveWith({
    data: {
      statuses: []
    }
  })
  this.githubMock.pullRequests.getCommits.resolveWith({
    data: [{
      commit: {
        message: 'WIP: test'
      }
    }]
  })

  await this.app.receive(require('./events/new-pull-request-with-test-title.json'))
  t.is(this.githubMock.pullRequests.getCommits.callCount, 1)
  t.end()
})

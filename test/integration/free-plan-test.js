const {Application} = require('probot')
const lolex = require('lolex')
const simple = require('simple-mock')
const {beforeEach, test} = require('tap')

const plugin = require('../../')
const NOT_FOUND_ERROR = new Error('Not found')
NOT_FOUND_ERROR.code = 404
const SERVER_ERROR = new Error('Ooops')
SERVER_ERROR.code = 500

beforeEach(function (done) {
  lolex.install()
  this.app = new Application()
  this.githubMock = {
    apps: {
      checkMarketplaceListingAccount: simple.mock().rejectWith(NOT_FOUND_ERROR)
    },
    checks: {
      create: simple.mock(),
      listForRef: simple.mock()
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
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')

  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.checks.listForRef.callCount, 1)
  t.deepEqual(this.githubMock.checks.listForRef.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    ref: 'sha123',
    check_name: 'WIP (beta)'
  })
  t.is(this.githubMock.checks.create.callCount, 1)
  t.deepEqual(this.githubMock.checks.create.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    name: 'WIP (beta)',
    head_branch: '',
    head_sha: 'sha123',
    status: 'completed',
    completed_at: new Date(),
    conclusion: 'success',
    output: {
      title: 'Ready for review',
      summary: 'No match found based on configuration',
      text: 'By default, WIP only checks the pull request title for the terms "WIP", "Work in progress" and "🚧".\n\nYou can configure both the terms and the location that the WIP app will look for by signing up for the pro plan: https://github.com/marketplace/wip.\nAll revenue will be donated to [Rails Girls Summer of Code](https://railsgirlssummerofcode.org/).'
    },
    actions: []
  })
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
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })
  const newPullRequestWithWipTitle = require('./events/new-pull-request-with-wip-title.json')

  await this.app.receive(newPullRequestWithWipTitle)
  t.is(this.githubMock.checks.listForRef.callCount, 1)
  t.deepEqual(this.githubMock.checks.listForRef.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    ref: 'sha123',
    check_name: 'WIP (beta)'
  })
  t.is(this.githubMock.checks.create.callCount, 1)
  t.deepEqual(this.githubMock.checks.create.lastCall.arg, { owner: 'wip',
    repo: 'app',
    name: 'WIP (beta)',
    head_branch: '',
    head_sha: 'sha123',
    status: 'completed',
    completed_at: new Date(),
    conclusion: 'action_required',
    output: {
      title: 'Work in progress',
      summary: 'The title "[WIP] Test" contains "WIP".\n\nYou can override the status by adding "@wip ready for review" to the end of the pull request description',
      text: 'By default, WIP only checks the pull request title for the terms "WIP", "Work in progress" and "🚧".\n\nYou can configure both the terms and the location that the WIP app will look for by signing up for the pro plan: https://github.com/marketplace/wip.\nAll revenue will be donated to [Rails Girls Summer of Code](https://railsgirlssummerofcode.org/).'
    },
    actions: [{
      label: '✅ Ready for review',
      description: 'override status to "success"',
      identifier: 'override:1'
    }]
  })
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    plan: 'free',
    status: {
      wip: true,
      changed: true,
      location: 'title',
      match: 'WIP',
      text: '[WIP] Test'
    },
    title: '[WIP] Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('pending pull request with "Test" title', async function (t) {
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: [{
        conclusion: 'action_required'
      }]
    }
  })

  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.checks.create.callCount, 1)
  t.deepEqual(this.githubMock.checks.create.lastCall.arg, { owner: 'wip',
    repo: 'app',
    name: 'WIP (beta)',
    head_branch: '',
    head_sha: 'sha123',
    status: 'completed',
    completed_at: new Date(),
    conclusion: 'success',
    output: {
      title: 'Ready for review',
      summary: 'No match found based on configuration',
      text: 'By default, WIP only checks the pull request title for the terms "WIP", "Work in progress" and "🚧".\n\nYou can configure both the terms and the location that the WIP app will look for by signing up for the pro plan: https://github.com/marketplace/wip.\nAll revenue will be donated to [Rails Girls Summer of Code](https://railsgirlssummerofcode.org/).'
    },
    actions: []
  })
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    plan: 'free',
    status: {
      changed: true,
      wip: false
    },
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('ready pull request with "[WIP] Test" title', async function (t) {
  const newPullRequestWithWipTitle = require('./events/new-pull-request-with-wip-title.json')
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: [{
        conclusion: 'success'
      }]
    }
  })

  await this.app.receive(newPullRequestWithWipTitle)
  t.is(this.githubMock.checks.create.callCount, 1)
  t.deepEqual(this.githubMock.checks.create.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    name: 'WIP (beta)',
    head_branch: '',
    head_sha: 'sha123',
    status: 'completed',
    completed_at: new Date(),
    conclusion: 'action_required',
    output: {
      title: 'Work in progress',
      summary: 'The title "[WIP] Test" contains "WIP".\n\nYou can override the status by adding "@wip ready for review" to the end of the pull request description',
      text: 'By default, WIP only checks the pull request title for the terms "WIP", "Work in progress" and "🚧".\n\nYou can configure both the terms and the location that the WIP app will look for by signing up for the pro plan: https://github.com/marketplace/wip.\nAll revenue will be donated to [Rails Girls Summer of Code](https://railsgirlssummerofcode.org/).'
    },
    actions: [{
      label: '✅ Ready for review',
      description: 'override status to "success"',
      identifier: 'override:1'
    }]
  })
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    plan: 'free',
    status: {
      changed: true,
      location: 'title',
      match: 'WIP',
      text: '[WIP] Test',
      wip: true
    },
    title: '[WIP] Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('pending pull request with "[WIP] Test" title', async function (t) {
  const newPullRequestWithWipTitle = require('./events/new-pull-request-with-wip-title.json')
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: [{
        conclusion: 'action_required'
      }]
    }
  })

  await this.app.receive(newPullRequestWithWipTitle)
  t.is(this.githubMock.checks.create.callCount, 0)
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    plan: 'free',
    status: {
      changed: false,
      location: 'title',
      match: 'WIP',
      text: '[WIP] Test',
      wip: true
    },
    title: '[WIP] Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('ready pull request with "Test" title', async function (t) {
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: [{
        conclusion: 'success'
      }]
    }
  })

  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.checks.create.callCount, 0)
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    plan: 'free',
    status: {
      changed: false,
      wip: false
    },
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

test('request error', async function (t) {
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')
  this.githubMock.checks.listForRef.rejectWith(SERVER_ERROR)

  this.logMock.error = simple.mock()
  this.logMock.trace = simple.mock()
  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.checks.create.callCount, 0)
  t.is(this.logMock.error.lastCall.arg.accountId, 1)
  t.is(this.logMock.error.lastCall.arg.plan, 'free')
  t.is(this.logMock.error.lastCall.arg.status.wip, false)
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
  this.githubMock.checks.listForRef.resolveWith({
    data: {
      check_runs: []
    }
  })
  const newPullRequestWithTestTitle = require('./events/new-pull-request-with-test-title.json')

  await this.app.receive(newPullRequestWithTestTitle)
  t.is(this.githubMock.checks.create.callCount, 1)

  t.deepEqual(this.githubMock.checks.create.lastCall.arg, { owner: 'wip',
    repo: 'app',
    name: 'WIP (beta)',
    head_branch: '',
    head_sha: 'sha123',
    status: 'completed',
    completed_at: new Date(),
    conclusion: 'success',
    output: {
      title: 'Ready for review',
      summary: 'No match found based on configuration',
      text: 'By default, WIP only checks the pull request title for the terms "WIP", "Work in progress" and "🚧".\n\nYou can configure both the terms and the location that the WIP app will look for by signing up for the pro plan: https://github.com/marketplace/wip.\nAll revenue will be donated to [Rails Girls Summer of Code](https://railsgirlssummerofcode.org/).'
    },
    actions: []
  })
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    plan: 'free',
    status: {
      changed: true,
      wip: false
    },
    title: 'Test',
    url: 'https://github.com/wip/app/issues/1'
  })
  t.end()
})

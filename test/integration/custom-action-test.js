const lolex = require('lolex')
const {Application} = require('probot')
const simple = require('simple-mock')
const {beforeEach, test} = require('tap')

const plugin = require('../../')

const SERVER_ERROR = new Error('Ooops')
SERVER_ERROR.code = 500

beforeEach(function (done) {
  lolex.install()
  this.app = new Application()
  this.githubMock = {
    pullRequests: {
      get: simple.mock().resolveWith({
        data: {
          title: '[WIP] test',
          body: 'foo bar',
          html_url: 'https://github.com/wip/app/issues/1'
        }
      }),
      update: simple.mock().resolveWith({})
    }
  }
  this.app.auth = () => Promise.resolve(this.githubMock)
  this.logMock = simple.mock()
  this.logMock.debug = simple.mock()
  this.logMock.info = simple.mock()
  this.logMock.error = simple.mock().callFn(console.log)
  this.logMock.child = simple.mock().returnWith(this.logMock)
  this.app.log = this.logMock
  this.app.load(plugin)
  done()
})

test('"override" action', async function (t) {
  await this.app.receive(require('./events/requested-action-override.json'))

  // get current pull request
  t.is(this.githubMock.pullRequests.get.callCount, 1)
  t.deepEqual(this.githubMock.pullRequests.get.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    number: '1'
  })

  // update pull request
  t.is(this.githubMock.pullRequests.update.callCount, 1)
  t.deepEqual(this.githubMock.pullRequests.update.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    number: '1',
    body: 'foo bar\n\n@wip ready for review'
  })

  // check resulting logs
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    action: 'override',
    title: '[WIP] test',
    url: 'https://github.com/wip/app/issues/1'
  })

  t.end()
})

test('"override" action (pull request without body)', async function (t) {
  this.githubMock.pullRequests.get = simple.mock().resolveWith({
    data: {
      title: '[WIP] test',
      body: '',
      html_url: 'https://github.com/wip/app/issues/1'
    }
  })

  await this.app.receive(require('./events/requested-action-override.json'))

  // get current pull request
  t.is(this.githubMock.pullRequests.get.callCount, 1)
  t.deepEqual(this.githubMock.pullRequests.get.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    number: '1'
  })

  // update pull request
  t.is(this.githubMock.pullRequests.update.callCount, 1)
  t.deepEqual(this.githubMock.pullRequests.update.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    number: '1',
    body: '@wip ready for review'
  })

  // check resulting logs
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    action: 'override',
    title: '[WIP] test',
    url: 'https://github.com/wip/app/issues/1'
  })

  t.end()
})

test('"reset" action', async function (t) {
  await this.app.receive(require('./events/requested-action-reset.json'))

  // get current pull request
  t.is(this.githubMock.pullRequests.get.callCount, 1)
  t.deepEqual(this.githubMock.pullRequests.get.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    number: '1'
  })

  // update pull request
  t.is(this.githubMock.pullRequests.update.callCount, 1)
  t.deepEqual(this.githubMock.pullRequests.update.lastCall.arg, {
    owner: 'wip',
    repo: 'app',
    number: '1',
    body: 'foo bar'
  })

  // check resulting logs
  t.is(this.logMock.info.callCount, 1)
  t.deepEqual(this.logMock.info.lastCall.arg, {
    accountId: 1,
    action: 'reset',
    title: '[WIP] test',
    url: 'https://github.com/wip/app/issues/1'
  })

  t.end()
})

test('request error', async function (t) {
  // simulate request error
  this.githubMock.pullRequests.get = simple.mock().rejectWith(SERVER_ERROR)
  this.logMock.error = simple.mock()

  await this.app.receive(require('./events/requested-action-override.json'))

  // does not try to update the pull request run
  t.is(this.githubMock.pullRequests.update.callCount, 0)

  // check resulting logs
  t.is(this.logMock.error.callCount, 1)
  const logParams = this.logMock.error.lastCall.arg

  t.is(logParams.accountId, 1)
  t.is(logParams.action, 'override')
  t.is(logParams.error.code, 500)
  t.is(logParams.error.message, 'Ooops')

  t.end()
})

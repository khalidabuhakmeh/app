const {test} = require('tap')

const getPlan = require('../../lib/common/get-plan')

test('throws error if getting current plan fails with error other than 404', async function (t) {
  try {
    await getPlan({
      auth () {
        return {
          apps: {
            checkMarketplaceListingAccount () {
              throw new Error('oops')
            }
          }
        }
      }
    })
    t.fail('should throw error')
  } catch (error) {
    t.is(error.message, 'oops')
  }

  t.end()
})

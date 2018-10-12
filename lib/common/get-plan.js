module.exports = getPlan

// Find out if user as pro plan or not. The request to check the installation
// for the current account (user account_id or organization) needs to be
// authenticated as the app, not installation. If the app has no plan it means
// that it wasn’t installed from the marketplace but from github.com/app/wip.
// We treat it these as "FREE"

async function getPlan (robot, accountId) {
  const authenticatedAsApp = await robot.auth()
  try {
    const {
      data: {
        marketplace_purchase: { plan }
      }
    } = await authenticatedAsApp.apps.checkMarketplaceListingAccount({
      account_id: accountId
    })

    return plan.price_model === 'FREE' ? 'free' : 'pro'
  } catch (error) {
    if (error.code === 404) {
      return 'free'
    }

    throw error
  }
}

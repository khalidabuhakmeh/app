module.exports = getStatusFree

async function getStatusFree (context) {
  const title = context.payload.pull_request.title
  const isPending = /\b(wip|work in progress)\b/i.test(title)
  return isPending ? 'pending' : 'success'
}

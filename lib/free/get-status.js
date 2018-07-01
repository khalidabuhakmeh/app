module.exports = getStatusFree

async function getStatusFree (context) {
  const title = context.payload.pull_request.title
  const [match] = title.match(/\b(wip|work in progress)\b/ig) || []
  if (!match) {
    return {
      wip: false
    }
  }

  return {
    wip: true,
    location: 'title',
    text: title,
    match
  }
}

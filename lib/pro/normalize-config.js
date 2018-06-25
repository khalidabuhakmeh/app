module.exports = normalize

const defaultConfig = require('./default-config')

function normalize (config) {
  if (!config) {
    config = defaultConfig
  }

  // workaround for https://github.com/probot/probot/issues/592
  if ('1' in config) {
    config = Object.keys(config).reduce((array, key) => {
      return array.concat(config[key])
    }, [])
  }

  if (!Array.isArray(config)) {
    config = [config]
  }

  return config.map(config => {
    ['terms', 'locations'].forEach(key => {
      if (!config[key]) {
        config[key] = defaultConfig[key]
      }

      if (!Array.isArray(config[key])) {
        config[key] = [config[key]]
      }

      config[key] = config[key].map(String)
    })

    return config
  })
}

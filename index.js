const pull = require('pull-stream')
const paramap = require('pull-paramap')
const human = require('human-size')
const git = require('./git')
const {getSize} = require('./tirex')

const repo='/home/regular/dev/flytta/sdks/tigitrepo'
const {listVersions} = git(repo)

pull(
  listVersions(),
  /*
  paramap((data, cb)=>{
    const {version} = data
    getSize(version, 'linux', (err, size)=>{
      if (err) return cb(null, data)
      data.size = size
      cb(null, data)
    })
  }, 4),
  */
  pull.drain(({date, version, name, size})=>{
    console.log(date, version, name, size ? human(size, 1) : 'n/a')
  }, err=>{
    if (err) {
      console.error(err.message, err.stack)
      process.exit(1)
    }
  })
)

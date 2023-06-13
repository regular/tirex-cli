const os = require('os')
const pull = require('pull-stream')
//const paramap = require('pull-paramap')
const human = require('human-size')
//const git = require('./git')
const {getPackages, download, entries} = require('.')
const pm = require('picomatch')
const conf = require('rc')('tirex')

//const repo='/home/regular/dev/flytta/sdks/tigitrepo'
//const {listVersions} = git(repo)
if (conf._.length == 3) {
  const [cmd, uid, dest] = conf._
  if (cmd == 'install' || cmd == 'i') {
    install(uid, dest, bail)
  } else usage()
} else if (conf._.length == 2) {
  const [cmd, uid] = conf._
  if (cmd == 'files') {
    files(uid, bail)
  } else usage()
} else if (conf._.length == 1) {
  const [cmd] = conf._
  if (cmd=='list') list()
  else usage()
} else usage()

function install(uid, dest, cb) {
  doRemote((url, cb)=>{
    download(url, dest, {}, cb)
  }, uid, cb)
}

function files(uid, cb) {
  doRemote((url, cb)=>{
    entries(url, (err, directory)=>{
      if (err) return cb(err)
      for(const {type, path, uncompressedSize} of directory.files) {
        const p = path.split('/').slice(1).join('/')
        const t = type[0]
        const s = uncompressedSize
        console.log(t, p, t=='F' ? s : '')
      }
      cb(null)
    })
  }, uid, cb)
}

function doRemote(fn, uid, cb) {
  const match = pm(uid)
  const platform = conf.platform || {win32: 'win', darwin: 'macos', linux: 'linux'}[os.platform]
  if (!platform) return cb(new Error('Unable to detect platform. Use --platform linux|macos|win'))
  let found = false

  pull(
    getPackages(),
    pull.filter(p=>match(p.packagePublicUid)),
    pull.asyncMap( (p, cb)=>{
      console.log()
      console.log(p.packagePublicUid)
      console.error(p.packagePublicUid)
      console.log('===')
      found = true
      const url = p.downloadUrl[platform]
      console.error(url)
      if (!url) {
        console.error('No url found -- ignoring')
        return cb(null)
      }
      fn(url, cb)
    }),
    pull.onEnd(err=>{
      if (err) return cb(err)
      if (!found) return cb(new Error(`Package not found: ${uid}`))
      cb(null)
    })
  )
}

function bail(err) {
  if (!err) return
  console.error(err.message)
  process.exit(1)
}

function usage() {
  console.log(`
  tirex list
  tirex files UID
  tirex download UID DEST
    
  tirex list [--friendly] [--filter_uid PATTERN [ --filter_uid PATTERN ...]]

    list all downloadable packages.
    --friendly    Print friendly names instead of UIDs.
    --filter_uid  can be specified multiple times. If given, only package
      UIDs that math the pattern are printed.

  tirex files UID

    list package contents

    UID may be a glob expression

  tirex install UID DIR

    Install the specified package to directory DIR
    
    UID may be a glob expression
  `)
}

function list() {
  const match = conf.filter_uid ? pm(conf.filter_uid) : ()=>true
  pull(
    getPackages(),
    pull.drain(p=>{
    const {packagePublicUid, packageType, packageVersion, name, dependencies, description} = p
      //console.log(date, version, name, size ? human(size, 1) : 'n/a')
      const displayName = conf.human ? name : packagePublicUid
      if (match(packagePublicUid)) {
        if (conf.json) {
          console.log(JSON.stringify(p, null, 2))
          console.log()
        } else {
          console.log(displayName, packageVersion)
          if (conf.description) {
            console.log(description)
          }
        }
      }
    }, err=>{
      if (err) {
        console.error(err.message, err.stack)
        process.exit(1)
      }
    })
  )
}

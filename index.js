const hq = require('hyperquest')
const request = require('request')
const pull = require('pull-stream')
const defer = require('pull-defer')
const {BufferListStream} = require('bl')
const unzip = require('unzipper')
const Extract = require('./extract')
const once = require('once')


const api_base = 'https://dev.ti.com/tirex/explore/api'
const userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/114.0'
const accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'

const downloadUsingTools = require('./download-using-tools')

module.exports = {
  entries,
  download: downloadUsingTools,
  getPackages
}

function getPackages() {
  const ret = defer.source()
  const url = `${api_base}/packages`
  console.error(`"${url}"`)
  hq(url, {
    headers: {
      //'user-agent': userAgent,
      accept,
    }
  }, (err, res)=>{
    if (err) return ret.resolve(pull.error(err))
    if (res.statusCode >= 400) {
      return ret.resolve(pull.error(new Error(`HTTP status ${res.statusCode}`)))
    }
    res.pipe(BufferListStream((err, data)=>{
      if (err) return ret.resolve(pull.error(err))
      let payload
      try{
        payload = JSON.parse(data).payload
      } catch(err) {
        return ret.resolve(pull.error(err))
      }
      ret.resolve(pull.values(payload))
    }))
  })
  return ret
}

function entries(url, cb) {
  console.log('>', url)
  unzip.Open.url(request, url).then(directory=>{
    cb(null, directory)
  }).catch(cb)
}

function download(url, dest, opts, cb) {
  cb = once(cb)
  hq(url, (err, res)=>{
    if (res.statusCode==302) {
      console.error(302,'redirect', res.headers.location)
      return download(res.headers.location, dest, opts, cb)
    }
    if (err) return cb(err)
    if (res.statusCode >= 400) {
      return cb(new Error(`HTTP status ${res.statusCode}`))
    }
    res.pipe(Extract({path: dest, filter: opts.filter, trim: opts.trim}))
    /*
    res.pipe(unzip.Parse())
    .on('entry', entry=>{
      const {type, path, size} = entry
      const p = path.split('/').slice(1).join('/')
      const t = type[0]
      console.log(t, p, t=='F' ? size : '')
      entry.autodrain() //.catch(e => console.log(e.message))
    })
    */
    .on('error', err=>{
      console.error('error', err)
      cb(err)
    })
    .on('finish', ()=>{
      cb(null)
    })
  })
}


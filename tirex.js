const hq = require('hyperquest')
const unzip = require('unzip-stream')

const base = 'https://downloads.ti.com/ccs/esd/tirex/zips'
const sdkname = 'simplelink_cc13xx_cc26xx_sdk'

module.exports = {
  getSize,
  download
}

function getUrl(version, platform) {
  version = version.replace(/\./g, '_')
  const filepath = `${sdkname}_${version}_full_meta/${platform}/${sdkname}_${version}_full_mg__${platform}.zip`
  const url = `${base}/${filepath}`
  return url
}

function download(version, platform, cb) {
  hq(getUrl(version, platform), (err, res)=>{
    if (err) return cb(err)
    if (res.statusCode >= 400) {
      return cb(new Error(`HTTP status ${res.statusCode}`))
    }
    res.pipe(unzip.Parse())
    .on('entry', entry=>{
      const {type, path, size} = entry
      const p = path.split('/').slice(1).join('/')
      const t = type[0]
      console.log(t, p, t=='F' ? size : '')
      entry.autodrain()
    })
    .on('error', err=>cb && cb(err), cb=null)
    .on('close', ()=>cb && cb(null), cb=null)
  })
}

function getSize(version, platform, cb) {
  hq(getUrl(version, platform), {method: 'head'}, (err, res)=>{
    if (err) return cb(err)
    if (res.statusCode >= 400) {
      return cb(new Error(`HTTP status ${res.statusCode}`))
    }
    cb(null, +res.headers['content-length'])
  })
}


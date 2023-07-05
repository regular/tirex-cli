// NOTE: this ignores filtering and trim options (trim is always 1)
// and all files are extracted.

const fs = require('fs')
const {parse} = require('path')
const tmp = require('tmp-promise')
const {spawn, exec} = require('child_process')
const {mkdirp} = require('mkdirp')

module.exports = function downloadAndExtract(url, dest, opts, cb) {
  if (fs.existsSync(dest)) return cb(new Error(`Already exists: ${dest}`))
  tmp.withDir(async o => {
    try {
      await mkdirp(parse(dest).dir)

      const cmd = Cmd(o.path)

      await cmd('wget', [
        '-O', 'download.zip',
        url
      ])
      await cmd('unzip', [
        'download.zip'
      ])
      const name = await new Promise( (resolve, reject) => {
        exec('find . -maxdepth 1 -type d', {
          cwd: o.path
        }, (err, name)=>{
          if (err) return reject(err)
          resolve(name.split('\n')[1].slice(2))
        })
      })
      console.log('was extracted to',name)
      if (!name.match(/^[a-zA-Z0-9_\-\.]+$/)) {
        throw new Error(`Unsafe name: ${name}`)
      }
      await new Promise( (resolve, reject) => {
        exec(`mv ${name} ${dest} && rm download.zip`, {
          cwd: o.path
        }, err =>{
          if (err) return reject(err)
          resolve()
        })
      })
    } catch(err) {
      console.error(err)
      throw err
    }
  }).then(x=>cb(null, x)).catch(cb)
}

function Cmd(tmpDir) {
  return function cmd(name, args) {
    return new Promise( (resolve, reject)=>{
      const p  = spawn(name, args, {
        stdio: 'inherit',
        cwd: tmpDir
      })
      p.on('error', reject)
      p.on('close', code=>{
        if (code == 0) resolve(); else reject(new Error(`${name} exitied with code ${code}`))
      })
    })
  }
}

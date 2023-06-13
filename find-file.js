const pull = require('pull-stream')
const file = require('pull-file')
const split = require('pull-split')
const utf8 = require('pull-utf8-decoder')
const pm = require('picomatch')
const conf = require('rc')('tisl')
console.log(conf)
const match = pm(conf._[0])

let lc = 0
pull(
  file('everything'),
  utf8(),
  split(),
  (()=>{
    let prev, uid
    return pull.map(line=>{
      if (line == '===') {
        uid = prev
      }
      prev = line
      return {uid, line}
    })
  })(),
  pull.filter(({line})=>{
    lc++
    const words = line.split(' ')
    if (words.length>=2) {
      return match(words[1])
    }
    return false
  }),
  pull.unique(p=>p.uid),
  pull.drain(p=>{
    console.log(p.uid)
  }, err=>{
    console.log(`${lc} files scanned`)
    if (err) {
      console.error(err.message)
      process.exit(1)
    }
  })
)

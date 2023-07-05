const fs = require('fs')
const p = 'fixtures/zipme.zip'
const Extract = require('./extract')
const unzipper = require('unzipper')

const s = fs.createReadStream(p)
s.pipe(Extract({path: 'temp/outcrc'}))
.on('error', console.log)


const fs = require('fs')
const p = 'fixtures/exetest.zip'
const Extract = require('./extract')
const unzipper = require('unzipper')

const s = fs.createReadStream(p)
s.pipe(Extract({path: 'temp/outmode'}))
.on('error', console.log)


const {getSize, download} = require('./tirex')
const human = require('human-size')

//const version = '6.40.00.13'
const version = '7.10.00.98'
/*
getSize(version, 'linux', (err, size)=>{
  console.log(err, human(size, 1))
})
*/
download(version, 'linux', err=>{
  console.log(err)
})

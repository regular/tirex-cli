const install = require('./download-using-tools')

const url = 'https://downloads.ti.com/ccs/esd/tirex/zips/gcc-arm-none-eabi_9_3_1/linux/gcc-arm-none-eabi_9_3_1_linux.zip'

install(url, __dirname + '/temp0/dl-ut', {}, err=>{
  if (err) console.error(err.stack)
})

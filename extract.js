const fs = require('fs')
const {crc32} = require('crc')
const once = require('once')

var Parse = require('unzipper/lib/parse');
var Writer = require('fstream').Writer;
var path = require('path');
var stream = require('stream');
var duplexer2 = require('duplexer2');
var Promise = require('bluebird');

module.exports = function Extract (opts) {
  // make sure path is normalized before using it
  opts.path = path.resolve(path.normalize(opts.path));
  const filter = opts.filter || (()=>true)

  function trim(p) {
    if (!opts.trim) return p
    return p.split(path.sep).slice(opts.trim).join(path.sep)
  }

  const file_modes = {}
  const extracted = {}
  const toValidate = {}

  var parser = new Parse(opts);

  var outStream = new stream.Writable({objectMode: true})
  outStream._write = function(entry, encoding, cb) {
    cb = once(cb)
    if (entry.type == 'Directory') return cb()

    // to avoid zip slip (writing outside of the destination), we resolve
    // the target path, and make sure it's nested in the intended
    // destination, or not extract it otherwise.
    
    const trimmedPath = trim(entry.path)
    var extractPath = path.join(opts.path, trimmedPath);
    if (extractPath.indexOf(opts.path) != 0) {
      return cb()
    }
    
    if (!filter(trimmedPath)) {
      console.log('ignoring', trimmedPath)
      delete file_modes[extractPath]
      entry.autodrain()
      cb()
    } else {
      const writer = opts.getWriter ? opts.getWriter({path: extractPath}) :  Writer({ path: extractPath });
      console.log('extracting', entry.type, trimmedPath)
      let checksum 
      entry.on('data', data=>{
        if (checksum == undefined) checksum = crc32(data)
        else checksum = crc32(data, checksum)
      })
      entry.pipe(writer)
        .on('error', cb)
        .on('close', ()=>{
          if (!checksum) checksum = 0
          const cdeCRC = toValidate[extractPath]
          if (cdeCRC !== undefined) {
            if (checksum == cdeCRC) {
              delete toValidate[extractPath]
            } else {
              return cb(new Error(`CRC32 mismatch in ${trimmedPath}! CRC32 stored Central Directory is ${cdeCRC}, calculated during extraction is: ${checksum}`))
            }
          }
          if (checksum !== entry.vars.crc32) {
            if (entry.vars.crc32 !== 0) {
              return cb(new Error(`CRC32 mismatch in ${trimmedPath}! CRC32 stored in local header is ${entry.vars.crc32}, calculated during extraction is: ${checksum}`))
            }
          } else {
            console.log('CRC32 checksums match', checksum)
          }
          extracted[extractPath] = checksum
          const mode = file_modes[extractPath]
          if (mode) {
            fs.chmod(extractPath, mode, err=>{
              console.log(
                'deferred chmod',
                mode.toString(8),
                extractPath
              )
              if (err) {
                console.error(`failed to chmod ${mode.toString(8)} ${extractPath} ${err.message}`)
              }
              delete file_modes[extractPath]
              cb(err)
            })
          } else {
            cb()
          }
        })
    }
  };

  var extract = duplexer2(parser,outStream);
  parser.once('crx-header', function(crxHeader) {
    extract.crxHeader = crxHeader;
  })
  .on('centraldir_entry', cde=>{
    setImmediate(()=>{
      const p = path.join(opts.path, trim(cde.fileName))
      if (extracted[p] !== undefined) {
        if (extracted[p] !== cde.crc32) {
          throw new Error(`CRC32 mismatch in ${p}!`)
        }
      } else if (cde.crc32 !== 0) {
        toValidate[p] = cde.crc32
      }
      const mode = parseExtAttrs(cde.externalFileAttributes)
      if (mode) {
        if (extracted[p] !== undefined) {
          fs.chmod(p, mode, err=>{
            console.log(
              'chmod',
              mode.toString(8),
              cde.fileName,
              err ? err.message : ''
            )
          })
        } else {
          file_modes[p] = mode
        }
      }
    })
  })

  parser
    .pipe(outStream)
    .on('finish',function() {
      const unvalidated = Object.keys(toValidate)
      if (unvalidated.length) {
        throw Error('Some files could not be validated:' + unvalidated.join(' '))
      }
      extract.emit('close');
    });
  
  extract.promise = function() {
    return new Promise(function(resolve, reject) {
      extract.on('close', resolve);
      extract.on('error',reject);
    });
  };

  return extract;
}

function parseExtAttrs(a) {
  //a = (a & 0xffff0000) >> 16
  //const type = (a & 0170000)
  //const perms = (a & 0777)
  return (a >> 16) & 0170777
}

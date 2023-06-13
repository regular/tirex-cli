module.exports = Extract;

const fs = require('fs')
var Parse = require('unzipper/lib/parse');
var Writer = require('fstream').Writer;
var path = require('path');
var stream = require('stream');
var duplexer2 = require('duplexer2');
var Promise = require('bluebird');

function Extract (opts) {
  // make sure path is normalized before using it
  opts.path = path.resolve(path.normalize(opts.path));
  const filter = opts.filter || (()=>true)

  function trim(p) {
    if (!opts.trim) return p
    return p.split(path.sep).slice(opts.trim).join(path.sep)
  }

  const file_modes = {}

  var parser = new Parse(opts);

  var outStream = new stream.Writable({objectMode: true});
  outStream._write = function(entry, encoding, cb) {
    if (entry.type == 'Directory') return cb();

    // to avoid zip slip (writing outside of the destination), we resolve
    // the target path, and make sure it's nested in the intended
    // destination, or not extract it otherwise.
    
    const trimmedPath = trim(entry.path)
    var extractPath = path.join(opts.path, trimmedPath);
    if (extractPath.indexOf(opts.path) != 0) {
      return cb();
    }
    
    if (!filter(trimmedPath)) {
      console.log('ignoring', trimmedPath)
      delete file_modes[extractPath]
      entry.autodrain()
      cb()
    } else {
      const writer = opts.getWriter ? opts.getWriter({path: extractPath}) :  Writer({ path: extractPath });
      console.log('extracting', trimmedPath)
      entry.pipe(writer)
        .on('error', cb)
        .on('close', ()=>{
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
        });
    }
  };

  var extract = duplexer2(parser,outStream);
  parser.once('crx-header', function(crxHeader) {
    extract.crxHeader = crxHeader;
  })
  .on('centraldir_entry', cde=>{
    setImmediate(()=>{
      const p = path.join(opts.path, trim(cde.fileName))
      const mode = parseExtAttrs(cde.externalFileAttributes)
      fs.chmod(p, mode, err=>{
        if (!err) {
          console.log(
            'chmod',
            mode.toString(8),
            cde.fileName
          )
          return
        }
        file_modes[p] = mode
      })
    })
  })

  parser
    .pipe(outStream)
    .on('finish',function() {
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
  a = (a & 0xffff0000) >> 16
  const perms = (a & 0777)
  return perms
}

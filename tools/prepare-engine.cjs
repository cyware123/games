const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');process.chdir(root);
const files={"src/stockfish-17.1-lite-single-03e3232.js": "engine/stockfish.js", "src/stockfish-17.1-lite-single-03e3232.wasm": "engine/stockfish.wasm"},expected={"src/stockfish-17.1-lite-single-03e3232.js": "1c8265e52fdaef797684b4979b42c5dcfe0350df3e11a87e48e4ec5f86e0ca5c", "src/stockfish-17.1-lite-single-03e3232.wasm": "7ca31bedd166148931a1cc84dbd8dd9cf001744e9994caf23a3c6ff4988d7086"};
for(const [source,target] of Object.entries(files)){
 const raw=fs.readFileSync(path.join(root,'node_modules/stockfish',source));
 const actual=crypto.createHash('sha256').update(raw).digest('hex');
 if(actual!==expected[source])throw new Error('Stockfish SHA256 mismatch: '+source);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw);
}
fs.copyFileSync('node_modules/stockfish/Copying.txt','engine/COPYING.txt');
console.log('Stockfish 17.1 lite preparado y SHA256 verificado.');

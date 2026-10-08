import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
execFileSync(process.execPath,['node_modules/typescript/bin/tsc'],{stdio:'inherit'});
mkdirSync('dist',{recursive:true});
copyFileSync('src/ui/index.html','dist/index.html');copyFileSync('src/ui/styles.css','dist/styles.css');
await build({entryPoints:['src/ui/app.js'],bundle:true,format:'iife',target:'es2022',outfile:'dist/app.js',sourcemap:false});
const demo=readFileSync('dist/index.html','utf8').replace('<link rel="stylesheet" href="styles.css">','<style>'+readFileSync('dist/styles.css','utf8')+'</style>').replace('<script type="module" src="app.js"></script>','<script>window.MARKETING_OFFLINE_DEMO=true;'+readFileSync('dist/app.js','utf8')+'\n(async()=>{while(!window.campaignReady)await new Promise(resolve=>setTimeout(resolve,10));document.querySelector(\'[data-tool="campaign"]\').click();document.querySelector("#topic").value="Our team offers gentle first grooming visits for puppies. Message us to discuss preparation and appointment options.";document.querySelector("#creatorForm").dispatchEvent(new Event("submit",{cancelable:true}));})();</script>');
writeFileSync('marketing-agent-demo.html',demo);console.log('Production server, frontend, and labeled offline demo built.');

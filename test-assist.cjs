const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});try{
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**/*',r=>r.abort());await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
await page.evaluate(()=>{if($('profileDialog').open)$('profileDialog').close();$('animation').checked=false;$('moveReview').checked=false;start('friend')});
assert.equal(await page.locator('#autoMoveButton').isVisible(),false);
await page.evaluate(()=>{for(let i=0;i<7;i++)$('version').onclick()});assert(await page.locator('#autoMoveButton').isVisible());
await page.evaluate(()=>{window.realCompute=compute;window.calls=[];compute=async(d,b,s,ctx)=>{calls.push(ctx);const move=Chess.legal(state)[0];return {move,pv:[moveUci(move)],score:50,kind:'cp',depth:12,engine:'Test',lines:{1:{kind:'cp',score:50,pv:[moveUci(move)]}}}}});
await page.click('#hintButton');assert.equal(await page.locator('.square.hint').count(),2);
await page.click('#autoMoveButton');await page.waitForFunction(()=>history.length===1);assert.equal(await page.evaluate(()=>state.turn),'b');
await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>history.length),1);
await page.click('#hideAssistButton');assert.equal(await page.locator('#autoMoveButton').isVisible(),false);assert.equal(await page.locator('#analysis').isVisible(),false);
await page.evaluate(async()=>play(Chess.legal(state)[0]));await page.waitForFunction(()=>history.length===3);assert.equal(await page.locator('#analysis').isVisible(),false);assert.equal(await page.locator('.square.hint').count(),0);
await page.keyboard.press('Control+Shift+H');assert(await page.locator('#autoMoveButton').isVisible());await page.click('#autoMoveButton');
const report=await page.evaluate(async()=>{
 start('friend');legitEnabled=true;const moves=Chess.legal(state),found={move:moves[0],kind:'cp',score:100,lines:{1:{kind:'cp',score:100,pv:[moveUci(moves[0])]},2:{kind:'cp',score:40,pv:[moveUci(moves[1])]},3:{kind:'cp',score:-300,pv:[moveUci(moves[2])]}}};
 const picked=moveUci(chooseAssistMove(found,()=>0)),normal=moveUci(chooseAssistMove(found,()=>.9));found.lines[2].kind='mate';const mateExcluded=moveUci(chooseAssistMove(found,()=>0));legitEnabled=false;
 return {picked,normal,mateExcluded,best:moveUci(moves[0]),alternative:moveUci(moves[1])};
});assert.equal(report.picked,report.alternative);assert.equal(report.normal,report.best);assert.equal(report.mateExcluded,report.best);
// Disable and reset must cancel the already calculated, delayed move.
await page.evaluate(()=>{setAutoMove(true)});await page.waitForFunction(()=>assistWaitResolve!==null);await page.evaluate(()=>setAutoMove(false));await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>history.length),0);
await page.evaluate(()=>setAutoMove(true));await page.waitForFunction(()=>assistWaitResolve!==null);await page.evaluate(()=>start('friend'));await page.waitForTimeout(80);await page.evaluate(()=>setAutoMove(false));await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>history.length),0);
// A changed position invalidates the result, even before generation changes.
await page.evaluate(async()=>{window.releaseSearch=null;compute=()=>new Promise(resolve=>{releaseSearch=()=>resolve({move:Chess.legal(Chess.initial())[0],pv:[],lines:{}})});window.pendingHint=requestChessHint()});await page.waitForFunction(()=>releaseSearch!==null);
await page.evaluate(async()=>{await play(Chess.legal(state)[1]);releaseSearch();await pendingHint});assert.equal(await page.evaluate(()=>hint),null);assert.equal(await page.evaluate(()=>history.length),1);
await page.evaluate(()=>{compute=realCompute;start('friend');switchGame('checkers-ru')});assert(await page.locator('#autoMoveButton').isDisabled());assert.equal(await page.evaluate(()=>autoMoveEnabled),false);
await page.evaluate(()=>switchGame('chess'));for(const width of [320,390,1200]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
await page.evaluate(()=>{compute=realCompute;start('friend');$('engineMemory').value='lite';$('hintSpeed').value='fast';legitEnabled=true;setAssistHidden(true);setAutoMove(true)});
await page.waitForFunction(()=>history.length===1,null,{timeout:60000});
assert.equal(await page.evaluate(()=>state.turn),'b');assert.equal(await page.locator('#analysis').isVisible(),false);assert(!/Stockfish|глубина|позиций|анализ/i.test(await page.locator('#status').textContent()));
await page.evaluate(()=>setAutoMove(false));
assert.deepEqual(errors,[]);console.log('PASS: reveal/hide, manual hint, automatic own-side moves, hidden continuation, bounded alternatives, delayed cancellation, stale position, checkers isolation, mobile layout; real Stockfish Lite automatic move with MultiPV; no JS errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});


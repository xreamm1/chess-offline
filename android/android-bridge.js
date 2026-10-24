// APK assets are installed once; no network or service worker is needed for engines.
window.__pauseGame=()=>{cancelDraughtsSearch();cancelSearch();disposeEngine();stopScanner()};
window.__resumeGame=()=>{render();if(currentGame==='checkers-ru')scheduleDraughtsBot();else scheduleBot()};
const browserAnchorClick=HTMLAnchorElement.prototype.click;
async function saveAndroidFile(anchor){
 try{const blob=await (await fetch(anchor.href)).blob();if(blob.size>8000000)throw Error('Файл слишком большой для экспорта');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Не удалось прочитать файл'));r.readAsDataURL(blob)});AndroidFiles.save(anchor.download||'chess-export.txt',blob.type||'application/octet-stream',data.slice(data.indexOf(',')+1))}
 catch(error){updateStatus(error.message)}
}
HTMLAnchorElement.prototype.click=function(){if(window.AndroidFiles&&this.download&&/^(blob:|data:)/.test(this.href)){saveAndroidFile(this);return}return browserAnchorClick.call(this)};
document.addEventListener('click',event=>{const a=event.target.closest?.('a[download]');if(window.AndroidFiles&&a&&/^(blob:|data:)/.test(a.href)){event.preventDefault();saveAndroidFile(a)}});
$('downloadEngine').textContent='SF19 уже встроен в приложение';
$('downloadEngine').disabled=true;
$('engineCacheStatus').textContent='Полный SF19, Lite и шашечные движки установлены вместе с APK.';

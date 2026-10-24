/* Firebase Auth and Firestore transport. No service-account credentials belong in this client. */
class FirebaseChess {
 constructor(config,callbacks={}){this.config=config;this.callbacks=callbacks;this.subs=[];this.gameSubs=[];this.generation=0;this.game=null;this.ticket=null;this.matchBusy=false}
 async connect(name){
  if(this.connected){await this.rename(name);return this.user}
  if(!this.config?.apiKey||!this.config?.projectId||!this.config?.appId)throw Error('Владелец ещё не подключил Firebase-проект');
  const base='https://www.gstatic.com/firebasejs/12.4.0/';
  const [app,A,F]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);this.F=F;
  this.app=app.initializeApp(globalThis.__FIREBASE_EMULATOR__?{...this.config,projectId:'demo-chess'}:this.config,'board-games');this.auth=A.getAuth(this.app);this.db=F.getFirestore(this.app);
  if(globalThis.__FIREBASE_EMULATOR__){A.connectAuthEmulator(this.auth,'http://127.0.0.1:19099',{disableWarnings:true});F.connectFirestoreEmulator(this.db,'127.0.0.1',18080)}
  await this.auth.authStateReady();this.user=this.auth.currentUser||(await A.signInAnonymously(this.auth)).user;
  await this.rename(name);this.listenSocial();this.connected=true;return this.user;
 }
 ref(...parts){return this.F.doc(this.db,...parts)}
 async rename(name){this.name=name;const F=this.F;await F.setDoc(this.ref('players',this.user.uid),{name,updatedAt:F.serverTimestamp()},{merge:true})}
 fail(e){this.callbacks.error?.(e.message||String(e))}
 listenSocial(){const F=this.F,uid=this.user.uid;
  this.subs.push(F.onSnapshot(F.query(F.collection(this.db,'friendships'),F.where('members','array-contains',uid)),s=>this.callbacks.friends?.(s.docs.map(d=>({id:d.id,...d.data()}))),e=>this.fail(e)));
  this.subs.push(F.onSnapshot(F.query(F.collection(this.db,'games'),F.where('members','array-contains',uid),F.where('status','==','invited')),s=>this.callbacks.invites?.(s.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.inviter!==uid)),e=>this.fail(e)));
 }
 async player(uid){const p=await this.F.getDoc(this.ref('players',uid));return p.exists()?{uid,...p.data()}:null}
 async requestFriend(uid){if(!/^[A-Za-z0-9_-]{10,128}$/.test(uid)||uid===this.user.uid)throw Error('Укажите код другого игрока');const other=await this.player(uid);if(!other)throw Error('Игрок не найден');const own=this.user.uid,id=[own,uid].sort().join('~'),ref=this.ref('friendships',id),F=this.F;
  await F.runTransaction(this.db,async tx=>{const previous=await tx.get(ref);if(previous.exists())throw Error('Этот игрок уже в друзьях или заявка отправлена');tx.set(ref,{members:[own,uid],sender:own,recipient:uid,names:{[own]:this.name,[uid]:other.name},status:'pending',createdAt:F.serverTimestamp()})})
 }
 async acceptFriend(id){await this.F.updateDoc(this.ref('friendships',id),{status:'accepted'})}
 async removeFriend(id){await this.F.deleteDoc(this.ref('friendships',id))}
 gameData(game,members,names,kind,friendship=null){const white=crypto.getRandomValues(new Uint8Array(1))[0]&1?members[0]:members[1],black=members.find(id=>id!==white),F=this.F;return {game,members,names,white,black,turn:game==='checkers-en'?black:white,ply:0,lastMove:null,status:kind==='invite'?'invited':'active',kind,friendship,inviter:this.user.uid,createdAt:F.serverTimestamp(),updatedAt:F.serverTimestamp()}}
 async search(game){await this.leave();const epoch=++this.generation,F=this.F,uid=this.user.uid;this.ticket=crypto.randomUUID();const session=this.ticket;
  const own=this.ref('queue',uid);await F.deleteDoc(own);await F.setDoc(own,{uid,game,name:this.name,status:'waiting',session,gameId:null,updatedAt:F.serverTimestamp()});if(epoch!==this.generation){await this.cancelTicket(session);return}
  this.gameSubs.push(F.onSnapshot(own,s=>{const t=s.data();if(epoch===this.generation&&t?.session===session&&t.status==='matched')this.open(t.gameId,epoch).catch(e=>this.fail(e))},e=>this.fail(e)));
  this.gameSubs.push(F.onSnapshot(F.query(F.collection(this.db,'queue'),F.where('game','==',game),F.where('status','==','waiting')),s=>{const candidates=s.docs.map(d=>d.data()).filter(t=>t.uid!==uid&&t.updatedAt&&Date.now()-t.updatedAt.toMillis()<60000).sort((a,b)=>a.updatedAt.toMillis()-b.updatedAt.toMillis());this.match(candidates,game,epoch).catch(e=>this.fail(e))},e=>this.fail(e)));
  this.heartbeat=setInterval(()=>{if(epoch!==this.generation||this.game)return;F.runTransaction(this.db,async tx=>{const s=await tx.get(own);if(s.data()?.session===session&&s.data()?.status==='waiting')tx.update(own,{updatedAt:F.serverTimestamp()})}).catch(e=>this.fail(e))},20000);
 }
 async match(candidates,game,epoch){if(this.matchBusy||this.game)return;this.matchBusy=true;const F=this.F,uid=this.user.uid,session=this.ticket;
  try{for(const candidate of candidates){if(epoch!==this.generation||this.game)break;const gameRef=F.doc(F.collection(this.db,'games')),own=this.ref('queue',uid),other=this.ref('queue',candidate.uid);let matched=await F.runTransaction(this.db,async tx=>{const a=await tx.get(own),b=await tx.get(other),mine=a.data(),theirs=b.data();if(!mine||!theirs||epoch!==this.generation||mine.session!==session||mine.game!==game||mine.status!=='waiting'||theirs.status!=='waiting'||theirs.game!==game||Date.now()-theirs.updatedAt.toMillis()>60000)return false;tx.set(gameRef,this.gameData(game,[uid,candidate.uid],{[uid]:this.name,[candidate.uid]:theirs.name},'match'));tx.update(own,{status:'matched',gameId:gameRef.id});tx.update(other,{status:'matched',gameId:gameRef.id});return true});if(matched)break}}finally{this.matchBusy=false}
 }
 async cancelTicket(session=this.ticket){if(!session)return;const F=this.F,own=this.ref('queue',this.user.uid);await F.runTransaction(this.db,async tx=>{const t=await tx.get(own);if(t.data()?.session===session)tx.delete(own)})}
 async invite(friend,game){await this.leave();const epoch=++this.generation,F=this.F,uid=this.user.uid,ref=F.doc(F.collection(this.db,'games'));await F.setDoc(ref,this.gameData(game,friend.members,{...friend.names,[uid]:this.name},'invite',friend.id));this.game=ref.id;this.gameSubs.push(F.onSnapshot(ref,s=>{const g=s.data();if(epoch!==this.generation)return;if(g?.status==='active')this.open(ref.id,epoch).catch(e=>this.fail(e));else if(g?.status==='declined')this.callbacks.left?.('Приглашение отклонено')},e=>this.fail(e)));return ref.id}
 async acceptInvite(id){await this.leave();const epoch=++this.generation,F=this.F,ref=this.ref('games',id);await F.runTransaction(this.db,async tx=>{const s=await tx.get(ref),g=s.data();if(!g||g.status!=='invited'||g.inviter===this.user.uid)throw Error('Приглашение уже закрыто');tx.update(ref,{status:'active',updatedAt:F.serverTimestamp()})});await this.open(id,epoch)}
 async declineInvite(id){await this.F.updateDoc(this.ref('games',id),{status:'declined',updatedAt:this.F.serverTimestamp()})}
 async open(id,epoch){if(epoch!==this.generation||this.opening===id)return;this.opening=id;const F=this.F,ref=this.ref('games',id),snap=await F.getDoc(ref),g=snap.data();if(epoch!==this.generation){this.opening=null;return}if(!g||g.status!=='active'||!g.members.includes(this.user.uid))throw Error('Партия недоступна');
  this.game=id;clearInterval(this.heartbeat);for(const off of this.gameSubs)off();this.gameSubs=[];this.callbacks.matched?.({...g,id,side:g.white===this.user.uid?'w':'b'});let chain=Promise.resolve(),seen=new Set();
  this.gameSubs.push(F.onSnapshot(F.query(F.collection(this.db,'games',id,'moves'),F.orderBy('ply')),s=>{for(const d of s.docs){if(seen.has(d.id))continue;seen.add(d.id);const m=d.data();if(m.sender===this.user.uid)continue;chain=chain.then(async()=>{if(epoch===this.generation)await this.callbacks.move?.(JSON.parse(m.payload))}).catch(e=>this.fail(e))}},e=>this.fail(e)));
  this.gameSubs.push(F.onSnapshot(ref,s=>{if(epoch===this.generation&&s.data()?.status==='left')this.callbacks.left?.('Соперник покинул партию')},e=>this.fail(e)));
  this.gameSubs.push(F.onSnapshot(F.query(F.collection(this.db,'games',id,'chat'),F.orderBy('createdAt','desc'),F.limit(100)),s=>{this.callbacks.chat?.(s.docs.map(d=>({id:d.id,...d.data()})).reverse())},e=>this.fail(e)));
 }
 async sendMove(message){if(!this.game)throw Error('Нет активной партии');const F=this.F,ref=this.ref('games',this.game),payload=JSON.stringify(message),uid=this.user.uid;if(payload.length>2048)throw Error('Ход слишком большой');await F.runTransaction(this.db,async tx=>{const snap=await tx.get(ref),g=snap.data();if(!g||g.status!=='active'||g.turn!==uid||g.ply!==message.ply)throw Error('Позиция партии изменилась');const next=g.ply+1;tx.update(ref,{ply:next,turn:g.turn===g.white?g.black:g.white,lastMove:payload,updatedAt:F.serverTimestamp()});tx.set(this.ref('games',this.game,'moves',String(next)),{ply:next,sender:uid,payload,createdAt:F.serverTimestamp()})})}
 async sendChat(text){text=text.trim();if(!text||text.length>300||!this.game)throw Error('Сообщение: от 1 до 300 символов');const F=this.F,uid=this.user.uid,profile=this.ref('players',uid),ref=F.doc(F.collection(this.db,'games',this.game,'chat'));await F.runTransaction(this.db,async tx=>{const s=await tx.get(profile);if(s.data()?.lastChatAt&&Date.now()-s.data().lastChatAt.toMillis()<1100)throw Error('Отправляйте не чаще одного сообщения в секунду');tx.update(profile,{lastChatAt:F.serverTimestamp()});tx.set(ref,{sender:uid,name:this.name,text,createdAt:F.serverTimestamp()})})}
 async leave(){const game=this.game,session=this.ticket;this.generation++;this.game=null;this.opening=null;this.ticket=null;clearInterval(this.heartbeat);for(const off of this.gameSubs)off();this.gameSubs=[];if(!this.user)return;await this.cancelTicket(session).catch(()=>{});if(game){const F=this.F,ref=this.ref('games',game);await F.runTransaction(this.db,async tx=>{const s=await tx.get(ref);if(['active','invited'].includes(s.data()?.status))tx.update(ref,{status:'left',updatedAt:F.serverTimestamp()})}).catch(()=>{})}}
}

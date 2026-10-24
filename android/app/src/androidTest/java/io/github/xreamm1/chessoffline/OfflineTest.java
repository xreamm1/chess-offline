package io.github.xreamm1.chessoffline;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import static org.junit.Assert.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@RunWith(AndroidJUnit4.class)
public class OfflineTest {
    private String js(ActivityScenario<MainActivity> scenario,String code) throws Exception {
        CountDownLatch done=new CountDownLatch(1);String[] result={null};
        scenario.onActivity(a->a.gameView().evaluateJavascript(code,value->{result[0]=value;done.countDown();}));
        assertTrue("JavaScript did not answer",done.await(15,TimeUnit.SECONDS));return result[0];
    }
    private String waitFor(ActivityScenario<MainActivity> scenario,String expression,int seconds) throws Exception {
        long deadline=System.currentTimeMillis()+seconds*1000L;String value="null";
        while(System.currentTimeMillis()<deadline){value=js(scenario,expression);if(!"null".equals(value)&&!"false".equals(value))return value;Thread.sleep(300);}
        fail("Timed out: "+expression+" last="+value);return value;
    }
    @Test public void firstLaunchAndEnginesWithoutInternet() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            waitFor(scenario,"typeof compute==='function' && typeof DamkaRules!=='undefined'",90);
            assertEquals("\"https://localhost\"",js(scenario,"location.origin"));
            assertEquals("true",js(scenario,"isSecureContext"));
            js(scenario,"document.getElementById('guestLogin').click();start('friend');window.__sfResult=null;compute(4,250,20).then(r=>window.__sfResult={ok:true,engine:r.engine,depth:r.depth}).catch(e=>window.__sfResult={ok:false,error:e.message});true");
            String sf=waitFor(scenario,"window.__sfResult && JSON.stringify(window.__sfResult)",150);
            String decoded=(String)new org.json.JSONTokener(sf).nextValue();JSONObject result=new JSONObject(decoded);
            assertTrue("SF19: "+decoded,result.getBoolean("ok"));String chessEngine=result.getString("engine");assertTrue("Unexpected engine: "+chessEngine,chessEngine.equals("Stockfish 19")||chessEngine.equals("Stockfish 19 Lite"));if(chessEngine.endsWith("Lite"))assertTrue("Full-engine fallback must be visible",js(scenario,"document.getElementById('engineRuntimeNote').textContent").contains("резерв Stockfish 19 Lite"));
            js(scenario,"switchGame('checkers-ru');start('friend');window.__ruResult=null;draughtsSearch(5,250,'marcher-ru').then(r=>window.__ruResult={ok:true,neural:r.neuralCalls,engine:r.engine}).catch(e=>window.__ruResult={ok:false,error:e.message});true");
            String ru=waitFor(scenario,"window.__ruResult && JSON.stringify(window.__ruResult)",90);
            decoded=(String)new org.json.JSONTokener(ru).nextValue();result=new JSONObject(decoded);
            assertTrue("Marcher RU: "+decoded,result.getBoolean("ok"));assertTrue(result.getInt("neural")>0);
            assertEquals("7",js(scenario,"DamkaRules.legal(DamkaRules.initial()).length"));
            scenario.onActivity(a->{try{java.io.File target=new java.io.File(a.getExternalFilesDir(null),"offline-test.png");
                android.view.View view=a.getWindow().getDecorView();android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(view.getWidth(),view.getHeight(),android.graphics.Bitmap.Config.ARGB_8888);view.draw(new android.graphics.Canvas(bitmap));try(java.io.FileOutputStream stream=new java.io.FileOutputStream(target)){bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,stream);}bitmap.recycle();
            }catch(Exception ignored){}});
        }
    }
}

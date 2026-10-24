package io.github.xreamm1.chessoffline;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.PermissionRequest;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.OutputStream;

public final class MainActivity extends BridgeActivity {
    private static final int SAVE_FILE=8912;
    private WebView web;
    private byte[] exportBytes;
    private boolean trusted(Uri uri) { return uri!=null && "https".equals(uri.getScheme()) && "localhost".equals(uri.getHost()) && (uri.getPort()==-1 || uri.getPort()==443); }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (bridge==null) return;
        web=bridge.getWebView();
        WebSettings settings=web.getSettings();
        settings.setAllowFileAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override public void onPermissionRequest(PermissionRequest request) {
                if (!trusted(request.getOrigin())) { request.deny(); return; }
                for (String resource:request.getResources()) if (!PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) { request.deny(); return; }
                super.onPermissionRequest(request);
            }
        });
        web.addJavascriptInterface(new FileExport(),"AndroidFiles");
    }
    private void message(String text) { Toast.makeText(this,text,Toast.LENGTH_LONG).show(); }
    private final class FileExport {
        @JavascriptInterface public void save(String name,String mime,String encoded) {
            if (name==null || encoded==null || encoded.length()>12_000_000) return;
            final byte[] bytes;
            try { bytes=Base64.decode(encoded,Base64.DEFAULT); } catch (Exception invalid) { return; }
            if (bytes.length>8_000_000) return;
            String safe=name.replaceAll("[^\\p{L}\\p{N}._ -]","_");
            if (safe.length()>100) safe=safe.substring(0,100);
            final String title=safe.isEmpty()?"chess-export.txt":safe;
            runOnUiThread(()->{
                if (web.getUrl()==null || !trusted(Uri.parse(web.getUrl())) || exportBytes!=null) return;
                exportBytes=bytes;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(mime!=null && mime.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")?mime:"application/octet-stream")
                    .putExtra(Intent.EXTRA_TITLE,title);
                try { startActivityForResult(intent,SAVE_FILE); } catch (Exception error) { exportBytes=null; message("Не удалось открыть сохранение"); }
            });
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if (request!=SAVE_FILE) return;
        final byte[] bytes=exportBytes; exportBytes=null;
        if (result==RESULT_OK && data!=null && data.getData()!=null && bytes!=null) {
            Uri destination=data.getData();
            new Thread(()->{
                try (OutputStream stream=getContentResolver().openOutputStream(destination)) {
                    if (stream==null) throw new java.io.IOException("No stream"); stream.write(bytes);
                    runOnUiThread(()->message("Файл сохранён"));
                } catch (Exception error) { runOnUiThread(()->message("Не удалось сохранить файл")); }
            },"game-export").start();
        }
    }
    @Override public void onStop() { if (web!=null) web.evaluateJavascript("window.__pauseGame?.()",null); super.onStop(); }
    @Override public void onResume() { super.onResume(); if (web!=null) web.evaluateJavascript("window.__resumeGame?.()",null); }
    @Override public void onDestroy() { if (web!=null) web.removeJavascriptInterface("AndroidFiles"); super.onDestroy(); }
    WebView gameView() { return web; }
}

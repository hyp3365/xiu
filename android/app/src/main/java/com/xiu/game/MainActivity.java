package com.xiu.game;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HashMap;

// 打开游戏网页。服务器地址来自仓库根目录 server-url.txt（打包时复制到 assets/server.txt）
// 图片：打包时把 web/img 放进安装包（assets/img），版本号和服务器一致就直接用包里的，不一致（服务器换了图）才去服务器下载
public class MainActivity extends Activity {
    private static final int BG = Color.parseColor("#14110f");
    private WebView web;
    private String imgTree = "";
    private final HashMap<String, String> imgHash = new HashMap<>();

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);   // 全屏：不显示手机顶部状态栏
        w.setStatusBarColor(BG);
        w.setNavigationBarColor(BG);
        w.getDecorView().setBackgroundColor(BG);
        loadImgVer();
        web = new WebView(this);
        web.setBackgroundColor(BG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setTextZoom(100);   // 不跟随手机系统字体大小，和浏览器里一样
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            // 安装版标记：网页 html 加 class="apk"，样式里底部导航往上抬一点，避开手机底部手势条
            @Override
            public void onPageFinished(WebView v, String url) {
                v.evaluateJavascript("document.documentElement.classList.add('apk')", null);
            }
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                WebResourceResponse r = localImg(req.getUrl());
                return r != null ? r : super.shouldInterceptRequest(v, req);
            }
        });
        setContentView(web);
        if (b != null) web.restoreState(b);
        else web.loadUrl(serverUrl());
    }

    private void loadImgVer() {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(getAssets().open("img_ver.txt"), "UTF-8"))) {
            imgTree = r.readLine();
            if (imgTree == null) imgTree = "";
            imgTree = imgTree.trim();
            String line;
            while ((line = r.readLine()) != null) {
                int i = line.lastIndexOf(' ');
                if (i > 0) imgHash.put(line.substring(0, i), line.substring(i + 1).trim());
            }
        } catch (Exception e) { }
    }

    private WebResourceResponse localImg(Uri u) {
        try {
            String path = u.getPath();
            if (path == null) return null;
            int i = path.indexOf("/img/");
            if (i < 0) return null;
            String rel = path.substring(i + 5);
            String h = imgHash.get(rel);
            if (h == null) return null;                       // 包里没有这张图
            String v = u.getQueryParameter("v");
            if (v != null && !v.equals(imgTree) && !v.equals(h)) return null;   // 服务器图片版本变了
            String mime = rel.endsWith(".webp") ? "image/webp" : rel.endsWith(".png") ? "image/png"
                    : rel.endsWith(".svg") ? "image/svg+xml" : rel.endsWith(".gif") ? "image/gif" : "image/jpeg";
            return new WebResourceResponse(mime, null, getAssets().open("img/" + rel));
        } catch (Exception e) {
            return null;
        }
    }

    private String serverUrl() {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(getAssets().open("server.txt"), "UTF-8"))) {
            String line;
            while ((line = r.readLine()) != null) {
                line = line.trim();
                if (!line.isEmpty() && !line.startsWith("#")) return line;
            }
        } catch (Exception e) { }
        return "about:blank";
    }

    @Override
    protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}

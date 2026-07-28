//! 财务审计桌面 Tauri 入口。
//! 云端 IAM + 本机 Sidecar；业务数据不经此进程写云。
//! WebView 直连外网会因 CORS 失败，故由 Rust 代理 HTTP。

use std::collections::HashMap;

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponsePayload {
    status: u16,
    body: String,
}

fn assert_url_allowed(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|e| format!("无效 URL: {e}"))?;
    let scheme = parsed.scheme();
    let host = parsed.host_str().unwrap_or("");
    if scheme == "https" {
        return Ok(());
    }
    if scheme == "http" && (host == "127.0.0.1" || host == "localhost") {
        return Ok(());
    }
    Err(format!("不允许的地址: {url}"))
}

#[tauri::command]
async fn http_request(
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<HttpResponsePayload, String> {
    assert_url_allowed(&url)?;
    let method = method.unwrap_or_else(|| "GET".into());
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))?;

    let mut req = client.request(
        reqwest::Method::from_bytes(method.as_bytes())
            .map_err(|_| format!("不支持的方法: {method}"))?,
        &url,
    );

    if let Some(headers) = &headers {
        for (k, v) in headers {
            req = req.header(k.as_str(), v.as_str());
        }
    }
    if let Some(body) = &body {
        req = req.body(body.clone());
    }

    let res = req.send().await.map_err(|e| {
        let msg = e.to_string();
        if msg.contains("Connection refused") || msg.contains("Connect") {
            format!(
                "连不上本机 Sidecar（{url}）。请先启动：make desktop-finance-run TENANT=<tenantId>"
            )
        } else {
            format!("网络请求失败: {msg}")
        }
    })?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| format!("读取响应失败: {e}"))?;
    Ok(HttpResponsePayload { status, body })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![http_request])
        .run(tauri::generate_context!())
        .expect("error while running finance-desktop");
}

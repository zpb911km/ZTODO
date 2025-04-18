// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// #[tauri::command]
// fn greet(name: &str) -> String {
//     format!("Hello, {}! You've been greeted from Rust!", name)
// }

use std::io::{Read, Write};
use std::net::TcpStream;

#[tauri::command]
fn fetch_data(url: String) -> Result<String, String> {
    if !url.starts_with("http://") {
        return Err("Invalid URL".to_string());
    }
    let (mut stream, host, path) = connect(url)?;

    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        path, host
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|e| e.to_string())?;
    read_response(stream)
}

#[tauri::command]
fn post_data(url: String, data: String) -> Result<String, String> {
    let (mut stream, host, path) = connect(url)?;

    let request = format!(
        "POST {} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        path, host, data.len(), data
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|e| e.to_string())?;
    read_response(stream)
}

fn connect(url: String) -> Result<(TcpStream, String, String), String> {
    let url = url.trim_start_matches("http://");
    let (host, path) = parse_url(url)?;
    let (host_str, port) = parse_host_port(&host)?;

    let stream = TcpStream::connect((host_str, port)).map_err(|e| e.to_string())?;
    Ok((stream, host_str.to_string(), path))
}

fn parse_url(url: &str) -> Result<(String, String), String> {
    match url.find('/') {
        Some(idx) => Ok((url[..idx].to_string(), url[idx..].to_string())),
        None => Ok((url.to_string(), "/".to_string())),
    }
}

fn parse_host_port(host: &str) -> Result<(&str, u16), String> {
    match host.find(':') {
        Some(idx) => {
            let (h, p) = host.split_at(idx);
            Ok((h, p[1..].parse().map_err(|_| "Invalid port")?))
        }
        None => Ok((host, 80)),
    }
}

fn read_response(mut stream: TcpStream) -> Result<String, String> {
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|e| e.to_string())?;

    let mut parts = response.splitn(2, "\r\n\r\n");
    let headers = parts.next().unwrap_or("");
    let body = parts.next().unwrap_or("");

    if let Some(status) = headers.lines().next() {
        if !status.starts_with("HTTP/1.1 200") {
            return Err(format!("HTTP error: {}", status));
        }
    }

    Ok(body.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![fetch_data, post_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

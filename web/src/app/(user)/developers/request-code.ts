import type { ExampleRequest } from "./example-requests";

export function requestCode(language: string, request: ExampleRequest) {
    const { method, path } = request;
    const body = "body" in request ? JSON.stringify(request.body, null, 2) : "";
    const literal = JSON.stringify(body);
    const comment = "{{注释:从环境变量读取站点地址和密钥；将模型与编号占位值替换为实际值。}}";
    const check = "{{注释:同时检查 HTTP 状态与业务 code；排队时保存 taskId，勿重复提交。}}";
    switch (language) {
        case "cURL": return `# ${comment}
# ${check}
curl --fail-with-body --max-time 300 -X ${method} "$AIVRO_BASE_URL${path}" \\
  -H "Authorization: Bearer $AIVRO_API_KEY"${body ? ` \\
  -H 'Content-Type: application/json' \\
  --data-binary @- <<'JSON'
${body}
JSON` : ""}`;
        case "Python": return `import json
import os
import requests

# ${comment}
response = requests.request(
    "${method}", os.environ["AIVRO_BASE_URL"] + "${path}",
    headers={"Authorization": "Bearer " + os.environ["AIVRO_API_KEY"]},${body ? `
    json=json.loads(${literal}),` : ""}
    timeout=300,
)
# ${check}
response.raise_for_status()
result = response.json()
if result.get("code", 0) != 0:
    raise RuntimeError(result.get("msg", response.text))
print(json.dumps(result, ensure_ascii=False, indent=2))`;
        case "Node.js":
        case "TypeScript": return `// ${comment}
const { AIVRO_BASE_URL, AIVRO_API_KEY } = process.env;
if (!AIVRO_BASE_URL || !AIVRO_API_KEY) throw new Error("AIVRO_BASE_URL / AIVRO_API_KEY");
${body ? `const payload = ${body};\n` : ""}
const response = await fetch(AIVRO_BASE_URL + "${path}", {
  method: "${method}",
  headers: { Authorization: "Bearer " + AIVRO_API_KEY${body ? ', "Content-Type": "application/json"' : ""} },${body ? "\n  body: JSON.stringify(payload)," : ""}
  signal: AbortSignal.timeout(300_000),
});
// ${check}
const result = await response.json();
if (!response.ok || (result.code !== undefined && result.code !== 0)) {
  throw new Error(result.msg || JSON.stringify(result));
}
console.log(JSON.stringify(result, null, 2));${language === "TypeScript" ? "\nexport {};" : ""}`;
        case "Go": return `package main

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    "strings"
    "time"
)

func main() {
    // ${comment}
    req, err := http.NewRequest("${method}", os.Getenv("AIVRO_BASE_URL")+"${path}", strings.NewReader(${literal}))
    if err != nil { panic(err) }
    req.Header.Set("Authorization", "Bearer "+os.Getenv("AIVRO_API_KEY"))${body ? '\n    req.Header.Set("Content-Type", "application/json")' : ""}
    resp, err := (&http.Client{Timeout: 300*time.Second}).Do(req)
    if err != nil { panic(err) }
    defer resp.Body.Close()
    data, err := io.ReadAll(resp.Body)
    if err != nil { panic(err) }
    // ${check}
    var result struct { Code int; Msg string }
    if err := json.Unmarshal(data, &result); err != nil { panic(err) }
    if resp.StatusCode >= 300 || result.Code != 0 { panic(string(data)) }
    fmt.Println(string(data))
}`;
        case "Java": return `import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;

public class Main {
    public static void main(String[] args) throws Exception {
        // ${comment}
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(System.getenv("AIVRO_BASE_URL") + "${path}"))
            .timeout(Duration.ofSeconds(300))
            .header("Authorization", "Bearer " + System.getenv("AIVRO_API_KEY"))${body ? '\n            .header("Content-Type", "application/json")' : ""}
            .method("${method}", HttpRequest.BodyPublishers.${body ? `ofString(${literal})` : "noBody()"}).build();
        var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
        // ${check}
        var result = new ObjectMapper().readTree(response.body());
        if (response.statusCode() >= 300 || result.path("code").asInt(0) != 0)
            throw new IllegalStateException(response.body());
        System.out.println(result.toPrettyString());
    }
}`;
        case "C#": return `using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

// ${comment}
using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(300) };
using var request = new HttpRequestMessage(new HttpMethod("${method}"),
    Environment.GetEnvironmentVariable("AIVRO_BASE_URL") + "${path}");
request.Headers.Authorization = new AuthenticationHeaderValue("Bearer",
    Environment.GetEnvironmentVariable("AIVRO_API_KEY"));${body ? `
request.Content = new StringContent(${literal}, Encoding.UTF8, "application/json");` : ""}
using var response = await client.SendAsync(request);
string text = await response.Content.ReadAsStringAsync();
// ${check}
response.EnsureSuccessStatusCode();
using var result = JsonDocument.Parse(text);
if (result.RootElement.TryGetProperty("code", out var code) && code.GetInt32() != 0)
    throw new Exception(text);
Console.WriteLine(text);`;
        case "PHP": return `<?php
// ${comment}
$ch = curl_init(getenv('AIVRO_BASE_URL') . '${path}');
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => '${method}',
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 300,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . getenv('AIVRO_API_KEY'), 'Content-Type: application/json'],${body ? `
    CURLOPT_POSTFIELDS => '${body.replaceAll("'", "\\'")}',` : ""}
]);
$text = curl_exec($ch);
if ($text === false) throw new RuntimeException(curl_error($ch));
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
// ${check}
$result = json_decode($text, true, 512, JSON_THROW_ON_ERROR);
if ($status >= 300 || ($result['code'] ?? 0) !== 0) throw new RuntimeException($text);
echo $text . PHP_EOL;`;
        case "Ruby": return `require 'net/http'
require 'json'

# ${comment}
uri = URI(ENV.fetch('AIVRO_BASE_URL') + '${path}')
request = Net::HTTP::${method === "POST" ? "Post" : method === "DELETE" ? "Delete" : "Get"}.new(uri)
request['Authorization'] = 'Bearer ' + ENV.fetch('AIVRO_API_KEY')${body ? `
request['Content-Type'] = 'application/json'
request.body = ${literal}` : ""}
response = Net::HTTP.start(uri.host, uri.port,
  use_ssl: uri.scheme == 'https', open_timeout: 30, read_timeout: 300) { |http| http.request(request) }
# ${check}
result = JSON.parse(response.body)
raise response.body if response.code.to_i >= 300 || result.fetch('code', 0) != 0
puts JSON.pretty_generate(result)`;
        case "Rust": return `use std::{env, time::Duration};
use serde_json::Value;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ${comment}
    let client = reqwest::Client::builder().timeout(Duration::from_secs(300)).build()?;
    let response = client.request(reqwest::Method::${method}, env::var("AIVRO_BASE_URL")? + "${path}")
        .bearer_auth(env::var("AIVRO_API_KEY")?)${body ? `
        .header("Content-Type", "application/json")
        .body(r#"${body}"#)` : ""}
        .send().await?;
    // ${check}
    let status = response.status();
    let result: Value = response.json().await?;
    if !status.is_success() || result["code"].as_i64().unwrap_or(0) != 0 {
        return Err(result.to_string().into());
    }
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}`;
        case "Kotlin": return `import java.net.URI
import java.net.http.*
import java.time.Duration
import org.json.JSONObject

fun main() {
    // ${comment}
    val request = HttpRequest.newBuilder()
        .uri(URI.create(System.getenv("AIVRO_BASE_URL") + "${path}"))
        .timeout(Duration.ofSeconds(300))
        .header("Authorization", "Bearer " + System.getenv("AIVRO_API_KEY"))${body ? '\n        .header("Content-Type", "application/json")' : ""}
        .method("${method}", HttpRequest.BodyPublishers.${body ? `ofString(${literal})` : "noBody()"}).build()
    val response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString())
    // ${check}
    val result = JSONObject(response.body())
    check(response.statusCode() < 300 && result.optInt("code", 0) == 0) { response.body() }
    println(result.toString(2))
}`;
        case "Swift": return `import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

@main struct Main {
    static func main() async throws {
        // ${comment}
        let env = ProcessInfo.processInfo.environment
        guard let base = env["AIVRO_BASE_URL"], let key = env["AIVRO_API_KEY"],
              let url = URL(string: base + "${path}") else { throw URLError(.badURL) }
        var request = URLRequest(url: url, timeoutInterval: 300)
        request.httpMethod = "${method}"
        request.setValue("Bearer " + key, forHTTPHeaderField: "Authorization")${body ? `
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = ${literal}.data(using: .utf8)` : ""}
        let (data, response) = try await URLSession.shared.data(for: request)
        // ${check}
        let result = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              (result?["code"] as? Int ?? 0) == 0 else { throw URLError(.badServerResponse) }
        print(String(decoding: data, as: UTF8.self))
    }
}`;
        case "Dart": return `import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

Future<void> main() async {
  // ${comment}
  final env = Platform.environment;
  final client = http.Client();
  try {
    final request = http.Request('${method}', Uri.parse(env['AIVRO_BASE_URL']! + '${path}'));
    request.headers['Authorization'] = 'Bearer ' + env['AIVRO_API_KEY']!;${body ? `
    request.headers['Content-Type'] = 'application/json';
    request.body = ${literal};` : ""}
    final response = await client.send(request).then(http.Response.fromStream)
      .timeout(const Duration(seconds: 300));
    // ${check}
    final text = utf8.decode(response.bodyBytes);
    final result = jsonDecode(text) as Map<String, dynamic>;
    if (response.statusCode >= 300 || (result['code'] ?? 0) != 0) throw Exception(text);
    print(text);
  } finally { client.close(); }
}`;
        case "C": return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>

int main(void) {
    // ${comment}
    const char *base = getenv("AIVRO_BASE_URL"), *key = getenv("AIVRO_API_KEY");
    if (!base || !key) return 1;
    char *url = malloc(strlen(base) + ${path.length + 1}), *auth = malloc(strlen(key) + 24);
    if (!url || !auth) { free(url); free(auth); return 1; }
    sprintf(url, "%s${path}", base);
    sprintf(auth, "Authorization: Bearer %s", key);
    curl_global_init(CURL_GLOBAL_DEFAULT);
    CURL *curl = curl_easy_init();
    if (!curl) { free(url); free(auth); curl_global_cleanup(); return 1; }
    struct curl_slist *headers = curl_slist_append(NULL, auth);
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "${method}");${body ? `
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, ${literal});` : ""}
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 300L);
    // {{注释:完整响应写入终端，正式接入时用 JSON 库解析并检查业务 code。}}
    CURLcode status = curl_easy_perform(curl);
    long http_status = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_status);
    curl_slist_free_all(headers); curl_easy_cleanup(curl); curl_global_cleanup();
    free(url); free(auth);
    return status == CURLE_OK && http_status < 300 ? 0 : 1;
}`;
        case "C++": return `#include <cstdlib>
#include <iostream>
#include <string>
#include <curl/curl.h>

int main() {
    // ${comment}
    auto base = std::getenv("AIVRO_BASE_URL"), key = std::getenv("AIVRO_API_KEY");
    if (!base || !key) return 1;
    std::string url = std::string(base) + "${path}", auth = std::string("Authorization: Bearer ") + key;
    curl_global_init(CURL_GLOBAL_DEFAULT);
    CURL* curl = curl_easy_init();
    if (!curl) { curl_global_cleanup(); return 1; }
    curl_slist* headers = curl_slist_append(nullptr, auth.c_str());
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "${method}");${body ? `
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, ${literal});` : ""}
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 300L);
    // {{注释:完整响应写入终端，正式接入时用 JSON 库解析并检查业务 code。}}
    auto status = curl_easy_perform(curl);
    long httpStatus = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpStatus);
    curl_slist_free_all(headers); curl_easy_cleanup(curl); curl_global_cleanup();
    return status == CURLE_OK && httpStatus < 300 ? 0 : 1;
}`;
        case "R": return `library(httr2)

# ${comment}
req <- request(paste0(Sys.getenv("AIVRO_BASE_URL"), "${path}")) |>
  req_auth_bearer_token(Sys.getenv("AIVRO_API_KEY")) |>${body ? `
  req_body_raw(${literal}, type = "application/json") |>` : ""}
  req_method("${method}") |>
  req_timeout(300)
response <- req_perform(req)
# ${check}
result <- resp_body_json(response)
if (!is.null(result$code) && result$code != 0) stop(result$msg)
cat(resp_body_string(response))`;
        case "Perl": return `use strict;
use warnings;
use utf8;
use HTTP::Tiny;
use JSON::PP;

# ${comment}
my $response = HTTP::Tiny->new(timeout => 300, verify_SSL => 1)->request(
    '${method}', $ENV{AIVRO_BASE_URL} . '${path}', {
        headers => { 'Authorization' => 'Bearer ' . $ENV{AIVRO_API_KEY},
                     'Content-Type' => 'application/json' },${body ? `
        content => ${literal},` : ""}
    });
# ${check}
my $result = JSON::PP->new->utf8->decode($response->{content});
die $response->{content} unless $response->{success} && ($result->{code} // 0) == 0;
print $response->{content};`;
        case "Lua": return `local https = require("ssl.https")
local ltn12 = require("ltn12")
local json = require("cjson")

-- ${comment}
local body = ${literal}
local output = {}
https.TIMEOUT = 300
local ok, status = https.request({
  url = os.getenv("AIVRO_BASE_URL") .. "${path}", method = "${method}",
  verify = "peer", cafile = assert(os.getenv("AIVRO_CA_FILE")),
  headers = { ["Authorization"] = "Bearer " .. os.getenv("AIVRO_API_KEY"),
    ["Content-Type"] = "application/json", ["Content-Length"] = tostring(#body) },
  source = ltn12.source.string(body), sink = ltn12.sink.table(output),
})
-- ${check}
assert(ok, status)
local text = table.concat(output)
local result = json.decode(text)
assert(tonumber(status) < 300 and (result.code == nil or result.code == 0), text)
print(text)`;
        case "PowerShell": return `# ${comment}
$requestOptions = @{
    Uri = "$env:AIVRO_BASE_URL${path}"
    Method = '${method}'
    Headers = @{ Authorization = "Bearer $env:AIVRO_API_KEY" }
    TimeoutSec = 300
}${body ? `
$payload = @'
${body}
'@
$requestOptions.ContentType = 'application/json; charset=utf-8'
$requestOptions.Body = [System.Text.Encoding]::UTF8.GetBytes($payload)` : ""}
$result = Invoke-RestMethod @requestOptions
# ${check}
if ($null -ne $result.code -and $result.code -ne 0) { throw $result.msg }
$result | ConvertTo-Json -Depth 20`;
        case "Scala": return `//> using dep com.lihaoyi::ujson:4.1.0
import java.net.URI
import java.net.http.*
import java.time.Duration

@main def run(): Unit = {
  // ${comment}
  val request = HttpRequest.newBuilder()
    .uri(URI.create(sys.env("AIVRO_BASE_URL") + "${path}"))
    .timeout(Duration.ofSeconds(300))
    .header("Authorization", "Bearer " + sys.env("AIVRO_API_KEY"))${body ? '\n    .header("Content-Type", "application/json")' : ""}
    .method("${method}", HttpRequest.BodyPublishers.${body ? `ofString(${literal})` : "noBody()"}).build()
  val response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString())
  // ${check}
  val result = ujson.read(response.body())
  require(response.statusCode() < 300 && result.obj.get("code").forall(_.num == 0), response.body())
  println(ujson.write(result, indent = 2))
}`;
        case "Elixir": return `Mix.install([{:req, "~> 0.5"}])

# ${comment}
response = Req.request!(
  method: :${method.toLowerCase()},
  url: System.fetch_env!("AIVRO_BASE_URL") <> "${path}",
  auth: {:bearer, System.fetch_env!("AIVRO_API_KEY")},${body ? `
  headers: [{"content-type", "application/json"}],
  body: ${literal},` : ""}
  receive_timeout: 300_000, retry: false
)
# ${check}
if response.status >= 300 or Map.get(response.body, "code", 0) != 0 do
  raise inspect(response.body)
end
IO.inspect(response.body)`;
        case "Julia": return `using HTTP, JSON3

# ${comment}
response = HTTP.request(
    "${method}", ENV["AIVRO_BASE_URL"] * "${path}",
    ["Authorization" => "Bearer " * ENV["AIVRO_API_KEY"], "Content-Type" => "application/json"],
    ${literal}; readtimeout=300, retry=false
)
# ${check}
text = String(response.body)
result = JSON3.read(text)
if get(result, :code, 0) != 0
    error(text)
end
println(text)`;
        default: throw new Error("Unknown example language: " + language);
    }
}

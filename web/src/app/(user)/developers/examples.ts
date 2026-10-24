export const languageExamples = [
    { name: "cURL", setup: "安装 cURL 和 jq。先按快速开始设置三个环境变量。", code: `curl --fail-with-body "$AIVRO_BASE_URL/chat/completions" \\
  -H "Authorization: Bearer $AIVRO_API_KEY" \\
  -H 'Content-Type: application/json' \\
  --data "$(jq -n --arg model "$AIVRO_MODEL" '{
    model: $model,
    messages: [{role: "user", content: "Introduce yourself briefly."}],
    max_tokens: 512,
    stream: false
  }')"` },
    { name: "Go", setup: "使用 Go 标准库，将代码保存为 main.go，然后执行 go run main.go。", code: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    "time"
)

func main() {
    body, err := json.Marshal(map[string]any{
        "model": os.Getenv("AIVRO_MODEL"),
        "messages": []map[string]string{{"role": "user", "content": "Introduce yourself briefly."}},
        "max_tokens": 512, "stream": false,
    })
    if err != nil { panic(err) }
    req, err := http.NewRequest("POST", os.Getenv("AIVRO_BASE_URL")+"/chat/completions", bytes.NewReader(body))
    if err != nil { panic(err) }
    req.Header.Set("Authorization", "Bearer "+os.Getenv("AIVRO_API_KEY"))
    req.Header.Set("Content-Type", "application/json")
    resp, err := (&http.Client{Timeout: 300*time.Second}).Do(req)
    if err != nil { panic(err) }
    defer resp.Body.Close()
    data, err := io.ReadAll(resp.Body)
    if err != nil { panic(err) }
    var result struct { Code int; Msg string }
    if err := json.Unmarshal(data, &result); err != nil { panic(err) }
    if resp.StatusCode >= 300 || result.Code != 0 { panic(string(data)) }
    fmt.Println(string(data))
}` },
    { name: "Node.js", setup: "使用 Node.js 22 或更新版本，无需安装额外依赖。保存为 main.mjs，执行 node main.mjs。", code: `const { AIVRO_BASE_URL, AIVRO_API_KEY, AIVRO_MODEL } = process.env;
if (!AIVRO_BASE_URL || !AIVRO_API_KEY || !AIVRO_MODEL) throw new Error("Set the environment variables first");

const response = await fetch(AIVRO_BASE_URL + "/chat/completions", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + AIVRO_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: AIVRO_MODEL,
    messages: [{ role: "user", content: "Introduce yourself briefly." }],
    max_tokens: 512, stream: false,
  }),
  signal: AbortSignal.timeout(300_000),
});
const result = await response.json();
if (!response.ok || (result.code !== undefined && result.code !== 0)) {
  throw new Error(result.msg || "Request failed");
}
console.log(JSON.stringify(result, null, 2));` },
    { name: "Java", setup: "使用 Java 11 或更新版本。通过 Maven 或 Gradle 添加 com.fasterxml.jackson.core:jackson-databind，保存为 Main.java。", code: `import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        ObjectMapper json = new ObjectMapper();
        String body = json.writeValueAsString(Map.of(
            "model", System.getenv("AIVRO_MODEL"),
            "messages", List.of(Map.of("role", "user", "content", "Introduce yourself briefly.")),
            "max_tokens", 512, "stream", false
        ));
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(System.getenv("AIVRO_BASE_URL") + "/chat/completions"))
            .timeout(Duration.ofSeconds(300))
            .header("Authorization", "Bearer " + System.getenv("AIVRO_API_KEY"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());
        var result = json.readTree(response.body());
        if (response.statusCode() >= 300 || result.path("code").asInt(0) != 0) {
            throw new IllegalStateException(response.body());
        }
        System.out.println(result.toPrettyString());
    }
}` },
    { name: "Python", setup: "执行 pip install requests，保存为 main.py，然后执行 python main.py。", code: `import json
import os
import requests

response = requests.post(
    os.environ["AIVRO_BASE_URL"] + "/chat/completions",
    headers={"Authorization": "Bearer " + os.environ["AIVRO_API_KEY"]},
    json={
        "model": os.environ["AIVRO_MODEL"],
        "messages": [{"role": "user", "content": "Introduce yourself briefly."}],
        "max_tokens": 512,
        "stream": False,
    },
    timeout=300,
)
response.raise_for_status()
result = response.json()
if result.get("code", 0) != 0:
    raise RuntimeError(result.get("msg", "Request failed"))
print(json.dumps(result, ensure_ascii=False, indent=2))` },
    { name: "TypeScript", setup: "用于 Node.js 服务端。执行 npm install -D typescript tsx @types/node，保存为 main.mts，然后执行 npx tsx main.mts。", code: `const baseURL = process.env.AIVRO_BASE_URL;
const apiKey = process.env.AIVRO_API_KEY;
const model = process.env.AIVRO_MODEL;
if (!baseURL || !apiKey || !model) throw new Error("Set the environment variables first");

const response = await fetch(baseURL + "/chat/completions", {
  method: "POST",
  headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "Introduce yourself briefly." }],
    max_tokens: 512, stream: false,
  }),
  signal: AbortSignal.timeout(300_000),
});
const result = await response.json() as { code?: number; msg?: string; choices?: unknown[] };
if (!response.ok || (result.code !== undefined && result.code !== 0)) {
  throw new Error(result.msg || "Request failed");
}
console.log(JSON.stringify(result, null, 2));
export {};` },
    { name: "C#", setup: "使用 .NET 8 或更新版本，执行 dotnet new console，将代码放入 Program.cs，再执行 dotnet run。", code: `using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(300) };
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
    "Bearer", Environment.GetEnvironmentVariable("AIVRO_API_KEY"));
var body = new {
    model = Environment.GetEnvironmentVariable("AIVRO_MODEL"),
    messages = new[] { new { role = "user", content = "Introduce yourself briefly." } },
    max_tokens = 512, stream = false
};
using var response = await client.PostAsJsonAsync(
    Environment.GetEnvironmentVariable("AIVRO_BASE_URL") + "/chat/completions", body);
var text = await response.Content.ReadAsStringAsync();
response.EnsureSuccessStatusCode();
using var result = JsonDocument.Parse(text);
if (result.RootElement.TryGetProperty("code", out var code) && code.GetInt32() != 0)
    throw new Exception(text);
Console.WriteLine(text);` },
    { name: "PHP", setup: "启用 PHP 的 cURL 扩展，保存为 main.php，执行 php main.php。", code: `<?php
$body = json_encode([
    'model' => getenv('AIVRO_MODEL'),
    'messages' => [['role' => 'user', 'content' => 'Introduce yourself briefly.']],
    'max_tokens' => 512, 'stream' => false,
], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
$ch = curl_init(getenv('AIVRO_BASE_URL') . '/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body,
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 300,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . getenv('AIVRO_API_KEY'),
        'Content-Type: application/json',
    ],
]);
$text = curl_exec($ch);
if ($text === false) throw new RuntimeException(curl_error($ch));
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$result = json_decode($text, true, 512, JSON_THROW_ON_ERROR);
if ($status >= 300 || ($result['code'] ?? 0) !== 0)
    throw new RuntimeException($result['msg'] ?? 'Request failed');
echo $text . PHP_EOL;` },
    { name: "Ruby", setup: "使用 Ruby 标准库，保存为 main.rb，执行 ruby main.rb。", code: `require 'net/http'
require 'json'

uri = URI(ENV.fetch('AIVRO_BASE_URL') + '/chat/completions')
request = Net::HTTP::Post.new(uri)
request['Authorization'] = 'Bearer ' + ENV.fetch('AIVRO_API_KEY')
request['Content-Type'] = 'application/json'
request.body = JSON.generate({
  model: ENV.fetch('AIVRO_MODEL'),
  messages: [{role: 'user', content: 'Introduce yourself briefly.'}],
  max_tokens: 512, stream: false
})
response = Net::HTTP.start(uri.host, uri.port,
  use_ssl: uri.scheme == 'https', read_timeout: 300) { |http| http.request(request) }
result = JSON.parse(response.body)
raise(result['msg'] || 'Request failed') if response.code.to_i >= 300 || result.fetch('code', 0) != 0
puts JSON.pretty_generate(result)` },
    { name: "Rust", setup: "添加 reqwest（json、rustls-tls 特性）、tokio（full 特性）和 serde_json 依赖，然后执行 cargo run。", code: `use std::{env, time::Duration};
use serde_json::{json, Value};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(300)).build()?;
    let response = client.post(env::var("AIVRO_BASE_URL")? + "/chat/completions")
        .bearer_auth(env::var("AIVRO_API_KEY")?)
        .json(&json!({
            "model": env::var("AIVRO_MODEL")?,
            "messages": [{"role": "user", "content": "Introduce yourself briefly."}],
            "max_tokens": 512, "stream": false
        })).send().await?;
    let status = response.status();
    let result: Value = response.json().await?;
    if !status.is_success() || result["code"].as_i64().unwrap_or(0) != 0 {
        return Err(result.to_string().into());
    }
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}` },
    { name: "Kotlin", setup: "使用 JDK 11 或更新版本，通过 Gradle 添加 org.json:json 依赖。", code: `import java.net.URI
import java.net.http.*
import java.time.Duration
import org.json.JSONObject
import org.json.JSONArray

fun main() {
    val body = JSONObject().put("model", System.getenv("AIVRO_MODEL"))
        .put("messages", JSONArray().put(JSONObject()
            .put("role", "user").put("content", "Introduce yourself briefly.")))
        .put("max_tokens", 512).put("stream", false)
    val request = HttpRequest.newBuilder()
        .uri(URI.create(System.getenv("AIVRO_BASE_URL") + "/chat/completions"))
        .timeout(Duration.ofSeconds(300))
        .header("Authorization", "Bearer " + System.getenv("AIVRO_API_KEY"))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build()
    val response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString())
    val result = JSONObject(response.body())
    check(response.statusCode() < 300 && result.optInt("code", 0) == 0) { response.body() }
    println(result.toString(2))
}` },
    { name: "Swift", setup: "使用 Swift 5.5 或更新版本，保存为 main.swift，执行 swiftc -parse-as-library main.swift -o main 编译，再运行生成的程序。Linux 使用 FoundationNetworking；请勿把密钥打包进客户端应用。", code: `import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

@main struct Main {
    static func main() async throws {
        let env = ProcessInfo.processInfo.environment
        guard let base = env["AIVRO_BASE_URL"], let key = env["AIVRO_API_KEY"],
              let model = env["AIVRO_MODEL"], let url = URL(string: base + "/chat/completions")
        else { throw NSError(domain: "Set the environment variables first", code: 1) }
        var request = URLRequest(url: url, timeoutInterval: 300)
        request.httpMethod = "POST"
        request.setValue("Bearer " + key, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "model": model, "messages": [["role": "user", "content": "Introduce yourself briefly."]],
            "max_tokens": 512, "stream": false
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        let result = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              (result?["code"] as? Int ?? 0) == 0
        else { throw NSError(domain: String(decoding: data, as: UTF8.self), code: 1) }
        print(String(decoding: data, as: UTF8.self))
    }
}` },
    { name: "Dart", setup: "用于服务端或命令行。执行 dart pub add http，保存为 main.dart，执行 dart run main.dart。", code: `import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

Future<void> main() async {
  final env = Platform.environment;
  final response = await http.post(
    Uri.parse(env['AIVRO_BASE_URL']! + '/chat/completions'),
    headers: {'Authorization': 'Bearer ' + env['AIVRO_API_KEY']!, 'Content-Type': 'application/json'},
    body: jsonEncode({
      'model': env['AIVRO_MODEL']!,
      'messages': [{'role': 'user', 'content': 'Introduce yourself briefly.'}],
      'max_tokens': 512, 'stream': false,
    }),
  ).timeout(const Duration(seconds: 300));
  final text = utf8.decode(response.bodyBytes);
  final result = jsonDecode(text) as Map<String, dynamic>;
  if (response.statusCode >= 300 || (result['code'] ?? 0) != 0) {
    throw Exception(result['msg'] ?? 'Request failed');
  }
  print(text);
}` },
    { name: "C", setup: "安装 libcurl 和 cJSON。编译示例：cc main.c -lcurl -lcjson -o main。", code: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>
#include <cjson/cJSON.h>

int main(void) {
    const char *base = getenv("AIVRO_BASE_URL"), *key = getenv("AIVRO_API_KEY"), *model = getenv("AIVRO_MODEL");
    if (!base || !key || !model) { fputs("Set the environment variables first", stderr); return 1; }
    curl_global_init(CURL_GLOBAL_DEFAULT);
    CURL *curl = curl_easy_init();
    if (!curl) return 1;
    cJSON *body = cJSON_CreateObject(), *messages = cJSON_AddArrayToObject(body, "messages");
    cJSON *message = cJSON_CreateObject();
    cJSON_AddStringToObject(body, "model", model);
    cJSON_AddStringToObject(message, "role", "user");
    cJSON_AddStringToObject(message, "content", "Introduce yourself briefly.");
    cJSON_AddItemToArray(messages, message);
    cJSON_AddNumberToObject(body, "max_tokens", 512);
    cJSON_AddBoolToObject(body, "stream", 0);
    char *json = cJSON_PrintUnformatted(body);
    char *url = malloc(strlen(base) + 32), *auth = malloc(strlen(key) + 24);
    sprintf(url, "%s/chat/completions", base);
    sprintf(auth, "Authorization: Bearer %s", key);
    struct curl_slist *headers = curl_slist_append(NULL, auth);
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 300L);
    curl_easy_setopt(curl, CURLOPT_FAILONERROR, 1L);
    CURLcode status = curl_easy_perform(curl); /* Print the full response to the terminal */
    curl_slist_free_all(headers); curl_easy_cleanup(curl); curl_global_cleanup();
    cJSON_free(json); cJSON_Delete(body); free(url); free(auth);
    return status == CURLE_OK ? 0 : 1;
}` },
    { name: "C++", setup: "使用 C++17，安装 libcurl 与 nlohmann/json。编译示例：c++ main.cpp -std=c++17 -lcurl -o main。", code: `#include <cstdlib>
#include <iostream>
#include <string>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

int main() {
    auto base = std::getenv("AIVRO_BASE_URL"), key = std::getenv("AIVRO_API_KEY"), model = std::getenv("AIVRO_MODEL");
    if (!base || !key || !model) { std::cerr << "Set the environment variables first"; return 1; }
    nlohmann::json payload = {
        {"model", model}, {"messages", {{{"role", "user"}, {"content", "Introduce yourself briefly."}}}},
        {"max_tokens", 512}, {"stream", false}
    };
    std::string body = payload.dump(), url = std::string(base) + "/chat/completions";
    std::string auth = std::string("Authorization: Bearer ") + key;
    curl_global_init(CURL_GLOBAL_DEFAULT);
    CURL* curl = curl_easy_init();
    if (!curl) return 1;
    curl_slist* headers = curl_slist_append(nullptr, auth.c_str());
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 300L);
    curl_easy_setopt(curl, CURLOPT_FAILONERROR, 1L);
    auto status = curl_easy_perform(curl); // Print the full response to the terminal
    curl_slist_free_all(headers); curl_easy_cleanup(curl); curl_global_cleanup();
    return status == CURLE_OK ? 0 : 1;
}` },
    { name: "R", setup: "执行 install.packages(\"httr2\")，保存为 main.R，执行 Rscript main.R。", code: `library(httr2)

response <- request(paste0(Sys.getenv("AIVRO_BASE_URL"), "/chat/completions")) |>
  req_auth_bearer_token(Sys.getenv("AIVRO_API_KEY")) |>
  req_body_json(list(
    model = Sys.getenv("AIVRO_MODEL"),
    messages = list(list(role = "user", content = "Introduce yourself briefly.")),
    max_tokens = 512, stream = FALSE
  )) |>
  req_timeout(300) |>
  req_perform()
result <- resp_body_json(response)
if (!is.null(result$code) && result$code != 0) stop(result$msg)
cat(resp_body_string(response))` },
    { name: "Perl", setup: "通过 CPAN 安装 HTTP::Tiny、IO::Socket::SSL 和 JSON::PP，保存为 main.pl，执行 perl main.pl。", code: `use strict;
use warnings;
use utf8;
use HTTP::Tiny;
use JSON::PP;

my $json = JSON::PP->new->utf8;
my $response = HTTP::Tiny->new(timeout => 300, verify_SSL => 1)->post(
    $ENV{AIVRO_BASE_URL} . '/chat/completions', {
        headers => { 'Authorization' => 'Bearer ' . $ENV{AIVRO_API_KEY},
                     'Content-Type' => 'application/json' },
        content => $json->encode({ model => $ENV{AIVRO_MODEL},
            messages => [{ role => 'user', content => 'Introduce yourself briefly.' }],
            max_tokens => 512, stream => JSON::PP::false }),
    });
my $result = $json->decode($response->{content});
die $response->{content} unless $response->{success} && ($result->{code} // 0) == 0;
print $response->{content};` },
    { name: "Lua", setup: "通过 LuaRocks 安装 lua-cjson 与 luasec（依赖 LuaSocket）。设置 AIVRO_CA_FILE 为系统受信任证书文件路径，保存为 main.lua，执行 lua main.lua。", code: `local https = require("ssl.https")
local ltn12 = require("ltn12")
local json = require("cjson")

local body = json.encode({
  model = os.getenv("AIVRO_MODEL"),
  messages = {{role = "user", content = "Introduce yourself briefly."}},
  max_tokens = 512, stream = false
})
local output = {}
https.TIMEOUT = 300
local ok, status = https.request({
  url = os.getenv("AIVRO_BASE_URL") .. "/chat/completions", method = "POST",
  verify = "peer", cafile = assert(os.getenv("AIVRO_CA_FILE"), "Set the trusted CA certificate file path"),
  headers = { ["Authorization"] = "Bearer " .. os.getenv("AIVRO_API_KEY"),
    ["Content-Type"] = "application/json", ["Content-Length"] = tostring(#body) },
  source = ltn12.source.string(body), sink = ltn12.sink.table(output),
})
assert(ok, status)
local text = table.concat(output)
local result = json.decode(text)
assert(tonumber(status) < 300 and (result.code == nil or result.code == 0), text)
print(text)` },
    { name: "PowerShell", setup: "使用 PowerShell 7，按下面的环境变量方式配置，再运行脚本。", code: `$body = @{
    model = $env:AIVRO_MODEL
    messages = @(@{ role = 'user'; content = 'Introduce yourself briefly.' })
    max_tokens = 512
    stream = $false
} | ConvertTo-Json -Depth 10
$requestOptions = @{
    Uri = "$env:AIVRO_BASE_URL/chat/completions"
    Method = 'Post'
    Headers = @{ Authorization = "Bearer $env:AIVRO_API_KEY" }
    ContentType = 'application/json; charset=utf-8'
    Body = [System.Text.Encoding]::UTF8.GetBytes($body)
    TimeoutSec = 300
}
$result = Invoke-RestMethod @requestOptions
if ($null -ne $result.code -and $result.code -ne 0) { throw $result.msg }
$result | ConvertTo-Json -Depth 20` },
    { name: "Scala", setup: "使用 Scala 3 和 scala-cli，示例通过依赖指令加载 ujson，执行 scala main.scala。", code: `//> using dep com.lihaoyi::ujson:4.1.0
import java.net.URI
import java.net.http.*
import java.time.Duration

@main def run(): Unit = {
  val body = ujson.Obj(
    "model" -> sys.env("AIVRO_MODEL"),
    "messages" -> ujson.Arr(ujson.Obj("role" -> "user", "content" -> "Introduce yourself briefly.")),
    "max_tokens" -> 512, "stream" -> false
  )
  val request = HttpRequest.newBuilder()
    .uri(URI.create(sys.env("AIVRO_BASE_URL") + "/chat/completions"))
    .timeout(Duration.ofSeconds(300))
    .header("Authorization", "Bearer " + sys.env("AIVRO_API_KEY"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body.toString)).build()
  val response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString())
  val result = ujson.read(response.body())
  require(response.statusCode() < 300 && result.obj.get("code").forall(_.num == 0), response.body())
  println(ujson.write(result, indent = 2))
}` },
    { name: "Elixir", setup: "使用 Elixir 1.14 或更新版本，保存为 main.exs，执行 elixir main.exs；Mix 会安装 Req 依赖。", code: `Mix.install([{:req, "~> 0.5"}])

response = Req.post!(
  System.fetch_env!("AIVRO_BASE_URL") <> "/chat/completions",
  auth: {:bearer, System.fetch_env!("AIVRO_API_KEY")},
  json: %{
    model: System.fetch_env!("AIVRO_MODEL"),
    messages: [%{role: "user", content: "Introduce yourself briefly."}],
    max_tokens: 512, stream: false
  },
  receive_timeout: 300_000,
  retry: false
)
if response.status >= 300 or Map.get(response.body, "code", 0) != 0 do
  raise inspect(response.body)
end
IO.inspect(response.body, label: "Result")` },
    { name: "Julia", setup: "在 Julia 中执行 using Pkg; Pkg.add([\"HTTP\", \"JSON3\"])，保存为 main.jl，再执行 julia main.jl。", code: `using HTTP, JSON3

body = JSON3.write(Dict(
    "model" => ENV["AIVRO_MODEL"],
    "messages" => [Dict("role" => "user", "content" => "Introduce yourself briefly.")],
    "max_tokens" => 512, "stream" => false
))
response = HTTP.post(
    ENV["AIVRO_BASE_URL"] * "/chat/completions",
    ["Authorization" => "Bearer " * ENV["AIVRO_API_KEY"], "Content-Type" => "application/json"],
    body; readtimeout=300, retry=false
)
text = String(response.body)
result = JSON3.read(text)
if get(result, :code, 0) != 0
    error(get(result, :msg, "Request failed"))
end
println(text)` },
];

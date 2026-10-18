# 前后端接口响应约定

后端业务接口统一返回 JSON：

```json
{
  "code": 0,
  "data": {},
  "msg": "ok"
}
```

- `code`: 业务状态码，`0` 表示成功，非 `0` 表示失败。
- `data`: 业务数据。失败时通常为 `null`。
- `msg`: 响应消息。成功默认为 `ok`，失败时放错误原因。

前端请求逻辑以 `code` 判断业务是否成功。当前后端业务失败也会返回 HTTP 200，前端不要只依赖 HTTP 状态码判断结果。

接口连接失败、服务不可达、返回体不是约定 JSON 时，前端按网络或接口异常处理。

`GET /api/auth/captcha-session` 返回用于验证弹窗展示的 `{ sessionId, clientIP, country }`，并设置 `Cache-Control: no-store`。IP 沿用服务端可信代理解析；国家/地区缺失时返回“未知”。展示编号不作为人机验证凭证，实际登录、注册等请求仍由服务端校验验证码服务的 token。

`POST /api/v1/profile/avatar` 要求登录，使用 multipart 的 `file` 字段上传裁剪后的 512 × 512 PNG，文件最大 5MB。后端重新解码并编码为 PNG 后保存，成功时 `data` 返回更新后的用户资料，前端同步头像；失败时沿用 `{ code, data, msg }`。普通 `/api/v1/profile` 只修改账户资料，不再接受头像 URL。

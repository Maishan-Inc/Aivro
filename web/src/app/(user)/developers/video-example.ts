export const videoWorkflowExample = `import os
import time
import requests

base = os.environ["AIVRO_BASE_URL"].rstrip("/")
session = requests.Session()
session.headers["Authorization"] = "Bearer " + os.environ["AIVRO_API_KEY"]

def read_json(response):
    response.raise_for_status()
    result = response.json()
    if result.get("code", 0) != 0:
        raise RuntimeError(result.get("msg", response.text))
    return result

def wait_queue(result):
    data = result.get("data")
    if not isinstance(data, dict) or not data.get("queued"):
        return result
    task_id = data["taskId"]
    print("taskId:", task_id)
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        task = read_json(session.get(base + "/generation-tasks/" + task_id, timeout=30))["data"]
        if task["status"] == "succeeded" and task["resultAvailable"]:
            return read_json(session.get(base + "/generation-tasks/" + task_id + "/result", timeout=300))
        if task["status"] in ("failed", "canceled"):
            raise RuntimeError(task.get("error") or task["status"])
        time.sleep(3)
    raise TimeoutError(task_id)

# {{注释:设置 AIVRO_VIDEO_MODEL，并准备 reference.png；文件边界由客户端生成。}}
with open("reference.png", "rb") as reference:
    created = wait_queue(read_json(session.post(base + "/videos",
        data={
            "model": os.environ["AIVRO_VIDEO_MODEL"],
            "prompt": "Preserve the reference subject, slow cinematic push-in, subtle motion",
            "seconds": "6", "resolution_name": "720p", "billingType": "fixed",
        },
        files={"input_reference[]": ("reference.png", reference, "image/png")},
        timeout=300,
    )))

# {{注释:队列成功时视频已转存，可直接下载；保存 taskId 以便稍后继续查询。}}
video = created.get("data", created)
video_id = video["id"]
print("videoId:", video_id)
print("billingType:", video["billingType"], "seconds:", video["seconds"], "energyCost:", video["energyCost"])

content = session.get(base + "/videos/" + video_id + "/content", timeout=300, stream=True)
with content:
    content.raise_for_status()
    if not content.headers.get("Content-Type", "").startswith(("video/", "application/octet-stream")):
        raise RuntimeError(content.headers.get("Content-Type"))
    with open("result.mp4", "wb") as output:
        for chunk in content.iter_content(1024 * 1024):
            output.write(chunk)
session.close()`;

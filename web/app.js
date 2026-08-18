const recordButton = document.querySelector("#recordButton");
const resumeButton = document.querySelector("#resumeButton");

const workNote = document.querySelector("#workNote");
const recordResult = document.querySelector("#recordResult");

const RESULT_LABELS = ["확인 항목", "미확인 항목", "이력서 사용 가능 항목", "추가 확인 질문"];

function showMessage(text) {
  recordResult.textContent = text;
  recordResult.classList.remove("hidden");
}

function showVerifyResult(data) {
  recordResult.textContent = "";

  for (let i = 0; i < RESULT_LABELS.length; i += 2) {
    const grid = document.createElement("div");
    grid.className = "status-grid";
    for (const label of RESULT_LABELS.slice(i, i + 2)) {
      const article = document.createElement("article");
      const h3 = document.createElement("h3");
      h3.textContent = label;
      const p = document.createElement("p");
      p.textContent = data[label] || "-";
      article.append(h3, p);
      grid.append(article);
    }
    recordResult.append(grid);
  }

  const counts = document.createElement("p");
  counts.className = "muted";
  counts.textContent = `입력 ${data.inputLength}자 → 출력 ${data.outputLength}자`;
  recordResult.append(counts);

  recordResult.classList.remove("hidden");
}

recordButton.addEventListener("click", async () => {
  const text = workNote.value.trim();

  if (!text) {
    showMessage("검증할 업무 기록이 없습니다");
    return;
  }

  recordButton.disabled = true;
  showMessage("career-verify를 부르는 중");

  try {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "검증 요청에 실패했습니다.");
    }

    showVerifyResult(data);
  } catch (err) {
    showMessage(err.message);
  } finally {
    recordButton.disabled = false;
  }
});

resumeButton.addEventListener("click", () => {
  document.querySelector("#resumeResult").classList.remove("hidden");
});

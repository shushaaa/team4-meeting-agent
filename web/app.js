const recordButton = document.querySelector("#recordButton");
const resumeButton = document.querySelector("#resumeButton");
const workNote = document.querySelector("#workNote");

const recordResult = document.querySelector("#recordResult");
const recordMessage = document.querySelector("#recordMessage");
const recordDetail = document.querySelector("#recordDetail");
const recordVerified = document.querySelector("#recordVerified");
const recordUnverified = document.querySelector("#recordUnverified");
const recordResumeReady = document.querySelector("#recordResumeReady");
const recordQuestions = document.querySelector("#recordQuestions");
const recordUsage = document.querySelector("#recordUsage");

function showMessage(text) {
  recordResult.classList.remove("hidden");
  recordDetail.classList.add("hidden");
  recordMessage.textContent = text;
  recordMessage.classList.remove("hidden");
}

function showDetail(result, usage) {
  recordResult.classList.remove("hidden");
  recordMessage.classList.add("hidden");
  recordVerified.textContent = result.확인_항목 || "-";
  recordUnverified.textContent = result.미확인_항목 || "-";
  recordResumeReady.textContent = result.이력서_사용_가능_항목 || "-";
  recordQuestions.textContent = result.추가_확인_질문 || "-";
  recordUsage.textContent = `입력 ${usage.inputChars}자 · 출력 ${usage.outputChars}자`;
  recordDetail.classList.remove("hidden");
}

recordButton.addEventListener("click", async () => {
  const recordText = workNote.value.trim();

  if (!recordText) {
    showMessage("검증할 업무 기록이 없습니다");
    return;
  }

  recordButton.disabled = true;
  showMessage("career-verify를 부르는 중");

  try {
    const response = await fetch("/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recordText }),
    });
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "알 수 없는 오류가 발생했습니다.");
    }

    showDetail(data.result, data.usage);
  } catch (err) {
    showMessage(err.message || "검증 요청 중 오류가 발생했습니다.");
  } finally {
    recordButton.disabled = false;
  }
});

resumeButton.addEventListener("click", () => {
  document.querySelector("#resumeResult").classList.remove("hidden");
});

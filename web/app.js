const recordButton = document.querySelector("#recordButton");
const resumeButton = document.querySelector("#resumeButton");

recordButton.addEventListener("click", () => {
  document.querySelector("#recordResult").classList.remove("hidden");
});

resumeButton.addEventListener("click", () => {
  document.querySelector("#resumeResult").classList.remove("hidden");
});

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.getAttribute("data-tab");

    tabs.forEach((item) => item.classList.remove("is-active"));
    panels.forEach((panel) => panel.classList.remove("is-active"));

    tab.classList.add("is-active");
    document
      .querySelector(`.tab-panel[data-panel="${target}"]`)
      ?.classList.add("is-active");
  });
});
